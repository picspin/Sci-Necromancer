"""Known synthetic scores; no real research data or enrichment operations."""

import unittest
from dataclasses import replace
from decimal import Decimal
from unittest.mock import patch

from services.figure_worker.dataset import DatasetError, parse_csv_bytes, validate_ranked
from services.figure_worker.render import _make_ranked_figure, render_ranked


class RankedTests(unittest.TestCase):
    def data(self, payload=b"Label,Value,Group\nA,3,X\nB,3,Y\nC,-2,X\nD,5,Y\n", **changes):
        options = dict(label_column="col_1", value_column="col_2", group_column="col_3",
                       value_unit="supplied score", ordering="descending", top_n=2)
        return validate_ranked(parse_csv_bytes(payload), **{**options, **changes})

    def test_preserves_all_scores_before_selection(self):
        data = self.data()
        self.assertEqual([p.value for p in data.points], [Decimal(3), Decimal(3), Decimal(-2), Decimal(5)])
        self.assertEqual(len(data.points), 4)
        self.assertNotIn("supplied score", repr(data.points))

    def test_invalid_selection_mapping_and_every_source_row_are_checked(self):
        for changes in ({"top_n": True}, {"top_n": 25}, {"top_n": 0}, {"ordering": "best"},
                        {"value_column": "col_1"}, {"value_unit": ""}):
            with self.subTest(changes=changes), self.assertRaises(DatasetError):
                self.data(**changes)
        for payload in (b"L,V,G\nA,3,X\nA,2,Y\n", b"L,V,G\nA,3,X\nB,NaN,Y\n",
                        b"L,V,G\nA,3,X\nB,,Y\n", b"L,V,G\nA,3,X\nB,2,\n"):
            with self.subTest(payload=payload), self.assertRaises(DatasetError):
                self.data(payload)
        with patch("services.figure_worker.dataset.MAX_SCATTER_POINTS", 1), self.assertRaises(DatasetError):
            self.data()

    def test_explicit_order_ties_negative_values_and_omissions_are_visible(self):
        for order, expected in (("descending", ["D", "A", "B"]),
                                ("ascending", ["C", "A", "B"]), ("source", ["A", "B", "C"])):
            figure = _make_ranked_figure(self.data(ordering=order, top_n=3))
            try:
                axis = figure.axes[0]
                self.assertEqual([t.get_text() for t in axis.get_yticklabels()], expected)
                displayed = [float(x) for artist in axis.collections if hasattr(artist, "get_offsets")
                             and artist.__class__.__name__ == "PathCollection"
                             for x, _ in artist.get_offsets()]
                values = {"A": 3, "B": 3, "C": -2, "D": 5}
                self.assertEqual(sorted(displayed), sorted(values[label] for label in expected))
                self.assertIn("Shown 3 of 4; omitted 1", figure.texts[0].get_text())
                self.assertLessEqual(axis.get_xlim()[0], 0)
                self.assertGreaterEqual(axis.get_xlim()[1], 0)
            finally:
                figure.clear()

    def test_formats_repeat_and_selection_is_part_of_identity(self):
        data = self.data()
        first, second = render_ranked(data), render_ranked(data)
        self.assertEqual({a.format for a in first.artifacts}, {"png", "pdf", "svg"})
        self.assertEqual([a.sha256 for a in first.artifacts], [a.sha256 for a in second.artifacts])
        self.assertNotEqual(first.figure_spec_hash, render_ranked(replace(data, top_n=3)).figure_spec_hash)
        self.assertNotEqual(first.figure_spec_hash, render_ranked(replace(data, ordering="source")).figure_spec_hash)
        for invalid in (replace(data, top_n=True), replace(data, points=data.points * 2)):
            with self.assertRaises(DatasetError):
                render_ranked(invalid)
        with self.assertRaises(DatasetError):
            render_ranked(self.data(b"L,V,G\n\xe6\x82\xa3\xe8\x80\x85,2,X\n"))


if __name__ == "__main__":
    unittest.main()
