"""Synthetic FigureSpec boundary tests; no authentication or provider requests."""

import copy
from hashlib import sha256
import unittest
from unittest.mock import patch

from matplotlib import rc_context

from services.figure_worker.dataset import DatasetError
from services.figure_worker import spec as figures


class FigureSpecTests(unittest.TestCase):
    def plan(self, payload, template, mapping, units, **extra):
        return dict(schema_version="figure-spec-v1", template_id=template,
                    template_version=figures.TEMPLATE_VERSIONS[template],
                    dataset_sha256=sha256(payload).hexdigest(), mapping=mapping, units=units, **extra)

    def test_every_installed_template_runs_csv_to_three_artifacts(self):
        cases = [
            ("distribution", b"V,G\n1,A\n4,A\n9,A\n", {"value": "col_1", "group": "col_2"}, {"value": "score"}, {}),
            ("grouped-bar", b"C,V\nA,2\n", {"category": "col_1", "value": "col_2"}, {"value": "patients"}, {}),
            ("scatter", b"X,Y\n1,2\n", {"x": "col_1", "y": "col_2"}, {"x": "mm", "y": "score"}, {}),
            ("heatmap", b"R,C,V\nA,X,2\n", {"row": "col_1", "column": "col_2", "value": "col_3"}, {"value": "score"}, {}),
            ("trend", b"X,V\n1,3\n2,8\n", {"x": "col_1", "value": "col_2"}, {"x": "weeks", "value": "patients"}, {}),
            ("dot-interval", b"L,E,Low,High\nA,2,1,3\n", {"label": "col_1", "estimate": "col_2", "lower": "col_3", "upper": "col_4"}, {"value": "score"}, {"interval": {"type": "CI", "ci_level": 95}}),
            ("forest", b"L,E,Low,High\nA,1.2,0.9,1.8\n", {"label": "col_1", "estimate": "col_2", "lower": "col_3", "upper": "col_4"}, {"value": "OR"}, {"interval": {"type": "CI", "ci_level": 95, "effect_type": "OR"}}),
            ("ranked-lollipop", b"L,V\nA,3\nB,5\n", {"label": "col_1", "value": "col_2"}, {"value": "score"}, {"ranking": {"ordering": "descending", "top_n": 1}}),
            ("composition", b"G,C,N,D\nA,X,2,5\nA,Y,3,5\n", {"group": "col_1", "component": "col_2", "count": "col_3", "denominator": "col_4"}, {"count": "patients"}, {"composition": {"display": "percent", "denominator_scope": "within-group", "mutually_exclusive": True, "exhaustive": True}}),
            ("volcano", b"ID,FC,P\nA,-2,0.001\nB,2,0\n", {"identifier": "col_1", "log2fc": "col_2", "p": "col_3"}, {"log2fc": "log2 fold change", "p": "probability"}, {"volcano": {"p_kind": "adjusted_p", "p_threshold": "0.05", "fold_threshold": 1, "zero_p_floor": "0.0001"}}),
        ]
        self.assertEqual({case[0] for case in cases}, set(figures.TEMPLATE_VERSIONS))
        for template, payload, mapping, units, extra in cases:
            with self.subTest(template=template):
                plan = self.plan(payload, template, mapping, units, **extra)
                snapshot = copy.deepcopy(plan)
                with rc_context({"text.usetex": True}), patch(
                    "matplotlib.texmanager.TexManager.make_dvi",
                    side_effect=AssertionError("external TeX execution is forbidden"),
                ):
                    result = figures.render_csv_spec(payload, plan)
                self.assertEqual(plan, snapshot)
                self.assertEqual(result.dataset_hash, sha256(payload).hexdigest())
                self.assertEqual(result.template_version, plan["template_version"])
                artifacts = {artifact.format: artifact for artifact in result.artifacts}
                self.assertEqual(set(artifacts), {"png", "pdf", "svg"})
                self.assertTrue(artifacts["png"].content.startswith(b"\x89PNG\r\n\x1a\n"))
                self.assertTrue(artifacts["pdf"].content.startswith(b"%PDF-"))
                self.assertIn(b"<svg", artifacts["svg"].content[:2000])
                for artifact in result.artifacts:
                    self.assertEqual(artifact.sha256, sha256(artifact.content).hexdigest())

    def test_forbids_executable_payload_paths_urls_and_invented_values(self):
        payload = b"C,V\nA,2\n"
        base = self.plan(payload, "grouped-bar", {"category": "col_1", "value": "col_2"}, {"value": "patients"})
        for field in ("script", "python", "path", "url", "raw_values", "transform", "styles"):
            with self.subTest(field=field), self.assertRaises(DatasetError) as context:
                figures.render_csv_spec(payload, {**base, field: "untrusted"})
            self.assertEqual(context.exception.code, "invalid_figure_spec_fields")

    def test_hash_mismatch_fails_before_renderer_execution(self):
        payload = b"C,V\nA,2\n"
        plan = self.plan(payload, "grouped-bar", {"category": "col_1", "value": "col_2"}, {"value": "patients"})
        with patch.object(figures, "render_grouped_bar") as render:
            with self.assertRaises(DatasetError) as context:
                figures.render_csv_spec(b"C,V\nA,9\n", plan)
            self.assertEqual(context.exception.code, "figure_dataset_hash_mismatch")
            render.assert_not_called()

    def test_version_mapping_unit_and_uninstalled_template_are_rejected(self):
        payload = b"C,V\nA,2\n"
        base = self.plan(payload, "grouped-bar", {"category": "col_1", "value": "col_2"}, {"value": "patients"})
        for change, code in [
            ({"schema_version": "figure-spec-v2"}, "unsupported_figure_spec_version"),
            ({"template_version": "grouped-bar-v9"}, "unsupported_figure_template_version"),
            ({"template_id": "not-installed"}, "unavailable_figure_template"),
            ({"template_id": []}, "unavailable_figure_template"),
            ({"dataset_sha256": "not-a-hash"}, "invalid_figure_dataset_hash"),
            ({"mapping": {"category": "col_1", "value": "col_2", "url": "x"}}, "invalid_figure_spec_mapping"),
            ({"mapping": {"category": "col_1", "value": "../../file"}}, "invalid_figure_spec_mapping"),
            ({"mapping": {"category": "col_1", "value": "col_101"}}, "invalid_figure_spec_mapping"),
            ({"units": {"value": "patients", "unknown": "x"}}, "invalid_figure_spec_units"),
            ({"interval": {"type": "CI"}}, "invalid_figure_spec_fields"),
        ]:
            with self.subTest(change=change), self.assertRaises(DatasetError) as context:
                figures.render_csv_spec(payload, {**base, **change})
            self.assertEqual(context.exception.code, code)

    def test_interval_metadata_is_required_and_cannot_contain_scripts_or_fake_ci(self):
        payload = b"L,E,Low,High\nA,2,1,3\n"
        base = self.plan(payload, "dot-interval", {"label": "col_1", "estimate": "col_2", "lower": "col_3", "upper": "col_4"}, {"value": "score"})
        for interval in (None, {"type": "CI", "script": "x"}, {"type": "CI", "ci_level": True}):
            with self.subTest(interval=interval), self.assertRaises(DatasetError) as context:
                figures.render_csv_spec(payload, {**base, "interval": interval})
            self.assertEqual(context.exception.code, "invalid_figure_spec_interval")
        with self.assertRaises(DatasetError) as context:
            figures.render_csv_spec(payload, {**base, "interval": {"type": "CI"}})
        self.assertEqual(context.exception.code, "invalid_interval_ci_level")

    def test_ranking_requires_explicit_bounded_selection_and_rejects_cross_template_options(self):
        payload = b"L,V\nA,2\n"
        base = self.plan(payload, "ranked-lollipop", {"label": "col_1", "value": "col_2"}, {"value": "score"})
        for ranking in (None, {"ordering": "descending"}, {"ordering": "source", "top_n": True},
                        {"ordering": "source", "top_n": 1, "script": "x"}):
            with self.subTest(ranking=ranking), self.assertRaises(DatasetError):
                figures.render_csv_spec(payload, {**base, "ranking": ranking})
        for ranking in ({"ordering": "best", "top_n": 1}, {"ordering": "source", "top_n": 25}):
            with self.assertRaises(DatasetError):
                figures.render_csv_spec(payload, {**base, "ranking": ranking})
        with self.assertRaises(DatasetError):
            figures.render_csv_spec(payload, {**base, "ranking": {"ordering": "source", "top_n": 1},
                                             "interval": {"type": "CI"}})

    def test_composition_requires_confirmation_not_a_model_assumed_denominator(self):
        payload = b"G,C,N,D\nA,X,2,2\n"
        base = self.plan(payload, "composition", {"group": "col_1", "component": "col_2",
                         "count": "col_3", "denominator": "col_4"}, {"count": "patients"})
        valid = dict(display="count", denominator_scope="within-group", mutually_exclusive=True, exhaustive=True)
        for options in (None, {**valid, "exhaustive": False}, {**valid, "mutually_exclusive": 1},
                        {**valid, "denominator_scope": "global"}, {**valid, "script": "x"}):
            with self.subTest(options=options), self.assertRaises(DatasetError):
                figures.render_csv_spec(payload, {**base, "composition": options})

    def test_volcano_requires_supplied_log2fc_p_semantics_and_thresholds(self):
        payload = b"ID,FC,P\nA,2,0.01\n"
        base = self.plan(payload, "volcano", {"identifier": "col_1", "log2fc": "col_2", "p": "col_3"},
                         {"log2fc": "log2 fold change", "p": "probability"})
        valid = dict(p_kind="p", p_threshold="0.05", fold_threshold=1)
        for options in (None, {**valid, "fold_threshold": True}, {**valid, "p_kind": "calculate_FDR"},
                        {**valid, "script": "x"}, {**valid, "p_threshold": {"expr": "x"}}):
            with self.subTest(options=options), self.assertRaises(DatasetError):
                figures.render_csv_spec(payload, {**base, "volcano": options})
        with self.assertRaises(DatasetError):
            figures.render_csv_spec(payload, {**base, "volcano": valid, "units": {"log2fc": "raw FC", "p": "percent"}})


if __name__ == "__main__":
    unittest.main()
