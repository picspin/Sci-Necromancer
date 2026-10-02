"""Synthetic existing metrics with explicit per-axis normalization metadata."""

import csv
from dataclasses import replace
from decimal import Decimal, localcontext
from hashlib import sha256
from io import StringIO
import unittest
from unittest.mock import patch

from services.figure_worker.dataset import DatasetError, parse_csv_bytes, radar_normalized, validate_radar_axes, validate_radar
from services.figure_worker.render import _make_radar_figure, render_radar
from services.figure_worker import spec
from services.figure_worker.styles import STYLES


def axes():
    return [dict(metric="AUC", unit="ratio", lower=0, upper=1, direction="higher"),
            dict(metric="Time", unit="seconds", lower=0, upper=100, direction="lower"),
            dict(metric="Error", unit="mm", lower=-5, upper=5, direction="lower")]


class RadarAxisTests(unittest.TestCase):
    def test_known_directions_endpoints_and_precision_independence(self):
        a, b, c = validate_radar_axes(axes())
        self.assertEqual(radar_normalized(Decimal("0.75"), a), 0.75)
        self.assertEqual(radar_normalized(Decimal(25), b), 0.75)
        self.assertEqual(radar_normalized(Decimal(-2), c), 0.7)
        self.assertEqual(radar_normalized(a.lower, a), 0)
        self.assertEqual(radar_normalized(a.upper, a), 1)
        self.assertEqual(radar_normalized(b.lower, b), 1)
        self.assertEqual(radar_normalized(b.upper, b), 0)
        with localcontext() as ctx:
            ctx.prec = 1
            self.assertEqual(radar_normalized(Decimal(-2), c), 0.7)
        zero = axes()
        zero[0]["lower"] = "0e-999999999"
        self.assertEqual(radar_normalized(Decimal(0), validate_radar_axes(zero)[0]), 0)

    def test_rejects_missing_duplicate_unbounded_or_ambiguous_axes(self):
        for invalid in (None, axes()[:2], axes() + [axes()[0]],
                        [{**a, "expression": "x"} for a in axes()],
                        [{**a, "lower": True} for a in axes()],
                        [{**a, "lower": "NaN"} for a in axes()],
                        [{**a, "direction": "infer"} for a in axes()],
                        [{**a, "upper": a["lower"]} for a in axes()]):
            with self.subTest(invalid=invalid), self.assertRaises(DatasetError):
                validate_radar_axes(invalid)
        for value in (Decimal(-1), Decimal(2), Decimal("NaN"), Decimal("1e-999999")):
            with self.assertRaises(DatasetError):
                radar_normalized(value, validate_radar_axes(axes())[0])


