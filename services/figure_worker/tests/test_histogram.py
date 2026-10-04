"""Exact fixed-bin counts: no automatic bins, weights or omitted observations."""

from decimal import Decimal, localcontext
import unittest

from services.figure_worker.dataset import (
    DatasetError, histogram_bin_counts, parse_csv_bytes, validate_distribution, validate_histogram_edges,
)


class HistogramInputTests(unittest.TestCase):
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
