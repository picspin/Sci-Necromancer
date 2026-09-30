"""Deterministic, synthetic fixtures only; no patient data or model calls."""

import hashlib
import unittest
from decimal import Decimal
from unittest.mock import patch

from services.figure_worker import dataset as figures


class CsvIntakeTests(unittest.TestCase):
    def test_profiles_columns_without_inventing_units_or_exposing_rows_in_repr(self):
        payload = b"Centre,Count,Note\nA,12,ok\nB,8,\n"
        result = figures.parse_csv_bytes(payload)
        self.assertEqual(result.parser_version, "csv-v1")
        self.assertEqual(result.sha256, hashlib.sha256(payload).hexdigest())
        self.assertEqual(result.byte_count, len(payload))
        self.assertEqual(result.row_count, 2)
        self.assertEqual(
            [(column.id, column.name, column.kind, column.missing_count)
             for column in result.columns],
            [("col_1", "Centre", "text", 0),
             ("col_2", "Count", "numeric", 0),
             ("col_3", "Note", "text", 1)],
        )
        self.assertNotIn("Centre", repr(result))
        self.assertNotIn("ok", repr(result))

    def test_accepts_utf8_bom_and_marks_mixed_and_empty_columns(self):
        result = figures.parse_csv_bytes(
            "\ufeff类别,数值,备注\r\n甲,1,\r\n乙,unknown,\r\n".encode("utf-8")
        )
        self.assertEqual([column.kind for column in result.columns], ["text", "mixed", "empty"])
        self.assertEqual([column.missing_count for column in result.columns], [0, 0, 2])

    def test_rejects_invalid_encoding_syntax_null_and_uneven_rows(self):
        cases = [
            (b"\xff,x\n1,2\n", "invalid_csv_encoding"),
            (b"a,b\n\"unclosed,1\n", "invalid_csv_syntax"),
            (b"a,b\n1,\x00\n", "invalid_csv_content"),
            (b"a,b\n1\n", "invalid_csv_row_width"),
        ]
        for payload, code in cases:
            with self.subTest(code=code), self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(payload)
            self.assertEqual(context.exception.code, code)
            self.assertNotIn("unclosed", str(context.exception))

    def test_rejects_duplicate_or_empty_headers_and_missing_data(self):
        for payload, code in [
            (b"A,a\n1,2\n", "invalid_csv_header"),
            (b"A, \n1,2\n", "invalid_csv_header"),
            (b"A,B\n", "empty_csv_data"),
        ]:
            with self.subTest(payload=payload), self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(payload)
            self.assertEqual(context.exception.code, code)

    def test_enforces_byte_row_column_and_cell_bounds(self):
        with patch.object(figures, "MAX_CSV_BYTES", 6):
            with self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(b"A,B\n1,2\n")
            self.assertEqual(context.exception.code, "invalid_csv_size")
        with patch.object(figures, "MAX_COLUMNS", 1):
            with self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(b"A,B\n1,2\n")
            self.assertEqual(context.exception.code, "invalid_csv_header")
        with patch.object(figures, "MAX_ROWS", 1):
            with self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(b"A\n1\n2\n")
            self.assertEqual(context.exception.code, "csv_limit_exceeded")
        with patch.object(figures, "MAX_CELLS", 2):
            with self.assertRaises(figures.DatasetError) as context:
                figures.parse_csv_bytes(b"A,B\n1,2\n3,4\n")
            self.assertEqual(context.exception.code, "csv_limit_exceeded")


