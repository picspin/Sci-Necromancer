"""Composite boundary tests on independently authored synthetic data only."""

import copy
import csv
from hashlib import sha256
from io import BytesIO, StringIO
import json
from pathlib import Path
import sys
import tempfile
import unittest
import warnings
from unittest.mock import patch

from matplotlib import rc_context
from PIL import Image

from services.figure_worker.dataset import DatasetError
from services.figure_worker import multipanel as composite, render
from services.figure_worker.examples.radiology_validation import main as render_demo
from services.figure_worker.multipanel import render_csv_multipanel_spec, validate_csv_multipanel_spec
from services.figure_worker.styles import STYLES
from services.figure_worker.tests.test_styles import scientific_snapshot


EXAMPLE = Path(__file__).parents[1] / "examples" / "radiology-validation"


def example_plan():
    payload = (EXAMPLE / "data.csv").read_bytes()
    return payload, json.loads((EXAMPLE / "spec.json").read_text())


class MultipanelTests(unittest.TestCase):
    def test_explicit_reuse_and_all_row_coverage(self):
        payload, spec = example_plan()
        frozen = copy.deepcopy(spec)
        plan = validate_csv_multipanel_spec(payload, spec)
        self.assertEqual(spec, frozen)
        self.assertEqual([p.source_rows for p in plan.panels], [(2, 3, 4, 5), (2, 3, 4, 5), (6, 7, 8, 9)])
        self.assertEqual([str(p.value) for p in plan.panels[0].data.points], ["0.72", "0.78", "0.74", "0.80"])
        self.assertEqual({p.data.dataset_hash for p in plan.panels}, {sha256(payload).hexdigest()})

    def test_uncovered_and_empty_selections_fail(self):
        payload, spec = example_plan()
        with self.assertRaises(DatasetError) as context:
            validate_csv_multipanel_spec(payload, {**spec, "panels": spec["panels"][:2]})
        self.assertEqual(context.exception.code, "uncovered_multipanel_rows")
        spec["panels"][0]["record_type"] = "not-present"
        with self.assertRaises(DatasetError) as context:
            validate_csv_multipanel_spec(payload, spec)
        self.assertEqual(context.exception.code, "empty_multipanel_selection")

    def test_subset_errors_report_original_source_row(self):
        payload, spec = example_plan()
        payload = payload.replace(b"MR,Dice,0.76", b"MR,Dice,")
        spec["dataset_sha256"] = sha256(payload).hexdigest()
        with self.assertRaises(DatasetError) as context:
            validate_csv_multipanel_spec(payload, spec)
        self.assertEqual((context.exception.code, context.exception.row, context.exception.column),
                         ("missing_heatmap_value", 9, "col_6"))

    def test_exact_geometry_and_colorbar_is_not_a_data_panel(self):
        payload, spec = example_plan()
        figure = composite._make_multipanel_figure(validate_csv_multipanel_spec(payload, spec))
        try:
            bar, intervals, heatmap, colorbar = figure.axes
            self.assertEqual([p.get_height() for p in bar.patches], [0.72, 0.74, 0.78, 0.80])
            self.assertEqual(bar.get_ylim()[0], 0)
            self.assertEqual(intervals.collections[0].get_segments()[0].tolist(), [[0.65, 0], [0.79, 0]])
            self.assertEqual(intervals.collections[1].get_offsets()[:, 0].tolist(), [0.72, 0.78, 0.74, 0.80])
            self.assertEqual(heatmap.images[0].get_array().tolist(), [[0.65, 0.73], [0.68, 0.76]])
            self.assertEqual((heatmap.images[0].norm.vmin, heatmap.images[0].norm.vmax), (0.65, 0.76))
            self.assertEqual(colorbar.get_ylabel(), "Dice (ratio)")
            self.assertEqual([a.get_title(loc="left").split(".")[0] for a in figure.axes[:3]], ["A", "B", "C"])
            self.assertIn("SYNTHETIC", figure.texts[-1].get_text())
        finally:
            figure.clear()

    def test_five_styles_repeatable_exports_and_frozen_manifest(self):
        payload, spec = example_plan()
        fingerprints = set()
        for style in STYLES.values():
            with self.subTest(style=style.id):
                spec["style"] = dict(id=style.id, version=style.version)
                frozen = copy.deepcopy(spec)
                with rc_context({"text.usetex": True}), patch("matplotlib.texmanager.TexManager.make_dvi",
                        side_effect=AssertionError("TeX must never run")):
                    first = render_csv_multipanel_spec(payload, spec)
                    self.assertEqual(first, render_csv_multipanel_spec(payload, spec))
                self.assertEqual(frozen, spec)
                self.assertEqual((first.width_inches, first.height_inches, first.dpi), (16, 11, style.dpi))
                artifacts = {a.format: a for a in first.artifacts}
                self.assertEqual(set(artifacts), {"png", "pdf", "svg", "manifest"})
                with Image.open(BytesIO(artifacts["png"].content)) as image:
                    self.assertEqual(image.size, (16 * style.dpi, 11 * style.dpi))
                    image.verify()
                self.assertTrue(artifacts["pdf"].content.startswith(b"%PDF-"))
                self.assertIn(b"<svg", artifacts["svg"].content[:2000])
                for a in artifacts.values():
                    self.assertEqual(a.sha256, sha256(a.content).hexdigest())
                manifest = json.loads(artifacts["manifest"].content)
                self.assertEqual(manifest["spec"], spec)
                self.assertEqual(manifest["panels"][1]["source_rows"], [2, 3, 4, 5])
                self.assertEqual(manifest["artifacts"], [dict(format=a.format, media_type=a.media_type, sha256=a.sha256)
                                                       for a in first.artifacts[:3]])
                self.assertEqual(manifest["figure_spec_hash"], first.figure_spec_hash)
                fingerprints.add(first.figure_spec_hash)
        self.assertEqual(len(fingerprints), 5)

    def test_two_three_four_panels_preserve_style_geometry(self):
        payload, base = example_plan()
        apply = render._apply_style
        for count in (2, 3, 4):
            spec = copy.deepcopy(base)
            if count == 2:
                spec["panels"] = [spec["panels"][0], spec["panels"][2]]
            elif count == 4:
                spec["panels"].append(copy.deepcopy(spec["panels"][0]))
                spec["panels"][-1]["title"] = "Repeated view, not independent observations"
            for style in STYLES.values():
                spec["style"] = dict(id=style.id, version=style.version)
                with self.subTest(count=count, style=style.id):
                    figure = composite._make_multipanel_figure(validate_csv_multipanel_spec(payload, spec))
                    try:
                        before = scientific_snapshot(figure)
                        apply(figure, style)
                        figure.canvas.draw()
                        self.assertEqual(before, scientific_snapshot(figure))
                        renderer = figure.canvas.get_renderer()
                        for axis in figure.axes:
                            box = axis.get_tightbbox(renderer).transformed(figure.transFigure.inverted())
                            self.assertGreaterEqual(box.x0, 0)
                            self.assertLessEqual(box.x1, 1)
                            self.assertGreaterEqual(box.y0, 0.085)
                            self.assertLessEqual(box.y1, 0.91)
                        self.assertEqual(len(figure.axes), count + 1)  # One separate heatmap colorbar.
                        self.assertEqual(tuple(figure.get_size_inches()), (16, 5.5 if count == 2 else 11))
                        if style.id != "standard":
                            bar = figure.axes[0]
                            self.assertEqual(bar.patches[0].get_facecolor(), render.to_rgba(style.palette[0]))
                            self.assertEqual(bar.get_legend().legend_handles[0].get_facecolor(), bar.patches[0].get_facecolor())
                    finally:
                        figure.clear()
            result = render_csv_multipanel_spec(payload, spec)
            self.assertEqual(result.height_inches, 5.5 if count == 2 else 11)

    def test_strict_top_level_schema_versions_hash_and_limits(self):
        payload, base = example_plan()
        changes = [dict(schema_version="v2"), dict(dataset_sha256="invalid"), dict(dataset_sha256="0" * 64),
                   dict(record_type_column=[]), dict(record_type_column="col_100"), dict(synthetic=1),
                   dict(title=None), dict(title=""), dict(title="x" * 121), dict(panels=[]),
                   dict(panels=base["panels"][:1]), dict(panels=base["panels"] * 2), dict(panels=None),
                   dict(style=dict(id="nature", version="uninstalled")), dict(style=dict(id="nature", version="nature-inspired-v1", dpi=1))]
        changes += [{field: "untrusted"} for field in ("script", "path", "url", "raw_values", "transform", "model", "layout")]
        with patch.object(composite, "_export_figure") as export:
            for change in changes:
                with self.subTest(change=change), self.assertRaises(DatasetError):
                    render_csv_multipanel_spec(payload, {**base, **change})
            for malformed in (None, [], {}):
                with self.assertRaises(DatasetError):
                    render_csv_multipanel_spec(payload, malformed)
            export.assert_not_called()

    def test_strict_panel_options_and_no_expressions_or_raw_values(self):
        payload, base = example_plan()
        changes = [dict(template_id=[]), dict(template_id="radar"), dict(template_version="v9"),
                   dict(title=True), dict(title="x" * 81), dict(record_type="auc or dice"),
                   dict(record_type=[]), dict(mapping=[]), dict(mapping=dict(category="col_2", value="col_1")),
                   dict(mapping=dict(category="col_2", value="col_6", expression="eval")),
                   dict(mapping=dict(category="col_2", value="../../data")), dict(units=dict(value=None)),
                   dict(units=dict(value="ratio", extra="x")), dict(interval=dict(type="CI", ci_level=95))]
        changes += [{field: "untrusted"} for field in ("script", "path", "url", "raw_values", "transform", "style", "dataset_sha256")]
        with patch.object(composite, "_export_figure") as export:
            for change in changes:
                spec = copy.deepcopy(base)
                spec["panels"][0].update(change)
                with self.subTest(change=change), self.assertRaises(DatasetError):
                    render_csv_multipanel_spec(payload, spec)
            for interval in (None, dict(type="CI"), dict(type="CI", ci_level=True), dict(type="CI", ci_level="NaN"),
                             dict(type="CI", ci_level=95, script="x"), dict(type="SD", ci_level=95)):
                spec = copy.deepcopy(base)
                spec["panels"][1]["interval"] = interval
                with self.subTest(interval=interval), self.assertRaises(DatasetError):
                    render_csv_multipanel_spec(payload, spec)
            export.assert_not_called()

    def test_unplottable_numeric_ranges_never_export_misleading_scales(self):
        payload, base = example_plan()
        for kind, value in (("auc", "1e-320"), ("dice", "1e-300"), ("auc", "1e308")):
            spec = copy.deepcopy(base)
            rows = list(csv.reader(StringIO(payload.decode())))
            for row in rows[1:]:
                if row[0] == kind:
                    row[5] = value
                    if kind == "auc":
                        row[6] = row[7] = value
            stream = StringIO()
            csv.writer(stream, lineterminator="\n").writerows(rows)
            changed = stream.getvalue().encode()
            spec["dataset_sha256"] = sha256(changed).hexdigest()
            with self.subTest(kind=kind, value=value), patch.object(composite, "_export_figure") as export:
                with warnings.catch_warnings(), self.assertRaises(DatasetError) as context:
                    warnings.simplefilter("ignore", RuntimeWarning)
                    render_csv_multipanel_spec(changed, spec)
                self.assertEqual(context.exception.code, "unplottable_multipanel_range")
                export.assert_not_called()

    def test_reused_group_names_cannot_silently_swap_colors(self):
        payload, spec = example_plan()
        # A second bar panel uses the same methods but opposite first-observed order.
        added = (b"other,Center C,Example,CT,AUC,0.70,,,\n"
                 b"other,Center C,Baseline,CT,AUC,0.60,,,\n")
        payload += added
        spec["dataset_sha256"] = sha256(payload).hexdigest()
        spec["panels"].append({**copy.deepcopy(spec["panels"][0]), "record_type": "other"})
        with self.assertRaises(DatasetError) as context:
            validate_csv_multipanel_spec(payload, spec)
        self.assertEqual(context.exception.code, "inconsistent_multipanel_group_order")

    def test_zero_and_small_representable_constants_keep_their_own_scales(self):
        payload, spec = example_plan()
        for value in ("0", "1e-280"):
            rows = list(csv.reader(StringIO(payload.decode())))
            for row in rows[1:]:
                row[5] = value
                if row[0] == "auc":
                    row[6] = row[7] = value
            stream = StringIO()
            csv.writer(stream, lineterminator="\n").writerows(rows)
            changed = stream.getvalue().encode()
            spec["dataset_sha256"] = sha256(changed).hexdigest()
            with self.subTest(value=value):
                figure = composite._make_multipanel_figure(validate_csv_multipanel_spec(changed, spec))
                try:
                    self.assertEqual(figure.axes[0].patches[0].get_height(), float(value))
                    self.assertEqual(figure.axes[2].images[0].get_array()[0, 0], float(value))
                    if value != "0":
                        self.assertLess(figure.axes[0].get_ylim()[1], 2e-280)
                        self.assertLess(figure.axes[1].get_xlim()[1], 2e-280)
                        self.assertLess(figure.axes[2].images[0].get_clim()[1], 2e-280)
                finally:
                    figure.clear()

    def test_unsupported_glyphs_and_outside_canvas_labels_block_exports(self):
        payload, spec = example_plan()
        with patch.object(composite, "_export_figure") as export:
            spec["title"] = "Clinical \u4e2d\u6587"
            with self.assertRaises(DatasetError) as context:
                render_csv_multipanel_spec(payload, spec)
            self.assertEqual(context.exception.code, "unsupported_multipanel_glyph")
            export.assert_not_called()
        payload, spec = example_plan()
        changed = payload.replace(b"Center A - Baseline", b"W" * 80)
        spec["dataset_sha256"] = sha256(changed).hexdigest()
        with patch.object(composite, "_export_figure") as export, warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with self.assertRaises(DatasetError) as context:
                render_csv_multipanel_spec(changed, spec)
            self.assertIn(context.exception.code, ("unplottable_multipanel_layout", "overlapping_multipanel_layout"))
            export.assert_not_called()

    def test_incomplete_matrix_duplicates_and_bad_intervals_fail_before_export(self):
        payload, base = example_plan()
        mutations = [
            payload.replace(b"dice,,Example,MR,Dice,0.76,,,\n", b""),
            payload.replace(b"MR,Dice,0.76", b"CT,Dice,0.76"),
            payload.replace(b"0.72,0.65,0.79", b"0.72,0.85,0.79"),
            payload.replace(b"MR,Dice,0.76", b"MR,Dice,NaN"),
            payload + b"unknown,,Example,MR,Dice,0.76,,,\n",
        ]
        for changed in mutations:
            spec = copy.deepcopy(base)
            spec["dataset_sha256"] = sha256(changed).hexdigest()
            with self.subTest(changed=sha256(changed).hexdigest()), patch.object(composite, "_export_figure") as export:
                with self.assertRaises(DatasetError):
                    render_csv_multipanel_spec(changed, spec)
                export.assert_not_called()

    def test_frozen_plan_does_not_follow_later_input_mutations(self):
        payload, spec = example_plan()
        plan = validate_csv_multipanel_spec(payload, spec)
        frozen = plan.frozen_spec
        spec["panels"][0]["mapping"]["value"] = "col_2"
        spec["panels"][0]["title"] = "changed"
        spec["title"] = "changed"
        self.assertEqual(plan.frozen_spec, frozen)
        self.assertEqual(plan.title, "Radiology model validation")
        self.assertEqual(plan.panels[0].title, "AUC by center and method")
        self.assertEqual(plan.panels[0].data.value_column, "col_6")

    def test_runnable_demo_creates_all_outputs_without_overwriting(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            args = ["radiology-demo", "--output", str(output), "--style", "nature"]
            with patch.object(sys, "argv", args), patch("builtins.print"):
                render_demo()
            names = {p.name for p in output.iterdir()}
            self.assertEqual(names, {"radiology-validation.png", "radiology-validation.pdf",
                                     "radiology-validation.svg", "radiology-validation.manifest.json"})
            manifest = json.loads((output / "radiology-validation.manifest.json").read_text())
            self.assertEqual(manifest["spec"]["style"], dict(id="nature", version="nature-inspired-v1"))
            (output / "sentinel").write_text("keep")
            with patch.object(sys, "argv", args), self.assertRaises(FileExistsError):
                render_demo()
            self.assertEqual((output / "sentinel").read_text(), "keep")


if __name__ == "__main__":
    unittest.main()
