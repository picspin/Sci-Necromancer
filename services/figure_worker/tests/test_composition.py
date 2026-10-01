"""Synthetic mutually exclusive counts with explicit source denominators."""

import unittest
from dataclasses import replace
from decimal import Decimal, localcontext

from services.figure_worker.dataset import DatasetError, parse_csv_bytes, validate_composition
from services.figure_worker.render import _make_composition_figure, render_composition


class CompositionTests(unittest.TestCase):
    def data(self, payload=b"G,C,N,D\nA,Response,6,10\nA,Stable,4,10\nB,Response,3,5\nB,Stable,2,5\n", **changes):
        options = dict(group_column="col_1", component_column="col_2", count_column="col_3",
                       denominator_column="col_4", count_unit="patients", display="count",
                       denominator_scope="within-group", mutually_exclusive=True, exhaustive=True)
        return validate_composition(parse_csv_bytes(payload), **{**options, **changes})

    def test_explicit_denominators_preserve_counts_and_zero_components(self):
        data = self.data()
        self.assertEqual([c.count for c in data.cells], [Decimal(6), Decimal(4), Decimal(3), Decimal(2)])
        zero = self.data(b"G,C,N,D\nA,X,0,5\nA,Y,5,5\n")
        self.assertEqual(zero.cells[0].count, 0)

    def test_semantics_and_mapping_cannot_be_inferred(self):
        for change in ({"mutually_exclusive": False}, {"mutually_exclusive": 1}, {"exhaustive": False},
                       {"denominator_scope": "global"}, {"display": "proportion"},
                       {"count_unit": ""}, {"denominator_column": "col_3"}):
            with self.subTest(change=change), self.assertRaises(DatasetError):
                self.data(**change)

    def test_no_missing_fill_repeated_sum_normalization_or_fractional_counts(self):
        invalid = [
            (b"A,X,6,10\nA,Y,3,10\n", "composition_total_mismatch"),
            (b"A,X,6,10\nA,X,4,10\n", "duplicate_composition_cell"),
            (b"A,X,6,10\nA,Y,4,11\n", "inconsistent_composition_denominator"),
            (b"A,X,6,10\nA,Y,4,10\nB,X,5,5\n", "incomplete_composition_matrix"),
            (b"A,X,0,0\n", "invalid_composition_denominator"),
            (b"A,X,6,5\n", "invalid_composition_denominator"),
            (b"A,X,-1,5\n", "invalid_composition_count"),
            (b"A,X,0.5,1\n", "invalid_composition_count"),
            (b"A,X,NaN,1\n", "invalid_composition_count"),
            (b"A,X,,1\n", "invalid_composition_count"),
            (b"A,X,9007199254740992,9007199254740992\n", "invalid_composition_count"),
        ]
        for body, code in invalid:
            with self.subTest(code=code), self.assertRaises(DatasetError) as context:
                self.data(b"G,C,N,D\n" + body)
            self.assertEqual(context.exception.code, code)
        with self.assertRaises(DatasetError):
            self.data(b"G,C,N,D\n" + b"".join(f"A,C{i},1,9\n".encode() for i in range(9)))

    def test_draws_counts_or_percentages_with_visible_group_denominators(self):
        for display, heights in (("count", [6, 3, 4, 2]), ("percent", [60, 60, 40, 40])):
            figure = _make_composition_figure(self.data(display=display))
            try:
                axis = figure.axes[0]
                self.assertEqual([patch.get_height() for patch in axis.patches], heights)
                self.assertEqual([t.get_text() for t in axis.get_xticklabels()], ["A\n(n=10)", "B\n(n=5)"])
                self.assertEqual([p.get_y() for p in axis.patches], [0, 0, heights[0], heights[1]])
                self.assertEqual(axis.get_ylim()[0], 0)
                if display == "percent":
                    self.assertEqual(axis.get_ylim()[1], 100)
                self.assertIn("supplied within-group totals", figure.texts[0].get_text())
            finally:
                figure.clear()

    def test_artifacts_repeat_display_changes_identity_and_forged_data_is_rejected(self):
        data = self.data()
        first, second = render_composition(data), render_composition(data)
        self.assertEqual({a.format for a in first.artifacts}, {"png", "pdf", "svg"})
        self.assertEqual([a.sha256 for a in first.artifacts], [a.sha256 for a in second.artifacts])
        self.assertNotEqual(first.figure_spec_hash, render_composition(replace(data, display="percent")).figure_spec_hash)
        for forged in (replace(data, cells=data.cells[:-1]), replace(data, cells=data.cells * 2),
                       replace(data, cells=(replace(data.cells[0], count=Decimal("NaN")), *data.cells[1:]))):
            with self.assertRaises(DatasetError):
                render_composition(forged)
        with self.assertRaises(DatasetError):
            render_composition(replace(data, count_unit="患者"))

    def test_percentages_are_independent_of_ambient_decimal_precision(self):
        data = self.data(b"G,C,N,D\nA,X,2,3\nA,Y,1,3\n", display="percent")
        normal = _make_composition_figure(data)
        try:
            expected = [p.get_height() for p in normal.axes[0].patches]
        finally:
            normal.clear()
        with localcontext() as context:
            context.prec = 3
            figure = _make_composition_figure(data)
        try:
            self.assertEqual([p.get_height() for p in figure.axes[0].patches], expected)
        finally:
            figure.clear()


if __name__ == "__main__":
    unittest.main()