class GroupedBarContractTests(unittest.TestCase):
    def test_preserves_preaggregated_values_without_computing_statistics(self):
        parsed = figures.parse_csv_bytes(
            b"Cohort,Category,Value\nA,Responded,12\nA,Stable,7\nB,Responded,9\n"
        )
        result = figures.validate_grouped_bar(
            parsed, category_column="col_2", value_column="col_3",
            group_column="col_1", value_unit="patients",
        )
        self.assertEqual(result.template_id, "grouped-bar")
        self.assertEqual(result.dataset_hash, parsed.sha256)
        self.assertEqual(result.parser_version, "csv-v1")
        self.assertEqual(
            [(point.group, point.category, point.value) for point in result.points],
            [("A", "Responded", Decimal("12")),
             ("A", "Stable", Decimal("7")),
             ("B", "Responded", Decimal("9"))],
        )
        self.assertNotIn("Responded", repr(result))

    def test_requires_explicit_unique_mapping_and_unit(self):
        parsed = figures.parse_csv_bytes(b"Category,Value\nA,1\n")
        for kwargs, code in [
            ({"category_column": "col_1", "value_column": "col_1", "value_unit": "count"},
             "invalid_grouped_bar_mapping"),
            ({"category_column": "col_1", "value_column": "col_9", "value_unit": "count"},
             "invalid_grouped_bar_mapping"),
            ({"category_column": "col_1", "value_column": "col_2", "value_unit": " "},
             "invalid_grouped_bar_unit"),
            ({"category_column": "col_1", "value_column": "col_2", "group_column": "",
              "value_unit": "count"}, "invalid_grouped_bar_mapping"),
        ]:
            with self.subTest(kwargs=kwargs), self.assertRaises(figures.DatasetError) as context:
                figures.validate_grouped_bar(parsed, **kwargs)
            self.assertEqual(context.exception.code, code)

    def test_rejects_missing_mapped_values_without_dropping_rows(self):
        for payload, code in [
            (b"Category,Value\n,3\n", "missing_grouped_bar_label"),
            (b"Category,Value\nA,\n", "missing_grouped_bar_value"),
            (b"Category,Value\nA,not-a-number\n", "invalid_grouped_bar_value"),
            (b"Category,Value\nA,NaN\n", "invalid_grouped_bar_value"),
            (b"Category,Value\nA,1e999\n", "invalid_grouped_bar_value"),
            (b"Category,Value\nA,1e-999\n", "invalid_grouped_bar_value"),
        ]:
            parsed = figures.parse_csv_bytes(payload)
            with self.subTest(code=code), self.assertRaises(figures.DatasetError) as context:
                figures.validate_grouped_bar(
                    parsed, category_column="col_1", value_column="col_2", value_unit="count"
                )
            self.assertEqual(context.exception.code, code)
            self.assertEqual(context.exception.row, 2)

    def test_rejects_duplicate_category_group_instead_of_summing(self):
        parsed = figures.parse_csv_bytes(b"Category,Value\nA,2\nA,3\n")
        with self.assertRaises(figures.DatasetError) as context:
            figures.validate_grouped_bar(
                parsed, category_column="col_1", value_column="col_2", value_unit="count"
            )
        self.assertEqual(context.exception.code, "duplicate_grouped_bar_category")
        self.assertEqual(context.exception.row, 3)

    def test_rejects_missing_group_without_dropping_its_row(self):
        parsed = figures.parse_csv_bytes(b"Group,Category,Value\n,Responder,3\n")
        with self.assertRaises(figures.DatasetError) as context:
            figures.validate_grouped_bar(
                parsed, category_column="col_2", value_column="col_3",
                group_column="col_1", value_unit="patients",
            )
        self.assertEqual(context.exception.code, "missing_grouped_bar_label")
        self.assertEqual(context.exception.row, 2)

    def test_rejects_unreadable_labels_and_template_size_overflow(self):
        parsed = figures.parse_csv_bytes(b"Category,Value\nA,1\nB,2\n")
        with patch.object(figures, "MAX_GROUPED_BAR_CATEGORIES", 1):
            with self.assertRaises(figures.DatasetError) as context:
                figures.validate_grouped_bar(
                    parsed, category_column="col_1", value_column="col_2", value_unit="count"
                )
            self.assertEqual(context.exception.code, "grouped_bar_limit_exceeded")
        parsed = figures.parse_csv_bytes(b"Category,Value\n\"A\tB\",2\n")
        with self.assertRaises(figures.DatasetError) as context:
            figures.validate_grouped_bar(
                parsed, category_column="col_1", value_column="col_2", value_unit="count"
            )
        self.assertEqual(context.exception.code, "missing_grouped_bar_label")


