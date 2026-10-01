"""Synthetic grouped-bar rendering tests; no external files or data services."""

import hashlib
import unittest
from decimal import Decimal

from services.figure_worker.dataset import (
    DatasetError, parse_csv_bytes, validate_grouped_bar, validate_heatmap, validate_scatter, validate_trend,
)
from services.figure_worker.render import (
    _make_figure, _make_heatmap_figure, _make_scatter_figure, _make_trend_figure,
    render_grouped_bar, render_heatmap, render_scatter, render_trend,
)


def grouped_data(payload: bytes, *, grouped: bool = False):
    parsed = parse_csv_bytes(payload)
    return validate_grouped_bar(
        parsed,
        category_column="col_2" if grouped else "col_1",
        value_column="col_3" if grouped else "col_2",
        group_column="col_1" if grouped else None,
        value_unit="patients",
    )


class GroupedBarRenderTests(unittest.TestCase):
    def test_uses_only_observed_values_and_does_not_fill_missing_pairs(self):
        data = grouped_data(
            b"Group,Category,Value\nA,Responder,12\nA,Stable,7\nB,Responder,9\n",
            grouped=True,
        )
        figure = _make_figure(data)
        try:
            axis = figure.axes[0]
            self.assertEqual(sorted(Decimal(str(patch.get_height())) for patch in axis.patches),
                             [Decimal("7.0"), Decimal("9.0"), Decimal("12.0")])
            self.assertEqual(len(axis.patches), len(data.points))
            self.assertEqual([tick.get_text() for tick in axis.get_xticklabels()],
                             ["Responder", "Stable"])
            self.assertEqual(axis.get_ylim()[0], 0.0)
        finally:
            figure.clear()

    def test_negative_values_keep_zero_inside_the_axis(self):
        data = grouped_data(b"Category,Value\nDecrease,-2\nIncrease,3\n")
        figure = _make_figure(data)
        try:
            lower, upper = figure.axes[0].get_ylim()
            self.assertLess(lower, 0)
            self.assertGreater(upper, 0)
            self.assertEqual([patch.get_height() for patch in figure.axes[0].patches], [-2.0, 3.0])
        finally:
            figure.clear()

    def test_three_formats_have_valid_signatures_hashes_and_repeatable_bytes(self):
        data = grouped_data(b"Category,Value\nTreatment,12\nControl,9\n")
        first = render_grouped_bar(data)
        second = render_grouped_bar(data)
        self.assertEqual(first.template_version, "grouped-bar-v1")
        self.assertEqual(first.dataset_hash, data.dataset_hash)
        self.assertEqual(first.figure_spec_hash, second.figure_spec_hash)
        self.assertEqual(len(first.figure_spec_hash), 64)
        self.assertEqual(first.randomness, "none")
        self.assertEqual(len(first.font_sha256), 64)
        self.assertEqual(first.matplotlib_version, "3.10.9")
        self.assertEqual(len(first.dependency_lock_sha256), 64)
        artifacts = {artifact.format: artifact for artifact in first.artifacts}
        self.assertEqual(set(artifacts), {"png", "pdf", "svg"})
        self.assertTrue(artifacts["png"].content.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(artifacts["pdf"].content.startswith(b"%PDF-"))
        self.assertIn(b"<svg", artifacts["svg"].content[:2000])
        self.assertEqual(
            [(artifact.format, artifact.sha256) for artifact in first.artifacts],
            [(artifact.format, artifact.sha256) for artifact in second.artifacts],
        )
        for artifact in first.artifacts:
            self.assertEqual(artifact.sha256, hashlib.sha256(artifact.content).hexdigest())
            self.assertGreater(len(artifact.content), 1000)

    def test_figure_spec_identity_changes_when_mapping_unit_changes(self):
        parsed = parse_csv_bytes(b"Category,Value\nA,1\n")
        counts = validate_grouped_bar(
            parsed, category_column="col_1", value_column="col_2", value_unit="patients"
        )
        percentages = validate_grouped_bar(
            parsed, category_column="col_1", value_column="col_2", value_unit="percent"
        )
        self.assertEqual(counts.dataset_hash, percentages.dataset_hash)
        self.assertNotEqual(render_grouped_bar(counts).figure_spec_hash,
                            render_grouped_bar(percentages).figure_spec_hash)

    def test_unavailable_font_glyph_fails_instead_of_exporting_broken_labels(self):
        data = grouped_data("Category,Value\n患者,3\n".encode("utf-8"))
        with self.assertRaises(DatasetError) as context:
            render_grouped_bar(data)
        self.assertEqual(context.exception.code, "unsupported_grouped_bar_glyph")


class ScatterRenderTests(unittest.TestCase):
    def test_one_raw_point_per_row_without_fit_or_statistical_annotation(self):
        parsed = parse_csv_bytes(b"Group,Diameter,Score\nA,1,2\nA,1,2\nB,3,4\n")
        data = validate_scatter(parsed, x_column="col_2", y_column="col_3",
                                group_column="col_1", x_unit="mm", y_unit="points")
        figure = _make_scatter_figure(data)
        try:
            axis = figure.axes[0]
            offsets = [tuple(point) for collection in axis.collections
                       for point in collection.get_offsets()]
            self.assertEqual(offsets, [(1.0, 2.0), (1.0, 2.0), (3.0, 4.0)])
            self.assertEqual(len(axis.lines), 0)
            self.assertEqual(axis.get_xlabel(), "Diameter (mm)")
            self.assertEqual(axis.get_ylabel(), "Score (points)")
            self.assertEqual([item.get_text() for item in axis.get_legend().get_texts()], ["A", "B"])
        finally:
            figure.clear()

    def test_three_formats_and_same_spec_produce_repeatable_artifacts(self):
        parsed = parse_csv_bytes(b"X,Y\n1.5,2\n3,4\n")
        data = validate_scatter(parsed, x_column="col_1", y_column="col_2",
                                x_unit="mm", y_unit="score")
        first = render_scatter(data)
        second = render_scatter(data)
        self.assertEqual(first.template_version, "scatter-v1")
        self.assertEqual(first.randomness, "none")
        self.assertEqual(first.figure_spec_hash, second.figure_spec_hash)
        self.assertEqual([(a.format, a.sha256) for a in first.artifacts],
                         [(a.format, a.sha256) for a in second.artifacts])
        artifacts = {artifact.format: artifact.content for artifact in first.artifacts}
        self.assertTrue(artifacts["png"].startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(artifacts["pdf"].startswith(b"%PDF-"))
        self.assertIn(b"<svg", artifacts["svg"][:2000])

    def test_unit_changes_version_identity_and_unsupported_glyph_is_rejected(self):
        parsed = parse_csv_bytes(b"X,Y\n1,2\n")
        mm = validate_scatter(parsed, x_column="col_1", y_column="col_2",
                              x_unit="mm", y_unit="score")
        cm = validate_scatter(parsed, x_column="col_1", y_column="col_2",
                              x_unit="cm", y_unit="score")
        self.assertNotEqual(render_scatter(mm).figure_spec_hash,
                            render_scatter(cm).figure_spec_hash)
        parsed = parse_csv_bytes("患者,Y\n1,2\n".encode("utf-8"))
        data = validate_scatter(parsed, x_column="col_1", y_column="col_2",
                                x_unit="mm", y_unit="score")
        with self.assertRaises(DatasetError) as context:
            render_scatter(data)
        self.assertEqual(context.exception.code, "unsupported_scatter_glyph")


class HeatmapRenderTests(unittest.TestCase):
    def test_raw_matrix_keeps_first_observed_order_and_shared_scale(self):
        parsed = parse_csv_bytes(b"Row,Column,Value\nB,Y,-2\nA,Y,3\nB,X,4\nA,X,5\n")
        data = validate_heatmap(parsed, row_column="col_1", column_column="col_2",
                                value_column="col_3", value_unit="score")
        figure = _make_heatmap_figure(data)
        try:
            axis = figure.axes[0]
            self.assertEqual(axis.images[0].get_array().tolist(), [[-2.0, 4.0], [3.0, 5.0]])
            self.assertEqual([t.get_text() for t in axis.get_xticklabels()], ["Y", "X"])
            self.assertEqual([t.get_text() for t in axis.get_yticklabels()], ["B", "A"])
            self.assertEqual(axis.images[0].get_clim(), (-2, 5))
            self.assertEqual(figure.axes[1].get_ylabel(), "score")
            self.assertEqual(len(axis.lines), 0)
        finally:
            figure.clear()

    def test_three_formats_are_repeatable_and_unit_changes_spec_identity(self):
        parsed = parse_csv_bytes(b"R,C,V\nA,X,1\nA,Y,2\n")
        data = validate_heatmap(parsed, row_column="col_1", column_column="col_2",
                                value_column="col_3", value_unit="score")
        first, second = render_heatmap(data), render_heatmap(data)
        self.assertEqual(first.template_version, "heatmap-v1")
        self.assertEqual([(a.format, a.sha256) for a in first.artifacts],
                         [(a.format, a.sha256) for a in second.artifacts])
        artifacts = {a.format: a.content for a in first.artifacts}
        self.assertTrue(artifacts["png"].startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(artifacts["pdf"].startswith(b"%PDF-"))
        self.assertIn(b"<svg", artifacts["svg"][:2000])
        other = validate_heatmap(parsed, row_column="col_1", column_column="col_2",
                                 value_column="col_3", value_unit="count")
        self.assertNotEqual(first.figure_spec_hash, render_heatmap(other).figure_spec_hash)

    def test_unsupported_labels_fail_before_export(self):
        parsed = parse_csv_bytes("R,C,V\n患者,X,1\n".encode())
        data = validate_heatmap(parsed, row_column="col_1", column_column="col_2",
                                value_column="col_3", value_unit="score")
        with self.assertRaises(DatasetError) as context:
            render_heatmap(data)
        self.assertEqual(context.exception.code, "unsupported_heatmap_glyph")


class TrendRenderTests(unittest.TestCase):
    def test_no_smoothing_accumulation_or_missing_time_imputation(self):
        parsed = parse_csv_bytes(b"Series,Week,Count\nA,1,3\nB,1,7\nA,3,8\nB,4,9\n")
        data = validate_trend(parsed, x_column="col_2", value_column="col_3",
                              series_column="col_1", x_unit="weeks", value_unit="patients")
        figure = _make_trend_figure(data)
        try:
            lines = figure.axes[0].lines
            self.assertEqual(len(lines), 2)
            self.assertEqual(lines[0].get_xdata().tolist(), [1.0, 3.0])
            self.assertEqual(lines[0].get_ydata().tolist(), [3.0, 8.0])
            self.assertEqual(lines[1].get_ydata().tolist(), [7.0, 9.0])
            self.assertEqual(len(figure.axes[0].collections), 0)
            self.assertEqual(figure.axes[0].get_xlabel(), "Week (weeks)")
        finally:
            figure.clear()

    def test_three_formats_are_repeatable_without_fit_or_bootstrap(self):
        data = validate_trend(parse_csv_bytes(b"Week,Count\n1,3\n2,8\n"),
                              x_column="col_1", value_column="col_2",
                              x_unit="weeks", value_unit="patients")
        first, second = render_trend(data), render_trend(data)
        self.assertEqual(first.template_version, "trend-v1")
        self.assertEqual(first.randomness, "none")
        self.assertEqual([(a.format, a.sha256) for a in first.artifacts],
                         [(a.format, a.sha256) for a in second.artifacts])
        artifacts = {a.format: a.content for a in first.artifacts}
        self.assertTrue(artifacts["png"].startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(artifacts["pdf"].startswith(b"%PDF-"))
        self.assertIn(b"<svg", artifacts["svg"][:2000])

    def test_unplottable_float_collision_and_unavailable_glyph_are_rejected(self):
        data = validate_trend(parse_csv_bytes(b"X,Y\n1,2\n1.00000000000000000001,3\n"),
                              x_column="col_1", value_column="col_2",
                              x_unit="days", value_unit="score")
        with self.assertRaises(DatasetError) as context:
            render_trend(data)
        self.assertEqual(context.exception.code, "unordered_or_duplicate_trend_x")
        data = validate_trend(parse_csv_bytes("时间,Y\n1,2\n".encode()),
                              x_column="col_1", value_column="col_2",
                              x_unit="days", value_unit="score")
        with self.assertRaises(DatasetError) as context:
            render_trend(data)
        self.assertEqual(context.exception.code, "unsupported_trend_glyph")


if __name__ == "__main__":
    unittest.main()
