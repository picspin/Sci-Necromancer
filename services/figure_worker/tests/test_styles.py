"""Synthetic style regression: appearance changes must not change scientific data."""

import copy
from dataclasses import replace
from hashlib import sha256
from io import BytesIO
import struct
import unittest
from unittest.mock import patch

from matplotlib import rc_context
from PIL import Image

from services.figure_worker.dataset import DatasetError
from services.figure_worker import render, spec
from services.figure_worker.styles import resolve_style, STANDARD_STYLE, STYLES


def cases():
    return [
        ("grouped-bar", b"C,V,G\nA,2,Control\nA,3,Treated\n", {"category": "col_1", "value": "col_2", "group": "col_3"}, {"value": "patients"}, {}),
        ("scatter", b"X,Y,G\n1,2,Control\n3,4,Treated\n", {"x": "col_1", "y": "col_2", "group": "col_3"}, {"x": "mm", "y": "score"}, {}),
        ("heatmap", b"R,C,V\nA,X,-2\nA,Y,0\nB,X,3\nB,Y,7\n", {"row": "col_1", "column": "col_2", "value": "col_3"}, {"value": "score"}, {}),
        ("trend", b"X,V,S\n1,3,A\n2,8,A\n1,4,B\n2,6,B\n", {"x": "col_1", "value": "col_2", "series": "col_3"}, {"x": "weeks", "value": "patients"}, {}),
        ("dot-interval", b"L,E,Low,High\nA,2,1,3\nB,5,4,7\n", {"label": "col_1", "estimate": "col_2", "lower": "col_3", "upper": "col_4"}, {"value": "score"}, {"interval": {"type": "CI", "ci_level": 95}}),
        ("forest", b"L,E,Low,High\nA,1.2,0.9,1.8\nB,0.8,0.5,1.1\n", {"label": "col_1", "estimate": "col_2", "lower": "col_3", "upper": "col_4"}, {"value": "OR"}, {"interval": {"type": "CI", "ci_level": 95, "effect_type": "OR"}}),
        ("ranked-lollipop", b"L,V,G\nA,3,X\nB,5,Y\nC,2,X\n", {"label": "col_1", "value": "col_2", "group": "col_3"}, {"value": "score"}, {"ranking": {"ordering": "descending", "top_n": 2}}),
        ("composition", b"G,C,N,D\nA,X,2,5\nA,Y,3,5\nB,X,6,8\nB,Y,2,8\n", {"group": "col_1", "component": "col_2", "count": "col_3", "denominator": "col_4"}, {"count": "patients"}, {"composition": {"display": "percent", "denominator_scope": "within-group", "mutually_exclusive": True, "exhaustive": True}}),
        ("volcano", b"ID,FC,P\nA,-2,0.001\nB,2,0\nC,0.5,0.3\n", {"identifier": "col_1", "log2fc": "col_2", "p": "col_3"}, {"log2fc": "log2 fold change", "p": "probability"}, {"volcano": {"p_kind": "adjusted_p", "p_threshold": "0.05", "fold_threshold": 1, "zero_p_floor": "0.0001"}}),
        ("distribution", b"V,G\n1,A\n4,A\n9,A\n7,B\n", {"value": "col_1", "group": "col_2"}, {"value": "score"}, {}),
    ]


def plan(case, style=None):
    template, payload, mapping, units, extra = case
    result = dict(schema_version=spec.SCHEMA_VERSION, template_id=template,
                  template_version=spec.TEMPLATE_VERSIONS[template],
                  dataset_sha256=sha256(payload).hexdigest(), mapping=mapping, units=units, **extra)
    if style is not None:
        result["style"] = dict(id=style.id, version=style.version)
    return result


def scientific_snapshot(figure):
    return [dict(
        limits=(axis.get_xlim(), axis.get_ylim()),
        scales=(axis.get_xscale(), axis.get_yscale()),
        ticks=(axis.get_xticks().tolist(), axis.get_yticks().tolist()),
        labels=(axis.get_xlabel(), axis.get_ylabel(),
                [t.get_text() for t in axis.get_xticklabels()],
                [t.get_text() for t in axis.get_yticklabels()]),
        lines=[line.get_xydata().tolist() for line in axis.lines],
        patches=[(p.get_path().vertices.tolist(), p.get_patch_transform().get_matrix().tolist())
                 for p in axis.patches],
        offsets=[c.get_offsets().tolist() for c in axis.collections],
        paths=[[p.vertices.tolist() for p in c.get_paths()] for c in axis.collections],
        arrays=[None if c.get_array() is None else c.get_array().tolist() for c in axis.collections],
        alpha=[(c.get_alpha(), c.get_facecolors()[:, 3].tolist(), c.get_edgecolors()[:, 3].tolist())
               for c in axis.collections],
        images=[(i.get_array().tolist(), i.norm.vmin, i.norm.vmax) for i in axis.images],
        footer=[(t.get_text(), t.get_position(), t.get_fontsize()) for t in figure.texts],
    ) for axis in figure.axes]


