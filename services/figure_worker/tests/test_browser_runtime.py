"""Real trusted renderer contracts, independent of the WASM loader."""
from hashlib import sha256
from io import BytesIO
import json
import unittest
from copy import deepcopy
from pathlib import Path

from PIL import Image

from services.figure_worker.browser_runtime import inspect_csv, render_preview


PAYLOAD = b"Category,Value\nTreatment,12\nControl,9\n"
SPEC = dict(schema_version="figure-spec-v1", template_id="grouped-bar",
            template_version="grouped-bar-v1", dataset_sha256=sha256(PAYLOAD).hexdigest(),
            mapping=dict(category="col_1", value="col_2"), units=dict(value="patients"),
            style=dict(id="nature", version="nature-inspired-v1"))


class BrowserRuntimeTests(unittest.TestCase):
    def test_multipanel_uses_its_own_aspect_and_preflights_at_actual_physical_size(self):
        fixture = Path(__file__).parents[1] / "examples" / "radiology-validation"
        source = (fixture / "data.csv").read_bytes()
        base = json.loads((fixture / "spec.json").read_text())
        for count in (2, 3, 4):
            with self.subTest(panels=count):
                spec = deepcopy(base)
                if count == 2:
                    spec["panels"] = [spec["panels"][0], spec["panels"][2]]
                elif count == 4:
                    spec["panels"].append(dict(deepcopy(spec["panels"][1]), title="Supplied interval repeat"))
                from services.figure_worker.render import BROWSER_EXPORT
                from services.figure_worker.multipanel import _make_multipanel_figure, validate_csv_multipanel_spec
                token = BROWSER_EXPORT.set(True)
                try:
                    figure = _make_multipanel_figure(validate_csv_multipanel_spec(source, spec))
                    try:
                        renderer = figure.canvas.get_renderer()
                        for axis in figure.axes:
                            legend = axis.get_legend()
                            if legend is not None:
                                self.assertFalse(legend.get_window_extent(renderer).overlaps(axis._left_title.get_window_extent(renderer)))
                    finally:
                        figure.clear()
                finally:
                    BROWSER_EXPORT.reset(token)
                _, manifest, artifacts = render_preview(source, spec)
                rows = 1 if count == 2 else 2
                self.assertAlmostEqual(manifest["width_px"] / manifest["height_px"], 16 / (5.5 * rows), delta=0.005)
                self.assertGreaterEqual(manifest["width_px"], 4000)
                self.assertLess(manifest["width_px"] * manifest["height_px"], 40_000_000)
                self.assertEqual(manifest["width_mm"], 254)
                with Image.open(BytesIO(next(a.content for a in artifacts if a.format == "png"))) as image:
                    self.assertAlmostEqual(image.info["dpi"][0], 600, delta=0.05)
    def test_inspection_returns_only_schema_not_raw_rows(self):
        profile = inspect_csv(PAYLOAD)
        self.assertEqual(profile["row_count"], 2)
        self.assertEqual(profile["dataset_sha256"], sha256(PAYLOAD).hexdigest())
        self.assertEqual(profile["columns"][1]["id"], "col_2")
        self.assertNotIn("Treatment", json.dumps(profile))

    def test_preview_is_marked_original_high_resolution_and_provenance_is_actual(self):
        from services.figure_worker.browser_runtime import read_watermark
        preview, manifest, artifacts = render_preview(PAYLOAD, SPEC)
        self.assertEqual(read_watermark(preview), "sci-necromancer")
        original = next(a.content for a in artifacts if a.format == "png")
        self.assertIsNone(read_watermark(original))
        with Image.open(BytesIO(original)) as image:
            self.assertEqual(image.width, 4204)
            self.assertAlmostEqual(image.info["dpi"][0], 600, delta=0.05)
        self.assertEqual(manifest["export_profile"], "browser-600dpi-v1")
        self.assertFalse(manifest["baseline_lock_is_runtime_lock"])
        self.assertEqual(set(manifest["runtime_dependencies"]), {"python", "matplotlib", "numpy", "pillow"})
        self.assertEqual({a.format for a in artifacts}, {"png", "pdf", "svg"})
        self.assertEqual(manifest["dataset_sha256"], SPEC["dataset_sha256"])

    def test_source_and_injected_code_are_rejected(self):
        for payload, spec in [(PAYLOAD + b"Extra,1\n", SPEC),
                              (PAYLOAD, dict(SPEC, python="print('not allowed')"))]:
            with self.assertRaises(ValueError):
                render_preview(payload, spec)

    def test_original_renderer_profile_does_not_change_after_browser_run(self):
        from services.figure_worker.spec import render_csv_spec
        before = render_csv_spec(PAYLOAD, SPEC)
        render_preview(PAYLOAD, SPEC)
        after = render_csv_spec(PAYLOAD, SPEC)
        self.assertEqual(after.dpi, 300)
        self.assertEqual(before.figure_spec_hash, after.figure_spec_hash)
        self.assertEqual(before.artifacts[0].sha256, after.artifacts[0].sha256)
