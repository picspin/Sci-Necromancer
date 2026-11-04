"""Exact fixed-bin counts: no automatic bins, weights or omitted observations."""

from decimal import Decimal, Inexact, Rounded, localcontext
from dataclasses import replace
from copy import deepcopy
from hashlib import sha256
import json
import unittest

from services.figure_worker.dataset import (
    DatasetError, histogram_bin_counts, parse_csv_bytes, validate_distribution, validate_histogram_edges,
)
from services.figure_worker.render import _apply_style, _make_histogram_figure, render_distribution
from services.figure_worker.styles import STYLES
from services.figure_worker.spec import render_csv_spec
from services.figure_worker.tests.test_styles import scientific_snapshot


class HistogramInputTests(unittest.TestCase):
    def data(self):
        return validate_distribution(parse_csv_bytes(b"V,G\n0,A\n1,A\n1,A\n4,A\n10,A\n2,B\n2,B\n"),
                                     value_column="col_1", group_column="col_2", value_unit="mg",
                                     bin_edges=[0, 1, 2, 4, 10])

    def test_rendered_counts_shared_edges_labels_and_all_styles(self):
        figure = _make_histogram_figure(self.data())
        try:
            axis = figure.axes[0]
            self.assertEqual(axis.patches[0].get_data().values.tolist(), [1, 2, 0, 2])
            self.assertEqual(axis.patches[1].get_data().values.tolist(), [0, 0, 2, 0])
            for curve in axis.patches:
                self.assertEqual(curve.get_data().edges.tolist(), [0, 1, 2, 4, 10])
                self.assertFalse(curve.get_fill())
            self.assertEqual(axis.get_ylim()[0], 0)
            self.assertEqual([t.get_text() for t in axis.get_legend().get_texts()], ["A (n=5)", "B (n=2)"])
            self.assertIn("Every observation counted once", figure.texts[0].get_text())
        finally:
            figure.clear()
        for style in STYLES.values():
            figure = _make_histogram_figure(self.data())
            try:
                baseline = scientific_snapshot(figure)
                _apply_style(figure, style)
                self.assertEqual(scientific_snapshot(figure), baseline)
            finally:
                figure.clear()

    def test_documented_clinical_preview_counts_and_nejm_exports(self):
        observations = (("A", (0, 3, 5, 10, 10, 17, 25, 40)),
                        ("B", (2, 7, 7, 14, 22, 25, 31, 39)))
        payload = ("Diameter,Group\n" + "".join(f"{value},Synthetic {group}\n"
                   for group, values in observations for value in values)).encode()
        edges = [0, 5, 10, 20, 30, 40]
        data = validate_distribution(parse_csv_bytes(payload), value_column="col_1", group_column="col_2",
                                     value_unit="Synthetic lesion diameter (mm)", bin_edges=edges)
        expected = [(2, 1, 3, 1, 1), (1, 2, 1, 2, 2)]
        for (group, _), counts in zip(observations, expected):
            members = tuple(p.value for p in data.points if p.group == f"Synthetic {group}")
            self.assertEqual(histogram_bin_counts(members, data.bin_edges), counts)
            self.assertEqual(sum(counts), 8)
        figure = _make_histogram_figure(data)
        try:
            self.assertEqual([tuple(p.get_data().values) for p in figure.axes[0].patches], expected)
            self.assertEqual([t.get_text() for t in figure.axes[0].get_legend().get_texts()],
                             ["Synthetic A (n=8)", "Synthetic B (n=8)"])
        finally:
            figure.clear()
        plan = dict(schema_version="figure-spec-v1", template_id="distribution",
                    template_version="distribution-histogram-v1", dataset_sha256=sha256(payload).hexdigest(),
                    mapping={"value": "col_1", "group": "col_2"}, units={"value": data.value_unit},
                    distribution={"variant": "histogram", "bin_edges": edges},
                    style={"id": "nejm", "version": "nejm-inspired-v1"})
        result = render_csv_spec(payload, plan)
        self.assertEqual(result, render_distribution(data, style=STYLES["nejm"]))
        self.assertEqual([artifact.format for artifact in result.artifacts], ["png", "pdf", "svg"])

    def test_low_precision_noninteger_intake_edges_and_counts_are_exact(self):
        payload = b"Value\n100.6\n100.74\n100.75\n100.99\n101\n"
        raw_edges = ["100.5", "100.75", "101"]
        for precision in (1, 2):
            with self.subTest(precision=precision), localcontext() as context:
                context.prec = precision
                context.traps[Inexact] = True
                context.traps[Rounded] = True
                data = validate_distribution(parse_csv_bytes(payload), value_column="col_1", value_unit="mg",
                                             bin_edges=raw_edges)
                self.assertEqual([str(p.value) for p in data.points], ["100.6", "100.74", "100.75", "100.99", "101"])
                self.assertEqual([str(edge) for edge in data.bin_edges], raw_edges)
                self.assertEqual(histogram_bin_counts(tuple(p.value for p in data.points), data.bin_edges), (2, 3))
                self.assertFalse(context.flags[Inexact])
                self.assertFalse(context.flags[Rounded])

    def test_exports_and_forged_contracts(self):
        data = self.data()
        first = render_distribution(data)
        self.assertEqual(first, render_distribution(data))
        self.assertEqual(first.template_version, "distribution-histogram-v1")
        self.assertEqual([a.format for a in first.artifacts], ["png", "pdf", "svg"])
        for invalid in (replace(data, bin_edges=(Decimal(0), Decimal(2))),
                        replace(data, bin_edges=(Decimal(0), Decimal(0))), replace(data, group_column=None),
                        replace(data, bin_edges=("0", "10")), replace(data, value_unit=None)):
            with self.assertRaises(DatasetError):
                render_distribution(invalid)

    def test_constant_ungrouped_and_unplottable_range(self):
        data = validate_distribution(parse_csv_bytes(b"V\n2\n2\n2\n"), value_column="col_1",
                                     value_unit="score", bin_edges=[0, 1, 2, 3])
        figure = _make_histogram_figure(data)
        try:
            self.assertEqual(figure.axes[0].patches[0].get_data().values.tolist(), [0, 0, 3])
            self.assertEqual(figure.axes[0].get_legend().get_texts()[0].get_text(), "All observations (n=3)")
        finally:
            figure.clear()
        tiny = validate_distribution(parse_csv_bytes(b"V\n0\n"), value_column="col_1",
                                     value_unit="score", bin_edges=[0, "1e-308"])
        with self.assertRaises(DatasetError) as error:
            render_distribution(tiny)
        self.assertEqual(error.exception.code, "unplottable_histogram_range")

    def test_maximum_bins_groups_rows_and_excess_rejection(self):
        payload = ("V,G\n" + "".join(f"{i % 51},G{i % 8}\n" for i in range(5000))).encode()
        kwargs = dict(value_column="col_1", group_column="col_2", value_unit="score", bin_edges=list(range(51)))
        data = validate_distribution(parse_csv_bytes(payload), **kwargs)
        figure = _make_histogram_figure(data)
        try:
            self.assertEqual(len(figure.axes[0].patches), 8)
            self.assertEqual(sum(sum(p.get_data().values) for p in figure.axes[0].patches), 5000)
        finally:
            figure.clear()
        with self.assertRaises(DatasetError):
            validate_distribution(parse_csv_bytes(payload + b"1,G0\n"), **kwargs)
        with self.assertRaises(DatasetError):
            validate_distribution(parse_csv_bytes(b"V,G\n1,A\n1,B\n1,C\n1,D\n1,E\n1,F\n1,G\n1,H\n1,I\n"), **kwargs)

    def test_frozen_plan_versions_hash_style_and_legacy_box(self):
        payload = b"V,G\n0,A\n1,A\n2,B\n"
        spec = dict(schema_version="figure-spec-v1", template_id="distribution",
                    template_version="distribution-histogram-v1", dataset_sha256=sha256(payload).hexdigest(),
                    mapping={"value": "col_1", "group": "col_2"}, units={"value": "mg"},
                    distribution={"variant": "histogram", "bin_edges": [0, 1, 2]})
        frozen = deepcopy(spec)
        first = render_csv_spec(payload, spec)
        self.assertEqual(spec, frozen)
        self.assertEqual(first, render_csv_spec(payload, spec))
        changed = deepcopy(spec)
        changed["distribution"]["bin_edges"] = [0, 0.5, 2]
        self.assertNotEqual(first.figure_spec_hash, render_csv_spec(payload, changed).figure_spec_hash)
        for style in STYLES.values():
            changed = {**spec, "style": {"id": style.id, "version": style.version}}
            result = render_csv_spec(payload, changed)
            self.assertEqual(result.style_id, style.id)
            self.assertEqual([a.format for a in result.artifacts], ["png", "pdf", "svg"])
            self.assertEqual(result, render_csv_spec(payload, changed))
        legacy = {k: v for k, v in spec.items() if k != "distribution"}
        legacy["template_version"] = "distribution-box-scatter-v1"
        box = validate_distribution(parse_csv_bytes(payload), value_column="col_1", group_column="col_2", value_unit="mg")
        self.assertEqual(render_csv_spec(payload, legacy), render_distribution(box))
        # Independent snapshot of the pre-histogram scientific hash contract.
        expected = dict(template_version="distribution-box-scatter-v1", dataset_hash=box.dataset_hash,
                        value_column="col_1", group_column="col_2", value_unit="mg",
                        quartiles="HF7-exact-rational-to-binary64", whiskers="observed-within-1.5-IQR",
                        jitter="source-order-even-spread-width0.3", ordering="first-observed",
                        sampling="none", deletion="none", kde="none", tests="none",
                        points=[(str(p.value), p.group) for p in box.points])
        self.assertEqual(render_distribution(box).figure_spec_hash,
                         sha256(json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest())

    def test_invalid_plan_options_and_cross_template_options_fail(self):
        payload = b"V\n1\n"
        spec = dict(schema_version="figure-spec-v1", template_id="distribution",
                    template_version="distribution-histogram-v1", dataset_sha256=sha256(payload).hexdigest(),
                    mapping={"value": "col_1"}, units={"value": "mg"},
                    distribution={"variant": "histogram", "bin_edges": [0, 2]})
        for option in (None, {}, {"variant": "kde", "bin_edges": [0, 2]},
                       {"variant": "histogram", "bin_edges": "auto"},
                       {"variant": "histogram", "bin_edges": [0, 2], "density": True},
                       {"variant": "histogram", "bin_edges": [False, 2]}):
            with self.subTest(option=option), self.assertRaises(DatasetError):
                render_csv_spec(payload, {**spec, "distribution": option})
        for changes in ({"template_version": "distribution-box-scatter-v1"},
                        {"template_id": "scatter", "template_version": "scatter-v1"},
                        {"dataset_sha256": "0" * 64}):
            with self.assertRaises(DatasetError):
                render_csv_spec(payload, {**spec, **changes})
        with self.assertRaises(DatasetError):
            render_csv_spec(payload, {k: v for k, v in spec.items() if k != "distribution"})
    def test_exact_boundaries_empty_bins_final_endpoint_and_context(self):
        edges = tuple(map(Decimal, (0, 1, 2, 4, 10)))
        values = tuple(map(Decimal, (0, 1, 1, 4, 10)))
        self.assertEqual(histogram_bin_counts(values, edges), (1, 2, 0, 2))
        with localcontext() as context:
            context.prec = 2
            self.assertEqual(histogram_bin_counts(values, edges), (1, 2, 0, 2))
        # Decimal assignment does not round a source value up to the next bin.
        close = (Decimal("0.9999999999999999999999999999999"), Decimal(1))
        self.assertEqual(histogram_bin_counts(close, (Decimal(0), Decimal(1), Decimal(2))), (1, 1))

    def test_rejects_invalid_or_collapsed_bins(self):
        for edges in (None, "auto", [], [0], [0, 0], [1, 0], [False, 2], [0, None],
                      [0, "NaN"], [0, "1e500"], [0, "1e-500"], [0, "oops"],
                      ["1", "1.000000000000000000001"], list(range(52)), ["-1.7e308", "1.7e308"]):
            with self.subTest(edges=edges), self.assertRaises(DatasetError):
                validate_histogram_edges(edges)
        self.assertEqual(len(validate_histogram_edges(list(range(51)))), 51)
        with self.assertRaises(DatasetError):
            validate_histogram_edges([0, 10**5000])

    def test_intake_retains_all_rows_and_rejects_outside_or_missing(self):
        dataset = parse_csv_bytes(b"V,G\n0,A\n1,A\n2,A\n2,B\n")
        kwargs = dict(value_column="col_1", group_column="col_2", value_unit="mg", bin_edges=[0, 1, 2])
        data = validate_distribution(dataset, **kwargs)
        self.assertEqual(data.bin_edges, (Decimal(0), Decimal(1), Decimal(2)))
        self.assertEqual(len(data.points), 4)
        self.assertEqual(histogram_bin_counts(tuple(p.value for p in data.points), data.bin_edges), (1, 3))
        for payload in (b"V,G\n-1,A\n", b"V,G\n3,A\n", b"V,G\n,A\n"):
            with self.assertRaises(DatasetError):
                validate_distribution(parse_csv_bytes(payload), **kwargs)
        for values in ((), (Decimal("NaN"),), (Decimal(3),), (Decimal("1e-500"),)):
            with self.assertRaises(DatasetError):
                histogram_bin_counts(values, data.bin_edges)


if __name__ == "__main__":
    unittest.main()
