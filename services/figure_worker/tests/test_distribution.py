"""All observations retained, including synthetic extremes and constant groups."""

from dataclasses import replace
from decimal import Decimal, localcontext
import unittest
from unittest.mock import patch

from services.figure_worker.dataset import DatasetError, distribution_box_stats, parse_csv_bytes, validate_distribution
from services.figure_worker.render import _make_distribution_figure, render_distribution


class DistributionInputTests(unittest.TestCase):
    def data(self, payload=b"V,G\n1,A\n2,A\n100,A\n7,B\n7,B\n", **changes):
        return validate_distribution(parse_csv_bytes(payload), **{
            "value_column": "col_1", "group_column": "col_2", "value_unit": "score", **changes,
        })

    def test_preserves_extremes_duplicates_and_source_groups(self):
        data = self.data()
        self.assertEqual([p.value for p in data.points], list(map(Decimal, (1, 2, 100, 7, 7))))
        self.assertEqual([p.group for p in data.points], ["A", "A", "A", "B", "B"])
        self.assertEqual(len(self.data(b"V,G\n2,A\n").points), 1)
        self.assertIsNone(self.data(group_column=None).points[0].group)

    def test_rejects_bad_mapping_missing_nonfinite_and_unplottable_values(self):
        for change in ({"value_column": "col_99"}, {"value_column": "col_2"},
                       {"group_column": "col_1"}, {"value_unit": ""}, {"value_unit": None}):
            with self.subTest(change=change), self.assertRaises(DatasetError):
                self.data(**change)
        for raw in ("", "NaN", "Infinity", "1e-500", "1e500", "word"):
            with self.subTest(raw=raw), self.assertRaises(DatasetError) as error:
                self.data(f"V,G\n{raw},A\n".encode())
            self.assertEqual((error.exception.row, error.exception.column), (2, "col_1"))
        with self.assertRaises(DatasetError):
            self.data(b"V,G\n1,\n")

    def test_limits_reject_not_sample(self):
        with patch("services.figure_worker.dataset.MAX_SCATTER_POINTS", 2), self.assertRaises(DatasetError):
            self.data()
        with self.assertRaises(DatasetError):
            self.data(("V,G\n" + "".join(f"1,G{i}\n" for i in range(9))).encode())

    def test_known_quartiles_whiskers_constant_and_small_samples(self):
        stats = distribution_box_stats(tuple(map(Decimal, (1, 2, 3, 4, 100))))
        self.assertEqual(stats, dict(q1=2, med=3, q3=4, whislo=1, whishi=4))
        self.assertEqual(distribution_box_stats((Decimal(1), Decimal(3))),
                         dict(q1=1.5, med=2, q3=2.5, whislo=1, whishi=3))
        for values in ((Decimal(7),), (Decimal(7),) * 5):
            self.assertEqual(set(distribution_box_stats(values).values()), {7})
        with localcontext() as context:
            context.prec = 2
            self.assertEqual(distribution_box_stats(tuple(map(Decimal, (1, 2, 3, 4, 100)))), stats)
        # Long precision must not round all quartiles outside the observed range.
        close = tuple(map(Decimal, ("1.00000000000000000000000000000001",
                                   "1.00000000000000000000000000000002")))
        self.assertEqual(set(distribution_box_stats(close).values()), {1.0})
        self.assertEqual(set(distribution_box_stats((Decimal("0e-999999999"),)).values()), {0})
        for invalid in ((), (Decimal("NaN"),), (Decimal("1e999999"),), (Decimal("1e-999999"),)):
            with self.assertRaises(DatasetError):
                distribution_box_stats(invalid)

    def test_renderer_retains_every_y_and_discloses_singletons_and_constants(self):
        data = self.data(b"V,G\n1,A\n2,A\n3,A\n4,A\n100,A\n7,B\n")
        figure = _make_distribution_figure(data)
        try:
            axis = figure.axes[0]
            displayed = [float(y) for coll in axis.collections for _, y in coll.get_offsets()]
            self.assertEqual(displayed, [1, 2, 3, 4, 100, 7])
            self.assertLess(axis.get_ylim()[0], 1)
            self.assertGreater(axis.get_ylim()[1], 100)
            self.assertIn("Singleton groups: 1", figure.texts[0].get_text())
            self.assertIn("no outlier deletion", figure.texts[0].get_text())
            self.assertEqual(axis.lines[4].get_ydata().tolist(), [3, 3])
        finally:
            figure.clear()

    def test_exports_reproduce_and_forged_or_unsupported_contracts_fail(self):
        data = self.data()
        self.assertEqual(render_distribution(data), render_distribution(data))
        for invalid in (replace(data, template_id="kde"), replace(data, points=()),
                        replace(data, group_column=None)):
            with self.assertRaises(DatasetError):
                render_distribution(invalid)
        with self.assertRaises(DatasetError):
            render_distribution(self.data(b"V,G\n1,\xe7\xbb\x84\n"))
        with self.assertRaises(DatasetError):
            render_distribution(self.data(b"V,G\n-1.7e308,A\n1.7e308,A\n"))

    def test_tiny_ranges_are_rejected_not_silently_expanded(self):
        for values in (("1e-320", "2e-320"), ("-2e-320", "-1e-320"),
                       ("1e-300", "1e-300"), ("-1e-300", "-1e-300"),
                       ("-1e-300", "1e-300"), ("5e-324",)):
            with self.subTest(values=values):
                data = self.data(("V,G\n" + "".join(f"{value},A\n" for value in values)).encode())
                with self.assertRaises(DatasetError) as error:
                    render_distribution(data)
                self.assertEqual(error.exception.code, "unplottable_distribution_range")
        # Zero constants have an explicit +/-1 range; small but usable data stays at its own scale.
        for values in (("0", "0"), ("1e-280", "2e-280"), ("-2e-280", "-1e-280")):
            data = self.data(("V,G\n" + "".join(f"{value},A\n" for value in values)).encode())
            figure = _make_distribution_figure(data)
            try:
                axis = figure.axes[0]
                expected = [float(Decimal(value)) for value in values]
                self.assertEqual([float(y) for c in axis.collections for _, y in c.get_offsets()], expected)
                if expected[0]:
                    self.assertLess(max(abs(v) for v in axis.get_ylim()), 3e-280)
            finally:
                figure.clear()


if __name__ == "__main__":
    unittest.main()