class ScatterContractTests(unittest.TestCase):
    def test_preserves_each_raw_observation_including_duplicate_coordinates(self):
        parsed = figures.parse_csv_bytes(b"Group,X,Y\nA,1.5,2\nA,1.5,2\nB,-3,4\n")
        result = figures.validate_scatter(
            parsed, x_column="col_2", y_column="col_3", group_column="col_1",
            x_unit="mm", y_unit="score",
        )
        self.assertEqual(result.template_id, "scatter")
        self.assertEqual(result.dataset_hash, parsed.sha256)
        self.assertEqual([(p.x, p.y, p.group) for p in result.points], [
            (Decimal("1.5"), Decimal("2"), "A"),
            (Decimal("1.5"), Decimal("2"), "A"),
            (Decimal("-3"), Decimal("4"), "B"),
        ])
        self.assertNotIn("1.5", repr(result))

    def test_rejects_bad_mapping_unit_or_mapped_observation(self):
        cases = [
            (b"X,Y\n1,2\n", {"x_column": "col_1", "y_column": "col_1", "x_unit": "mm", "y_unit": "score"}, "invalid_scatter_mapping"),
            (b"X,Y\n1,2\n", {"x_column": "col_1", "y_column": "col_2", "x_unit": " ", "y_unit": "score"}, "invalid_scatter_unit"),
            (b"X,Y\n,2\n", {"x_column": "col_1", "y_column": "col_2", "x_unit": "mm", "y_unit": "score"}, "missing_scatter_value"),
            (b"X,Y\n1,NaN\n", {"x_column": "col_1", "y_column": "col_2", "x_unit": "mm", "y_unit": "score"}, "invalid_scatter_value"),
            (b"X,Y\n1,1e999\n", {"x_column": "col_1", "y_column": "col_2", "x_unit": "mm", "y_unit": "score"}, "invalid_scatter_value"),
            (b"X,Y\n1,1e-999\n", {"x_column": "col_1", "y_column": "col_2", "x_unit": "mm", "y_unit": "score"}, "invalid_scatter_value"),
            (b"Group,X,Y\n,1,2\n", {"x_column": "col_2", "y_column": "col_3", "group_column": "col_1", "x_unit": "mm", "y_unit": "score"}, "missing_scatter_group"),
        ]
        for payload, kwargs, code in cases:
            with self.subTest(code=code), self.assertRaises(figures.DatasetError) as context:
                figures.validate_scatter(figures.parse_csv_bytes(payload), **kwargs)
            self.assertEqual(context.exception.code, code)

    def test_point_and_group_limits_do_not_sample_or_drop_rows(self):
        parsed = figures.parse_csv_bytes(b"X,Y\n1,2\n3,4\n")
        with patch.object(figures, "MAX_SCATTER_POINTS", 1):
            with self.assertRaises(figures.DatasetError) as context:
                figures.validate_scatter(parsed, x_column="col_1", y_column="col_2",
                                         x_unit="mm", y_unit="score")
        self.assertEqual(context.exception.code, "scatter_limit_exceeded")
        self.assertEqual(context.exception.row, 3)
        parsed = figures.parse_csv_bytes(b"Group,X,Y\nA,1,2\nB,3,4\n")
        with patch.object(figures, "MAX_SCATTER_GROUPS", 1):
            with self.assertRaises(figures.DatasetError) as context:
                figures.validate_scatter(parsed, x_column="col_2", y_column="col_3",
                                         group_column="col_1", x_unit="mm", y_unit="score")
        self.assertEqual(context.exception.code, "scatter_limit_exceeded")


if __name__ == "__main__":
    unittest.main()