class FigureStyleTests(unittest.TestCase):
    def test_strict_frozen_identity_and_immutable_registry(self):
        for style in STYLES.values():
            self.assertIs(resolve_style(dict(id=style.id, version=style.version)), style)
        for snapshot in (None, [], {}, {"id": "nature"},
                         {"id": True, "version": "v1"}, {"id": [], "version": "v1"},
                         {"id": "nature", "version": "nature-inspired-v1", "dpi": 999999},
                         {"id": "url", "version": "https://untrusted"},
                         {"id": "nature", "version": "unreviewed"}):
            with self.subTest(snapshot=snapshot), patch.object(spec, "parse_csv_bytes") as parser:
                with self.assertRaises(DatasetError):
                    spec.render_csv_spec(cases()[0][1], {**plan(cases()[0]), "style": snapshot})
                parser.assert_not_called()
        with self.assertRaises(TypeError):
            STYLES["unreviewed"] = STANDARD_STYLE

    def test_every_template_and_journal_style_preserves_scientific_geometry(self):
        self.assertEqual({c[0] for c in cases()}, set(spec.TEMPLATE_VERSIONS))
        apply = render._apply_style
        for case in cases():
            for style in list(STYLES.values())[1:]:
                with self.subTest(template=case[0], style=style.id):
                    frozen = plan(case, style)
                    original = copy.deepcopy(frozen)
                    snapshots = []

                    def check(figure, selected):
                        before = scientific_snapshot(figure)
                        apply(figure, selected)
                        self.assertEqual(before, scientific_snapshot(figure))
                        if case[0] == "heatmap":
                            self.assertEqual(figure.axes[0].images[0].get_cmap().name, style.heatmap_cmap)
                        elif case[0] == "trend":
                            self.assertEqual(figure.axes[0].lines[0].get_color(), render.to_rgba(style.palette[0]))
                            self.assertAlmostEqual(figure.axes[0].lines[0].get_linewidth(), 1.2 * style.line_scale)
                        elif case[0] in ("scatter", "dot-interval", "forest", "ranked-lollipop", "volcano"):
                            colors = [tuple(c[:3]) for coll in figure.axes[0].collections
                                      for c in coll.get_facecolors()]
                            self.assertIn(render.to_rgba(style.palette[0])[:3], colors)
                        snapshots.append(before)

                    with rc_context({"text.usetex": True}), patch(
                        "matplotlib.texmanager.TexManager.make_dvi",
                        side_effect=AssertionError("TeX must not run"),
                    ), patch.object(render, "_apply_style", side_effect=check):
                        output = spec.render_csv_spec(case[1], frozen)
                    self.assertEqual(len(snapshots), 1)
                    self.assertEqual(frozen, original)
                    self.assertEqual(output.dataset_hash, frozen["dataset_sha256"])
                    self.assertEqual(output.style_id, style.id)
                    self.assertEqual(output.style_version, style.version)
                    self.assertEqual(output.dpi, 300)
                    self.assertEqual(len(output.style_sha256), 64)
                    self.assertEqual({a.format for a in output.artifacts}, {"png", "pdf", "svg"})
                    for artifact in output.artifacts:
                        self.assertEqual(artifact.sha256, sha256(artifact.content).hexdigest())
                        self.assertIn(style.version.encode(), artifact.content)
                    png = next(a.content for a in output.artifacts if a.format == "png")
                    width, height = struct.unpack(">II", png[16:24])
                    self.assertEqual((width, height), (round(output.width_inches * 300), 1650))

    def test_default_unchanged_explicit_standard_and_style_reproducibility(self):
        case = cases()[3]
        default = spec.render_csv_spec(case[1], plan(case))
        explicit = spec.render_csv_spec(case[1], plan(case, STANDARD_STYLE))
        self.assertEqual(default, explicit)
        hashes, fingerprints = {default.figure_spec_hash}, {default.style_sha256}
        for style in list(STYLES.values())[1:]:
            first = spec.render_csv_spec(case[1], plan(case, style))
            second = spec.render_csv_spec(case[1], plan(case, style))
            self.assertEqual(first, second)
            self.assertEqual(first.dataset_hash, default.dataset_hash)
            hashes.add(first.figure_spec_hash)
            fingerprints.add(first.style_sha256)
        self.assertEqual(len(hashes), 5)
        self.assertEqual(len(fingerprints), 5)

    def test_palette_covers_data_and_legend_without_changing_alpha_or_footer(self):
        # Capture a real grouped-bar export after applying the canonical style.
        apply = render._apply_style
        for style in list(STYLES.values())[1:]:
            def check(figure, selected):
                apply(figure, selected)
                axis = figure.axes[0]
                self.assertEqual(axis.patches[0].get_facecolor(), render.to_rgba(style.palette[0]))
                self.assertEqual(axis.patches[1].get_facecolor(), render.to_rgba(style.palette[1]))
                handles = axis.get_legend().legend_handles
                self.assertEqual(handles[0].get_facecolor(), axis.patches[0].get_facecolor())
                self.assertEqual(handles[1].get_facecolor(), axis.patches[1].get_facecolor())
            with patch.object(render, "_apply_style", side_effect=check):
                output = spec.render_csv_spec(cases()[0][1], plan(cases()[0], style))
            # PNG remains readable by an actual image decoder.
            with Image.open(BytesIO(output.artifacts[0].content)) as image:
                image.verify()

    def test_direct_renderer_rejects_forged_profile(self):
        with patch.object(render, "_apply_style") as apply:
            figure = render.Figure()
            with self.assertRaises(DatasetError):
                render._export_figure(figure, template_version="test", dataset_hash="x",
                                      parser_version="x", figure_spec_hash="x",
                                      style=replace(STYLES["nature"], dpi=100000))
            apply.assert_not_called()


if __name__ == "__main__":
    unittest.main()