class RadarInputTests(unittest.TestCase):
    def data(self, payload=b"Method,Metric,Value\nA,AUC,0.75\nA,Time,25\nA,Error,-2\n", **changes):
        return validate_radar(parse_csv_bytes(payload), **{
            "method_column": "col_1", "metric_column": "col_2", "value_column": "col_3", "axes": axes(), **changes,
        })

    def test_preserves_source_values_and_requires_complete_per_method_matrix(self):
        data = self.data()
        self.assertEqual([p.value for p in data.points], [Decimal("0.75"), Decimal(25), Decimal(-2)])
        self.assertEqual([a.metric for a in data.axes], ["AUC", "Time", "Error"])
        for invalid in (b"M,T,V\nA,AUC,0.5\nA,Time,25\n",
                        b"M,T,V\nA,AUC,0.5\nA,AUC,0.6\nA,Time,25\nA,Error,0\n",
                        b"M,T,V\nA,AUC,0.5\nA,Time,25\nA,Error,0\nB,AUC,0.8\n",
                        b"M,T,V\nA,AUC,0.5\nA,Time,25\nA,Unknown,0\n",
                        b"M,T,V\nA,AUC,0.5\nA,Time,25\nA,Error,10\n",
                        b"M,T,V\nA,AUC,0.5\nA,Time,25\nA,Error,\n"):
            with self.subTest(payload=invalid), self.assertRaises(DatasetError):
                self.data(invalid)

    def test_no_method_sampling_or_mapping_guess(self):
        with self.assertRaises(DatasetError):
            self.data(method_column="col_2")
        with self.assertRaises(DatasetError):
            self.data(value_column="col_99")
        payload = "M,T,V\n" + "".join(f"M{i},AUC,0.5\nM{i},Time,25\nM{i},Error,0\n" for i in range(5))
        with self.assertRaises(DatasetError):
            self.data(payload.encode())

    def test_raw_csv_and_plot_values_match_explicit_axes_without_ranking(self):
        data = self.data()
        figure = _make_radar_figure(data)
        try:
            axis = figure.axes[0]
            self.assertEqual(axis.get_ylim(), (0, 1))
            self.assertEqual(axis.lines[0].get_ydata().tolist(), [0.75, 0.75, 0.7, 0.75])
            self.assertIn("No aggregate score", figure.texts[0].get_text())
        finally:
            figure.clear()
        output = render_radar(data)
        self.assertEqual(output, render_radar(data))
        self.assertEqual({a.format for a in output.artifacts}, {"png", "pdf", "svg"})
        table = output.data_table
        self.assertEqual(table.sha256, sha256(table.content).hexdigest())
        records = list(csv.DictReader(StringIO(table.content.decode())))
        self.assertEqual([Decimal(r["raw_value"]) for r in records], [p.value for p in data.points])
        self.assertEqual([float(r["normalized"]) for r in records], [0.75, 0.75, 0.7])
        self.assertEqual(records[1]["unit"], "seconds")
        self.assertEqual(records[1]["direction"], "lower")
        self.assertEqual(table, render_radar(data, style=STYLES["nature"]).data_table)

    def test_axis_order_changes_identity_not_raw_measurements(self):
        data = self.data()
        output = render_radar(data)
        reordered = render_radar(replace(data, axes=tuple(reversed(data.axes))))
        self.assertNotEqual(output.figure_spec_hash, reordered.figure_spec_hash)
        self.assertEqual(output.data_table, reordered.data_table)
        self.assertEqual(output.dataset_hash, reordered.dataset_hash)
        alternative = axes()
        alternative[1]["upper"] = 200
        self.assertNotEqual(output.figure_spec_hash, render_radar(self.data(axes=alternative)).figure_spec_hash)

    def test_csv_formula_labels_are_escaped_without_corrupting_numeric_sign(self):
        data = self.data(b"M,T,V\n=1+2,AUC,0.75\n=1+2,Time,25\n=1+2,Error,-2\n")
        table = render_radar(data).data_table
        records = list(csv.DictReader(StringIO(table.content.decode())))
        self.assertEqual({r["method"] for r in records}, {"'=1+2"})
        self.assertEqual({r["escaped_text_fields"] for r in records}, {"method"})
        self.assertEqual(records[-1]["raw_value"], "-2")

    def test_direct_forged_missing_duplicate_and_unrenderable_contracts_rejected(self):
        data = self.data()
        for invalid in (replace(data, points=data.points[:-1]), replace(data, points=data.points * 2),
                        replace(data, axes=data.axes[:2]), replace(data, template_id="score"),
                        replace(data, axes=(replace(data.axes[0], lower=Decimal("NaN")), *data.axes[1:]))):
            with self.subTest(data=invalid), self.assertRaises(DatasetError):
                render_radar(invalid)
        with self.assertRaises(DatasetError):
            render_radar(replace(data, points=(replace(data.points[0], method="\u60a3\u8005"), *data.points[1:])))

    def test_plan_requires_axis_metadata_and_forbids_executable_or_cross_template_options(self):
        payload = b"M,T,V\nA,AUC,0.75\nA,Time,25\nA,Error,-2\n"
        base = dict(schema_version=spec.SCHEMA_VERSION, template_id="radar",
                    template_version=spec.TEMPLATE_VERSIONS["radar"], dataset_sha256=sha256(payload).hexdigest(),
                    mapping={"method": "col_1", "metric": "col_2", "value": "col_3"}, units={})
        for change in ({}, {"radar": {"axes": axes(), "script": "x"}},
                       {"radar": {"axes": axes()}, "units": {"value": "infer"}},
                       {"radar": {"axes": axes()}, "volcano": {}}):
            with self.subTest(change=change), self.assertRaises(DatasetError):
                spec.render_csv_spec(payload, {**base, **change})
        wrong = {**base, "radar": {"axes": axes()}, "dataset_sha256": "0" * 64}
        with patch.object(spec, "render_radar") as render:
            with self.assertRaises(DatasetError):
                spec.render_csv_spec(payload, wrong)
            render.assert_not_called()

    def test_full_axis_method_bound_and_unplottable_normalization(self):
        configs = [dict(metric=f"Metric{i}", unit="score", lower=0, upper=100, direction="higher") for i in range(8)]
        payload = "M,T,V\n" + "".join(f"M{m},Metric{i},{10 * (i + 1)}\n" for m in range(4) for i in range(8))
        result = render_radar(self.data(payload.encode(), axes=configs))
        self.assertEqual(len(list(csv.DictReader(StringIO(result.data_table.content.decode())))), 32)
        with self.assertRaises(DatasetError):
            validate_radar_axes(configs + [dict(metric="Metric8", unit="score", lower=0, upper=100, direction="higher")])
        bounds = axes()
        bounds[0]["upper"] = "1e308"
        with self.assertRaises(DatasetError):
            radar_normalized(Decimal("1e-308"), validate_radar_axes(bounds)[0])


if __name__ == "__main__":
    unittest.main()
