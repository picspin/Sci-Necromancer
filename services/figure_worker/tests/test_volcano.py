"""Synthetic existing differential results, not an upstream analysis pipeline."""

import unittest
from dataclasses import replace
from decimal import Decimal, localcontext

from services.figure_worker.dataset import DatasetError, parse_csv_bytes, validate_volcano, volcano_ordinate
from services.figure_worker.render import _make_volcano_figure, render_volcano


class VolcanoTests(unittest.TestCase):
    def data(self, payload=b"ID,FC,P\nA,-2,0.001\nB,2,0.01\nC,0.2,0.1\n", **changes):
        options = dict(identifier_column="col_1", log2fc_column="col_2", p_column="col_3",
                       p_kind="adjusted_p", p_threshold="0.05", fold_threshold=1)
        return validate_volcano(parse_csv_bytes(payload), **{**options, **changes})

    def test_preserves_p_values_including_zeros_and_extremely_small_positive_p(self):
        data = self.data(b"ID,FC,P\nZero,2,0\nTiny,-2,1e-999\n", zero_p_floor="1e-1000")
        self.assertEqual(data.points[0].p_value, Decimal(0))
        self.assertEqual(data.points[1].p_value, Decimal("1e-999"))
        self.assertEqual(volcano_ordinate(data.points[1].p_value), 999)
        baseline = volcano_ordinate(Decimal("0.000123456789"))
        with localcontext() as context:
            context.prec = 3
            self.assertEqual(volcano_ordinate(Decimal("0.000123456789")), baseline)
        self.assertEqual(volcano_ordinate(Decimal(1)), 0)

    def test_zero_requires_declared_floor_no_positive_p_is_clipped(self):
        for payload, options, code in (
            (b"ID,FC,P\nA,1,0\n", {}, "volcano_zero_floor_required"),
            (b"ID,FC,P\nA,1,1e-8\n", {"zero_p_floor": "1e-5"}, "volcano_floor_above_observed_p"),
            (b"ID,FC,P\nA,1,-0.01\n", {}, "invalid_volcano_p"),
            (b"ID,FC,P\nA,1,1.1\n", {}, "invalid_volcano_p"),
        ):
            with self.subTest(code=code), self.assertRaises(DatasetError) as context:
                self.data(payload, **options)
            self.assertEqual(context.exception.code, code)

    def test_rejects_ambiguous_thresholds_missing_duplicate_and_nonfinite_results(self):
        for change in ({"p_kind": "infer"}, {"p_threshold": 0}, {"p_threshold": 1},
                       {"fold_threshold": 0}, {"fold_threshold": True}, {"zero_p_floor": "0.1"},
                       {"p_threshold": "NaN"}, {"log2fc_column": "col_3"}):
            with self.subTest(change=change), self.assertRaises(DatasetError):
                self.data(**change)
        for payload in (b"ID,FC,P\nA,1,0.1\nA,2,0.2\n", b"ID,FC,P\nA,,0.1\n",
                        b"ID,FC,P\nA,1,NaN\n", b"ID,FC,P\nA,Infinity,0.1\n",
                        b"ID,FC,P\nA,1e-999,0.1\n"):
            with self.subTest(payload=payload), self.assertRaises(DatasetError):
                self.data(payload)

    def test_known_coordinates_thresholds_and_zero_disclosure(self):
        data = self.data(b"ID,FC,P\nA,-2,0.001\nB,2,0.01\nC,0.2,0.1\nZero,3,0\n", zero_p_floor="0.0001")
        figure = _make_volcano_figure(data)
        try:
            axis = figure.axes[0]
            coordinates = sorted(tuple(map(float, offset)) for artist in axis.collections for offset in artist.get_offsets())
            self.assertEqual(coordinates, [(-2, 3), (0.2, 1), (2, 2), (3, 4)])
            self.assertEqual(axis.get_ylabel(), "-log10(adjusted P)")
            self.assertEqual(list(axis.lines[0].get_xdata()), [-1, -1])
            self.assertEqual(list(axis.lines[1].get_xdata()), [1, 1])
            self.assertAlmostEqual(axis.lines[2].get_ydata()[0], volcano_ordinate(Decimal("0.05")))
            self.assertIn("Zero P values: 1", figure.texts[0].get_text())
            self.assertIn("0.0001", figure.texts[0].get_text())
            self.assertEqual(data.points[-1].p_value, 0)
        finally:
            figure.clear()

    def test_repeatable_formats_semantic_identity_and_renderer_revalidation(self):
        data = self.data()
        first, second = render_volcano(data), render_volcano(data)
        self.assertEqual({a.format for a in first.artifacts}, {"png", "pdf", "svg"})
        self.assertEqual([a.sha256 for a in first.artifacts], [a.sha256 for a in second.artifacts])
        self.assertNotEqual(first.figure_spec_hash, render_volcano(replace(data, p_kind="p")).figure_spec_hash)
        self.assertNotEqual(first.figure_spec_hash, render_volcano(replace(data, fold_threshold=Decimal(2))).figure_spec_hash)
        for bad in (replace(data, points=data.points * 2),
                    replace(data, points=(replace(data.points[0], p_value=Decimal(0)),)),
                    replace(data, p_threshold=Decimal("NaN"))):
            with self.assertRaises(DatasetError):
                render_volcano(bad)

    def test_threshold_classification_does_not_round_source_fold_change(self):
        data = self.data(b"ID,FC,P\nBelow,-0.99999,0.001\nAt,1,0.001\n")
        with localcontext() as context:
            context.prec = 3
            figure = _make_volcano_figure(data)
        try:
            labels = [artist.get_label() for artist in figure.axes[0].collections]
            self.assertEqual(labels, ["Other", "Thresholds met / positive"])
        finally:
            figure.clear()


if __name__ == "__main__":
    unittest.main()
