"""In-memory deterministic data-figure rendering; no upload or billing side effects."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import Decimal
from hashlib import sha256
from io import BytesIO
import json
from math import isfinite
from pathlib import Path
from platform import python_version
from textwrap import wrap

import matplotlib
from matplotlib import get_data_path, rc_context
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.collections import Collection
from matplotlib.colors import to_rgba
from matplotlib.figure import Figure
from matplotlib.font_manager import FontProperties
from matplotlib.ft2font import FT2Font
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.text import Text

from services.figure_worker.dataset import (
    CompositionData, DatasetError, DistributionData, GroupedBarData, HeatmapData, IntervalData,
    MAX_COMPOSITION_COMPONENTS, MAX_COMPOSITION_GROUPS, MAX_EXACT_COUNT,
    MAX_HEATMAP_DIMENSION, MAX_INTERVAL_POINTS, RankedData, ScatterData, TrendData,
    VolcanoData, distribution_box_stats, validate_volcano_options, volcano_ordinate,
)
from services.figure_worker.styles import FigureStyle, STANDARD_STYLE, STYLES


GROUPED_BAR_TEMPLATE_VERSION = "grouped-bar-v1"
SCATTER_TEMPLATE_VERSION = "scatter-v1"
HEATMAP_TEMPLATE_VERSION = "heatmap-v1"
TREND_TEMPLATE_VERSION = "trend-v1"
RANKED_TEMPLATE_VERSION = "ranked-lollipop-v1"
COMPOSITION_TEMPLATE_VERSION = "composition-v1"
VOLCANO_TEMPLATE_VERSION = "volcano-v1"
DISTRIBUTION_TEMPLATE_VERSION = "distribution-box-scatter-v1"
INTERVAL_TEMPLATE_VERSIONS = {"dot-interval": "dot-interval-v1", "forest": "forest-v1"}
DPI = 160
HEIGHT_INCHES = 5.5
FONT_NAME = "DejaVu Sans"
FONT_PATH = Path(get_data_path()) / "fonts" / "ttf" / "DejaVuSans.ttf"
FONT_SHA256 = sha256(FONT_PATH.read_bytes()).hexdigest()
LOCK_SHA256 = sha256(Path(__file__).with_name("uv.lock").read_bytes()).hexdigest()
COLORS = STANDARD_STYLE.palette


@dataclass(frozen=True)
class FigureArtifact:
    format: str
    media_type: str
    sha256: str
    content: bytes = field(repr=False)


@dataclass(frozen=True)
class RenderedFigure:
    template_version: str
    dataset_hash: str
    figure_spec_hash: str
    parser_version: str
    python_version: str
    matplotlib_version: str
    dependency_lock_sha256: str
    font: str
    font_sha256: str
    dpi: int
    width_inches: float
    height_inches: float
    randomness: str
    style_id: str
    style_version: str
    style_sha256: str
    artifacts: tuple[FigureArtifact, ...] = field(repr=False)


def _literal_label(value: str) -> str:
    # Mathtext is not part of this template; retain dollar signs as plain labels.
    return value.replace("$", r"\$")


def _spec_hash(data: GroupedBarData | ScatterData | HeatmapData | TrendData | IntervalData | RankedData | CompositionData | VolcanoData | DistributionData) -> str:
    if isinstance(data, GroupedBarData):
        spec = {
            "template_version": GROUPED_BAR_TEMPLATE_VERSION,
            "dataset_hash": data.dataset_hash,
            "category_column": data.category_column,
            "value_column": data.value_column,
            "group_column": data.group_column,
            "value_unit": data.value_unit,
            "points": [(point.category, point.group, str(point.value)) for point in data.points],
        }
    elif isinstance(data, HeatmapData):
        spec = {
            "template_version": HEATMAP_TEMPLATE_VERSION,
            "dataset_hash": data.dataset_hash,
            "row_column": data.row_column,
            "column_column": data.column_column,
            "value_column": data.value_column,
            "value_unit": data.value_unit,
            "cells": [(cell.row_label, cell.column_label, str(cell.value)) for cell in data.cells],
            "transform": "none", "ordering": "first-observed", "clustering": "none",
        }
    elif isinstance(data, TrendData):
        spec = {
            "template_version": TREND_TEMPLATE_VERSION,
            "dataset_hash": data.dataset_hash,
            "x_column": data.x_column, "value_column": data.value_column,
            "series_column": data.series_column,
            "x_unit": data.x_unit, "value_unit": data.value_unit,
            "x_label": data.x_label, "value_label": data.value_label,
            "points": [(str(p.x), str(p.y), p.group) for p in data.points],
            "transform": "none", "ordering": "source-increasing-per-series",
            "smoothing": "none", "aggregation": "none",
        }
    elif isinstance(data, IntervalData):
        spec = {
            "template_version": INTERVAL_TEMPLATE_VERSIONS[data.template_id],
            "dataset_hash": data.dataset_hash,
            "label_column": data.label_column, "estimate_column": data.estimate_column,
            "lower_column": data.lower_column, "upper_column": data.upper_column,
            "value_unit": data.value_unit, "interval_type": data.interval_type,
            "ci_level": str(data.ci_level) if data.ci_level is not None else None,
            "effect_type": data.effect_type,
            "points": [(p.label, str(p.estimate), str(p.lower), str(p.upper)) for p in data.points],
            "transform": "none", "pooling": "none", "ordering": "source",
        }
    elif isinstance(data, RankedData):
        spec = {
            "template_version": RANKED_TEMPLATE_VERSION, "dataset_hash": data.dataset_hash,
            "label_column": data.label_column, "value_column": data.value_column,
            "group_column": data.group_column, "value_unit": data.value_unit,
            "ordering": data.ordering, "top_n": data.top_n, "ties": "source-order",
            "omitted": max(len(data.points) - data.top_n, 0), "enrichment": "none",
            "points": [(p.label, str(p.value), p.group) for p in data.points],
        }
    elif isinstance(data, CompositionData):
        spec = {
            "template_version": COMPOSITION_TEMPLATE_VERSION, "dataset_hash": data.dataset_hash,
            "group_column": data.group_column, "component_column": data.component_column,
            "count_column": data.count_column, "denominator_column": data.denominator_column,
            "count_unit": data.count_unit, "display": data.display,
            "denominator_scope": "within-group", "mutually_exclusive": True, "exhaustive": True,
            "ordering": "first-observed", "missing": "reject",
            "percent_arithmetic": "binary64-counts-divided-by-supplied-total",
            "cells": [(c.group, c.component, str(c.count), str(c.denominator)) for c in data.cells],
        }
    elif isinstance(data, DistributionData):
        spec = {
            "template_version": DISTRIBUTION_TEMPLATE_VERSION, "dataset_hash": data.dataset_hash,
            "value_column": data.value_column, "group_column": data.group_column, "value_unit": data.value_unit,
            "quartiles": "HF7-exact-rational-to-binary64", "whiskers": "observed-within-1.5-IQR",
            "jitter": "source-order-even-spread-width0.3", "ordering": "first-observed",
            "sampling": "none", "deletion": "none", "kde": "none", "tests": "none",
            "points": [(str(p.value), p.group) for p in data.points],
        }
    elif isinstance(data, VolcanoData):
        spec = {
            "template_version": VOLCANO_TEMPLATE_VERSION, "dataset_hash": data.dataset_hash,
            "identifier_column": data.identifier_column, "log2fc_column": data.log2fc_column,
            "p_column": data.p_column, "p_kind": data.p_kind,
            "p_threshold": str(data.p_threshold), "fold_threshold": str(data.fold_threshold),
            "zero_p_floor": str(data.zero_p_floor) if data.zero_p_floor is not None else None,
            "zero_count": sum(p.p_value == 0 for p in data.points),
            "y_transform": "negative-decimal-log10-prec28-half-even", "correction": "none",
            "points": [(p.identifier, str(p.log2fc), str(p.p_value)) for p in data.points],
        }
    else:
        spec = {
            "template_version": SCATTER_TEMPLATE_VERSION,
            "dataset_hash": data.dataset_hash,
            "x_column": data.x_column,
            "y_column": data.y_column,
            "group_column": data.group_column,
            "x_unit": data.x_unit,
            "y_unit": data.y_unit,
            "x_label": data.x_label,
            "y_label": data.y_label,
            "points": [(str(point.x), str(point.y), point.group) for point in data.points],
        }
    return sha256(json.dumps(spec, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":")).encode("utf-8")).hexdigest()


def _check_font_coverage(labels: list[str], error_code: str) -> None:
    available = FT2Font(str(FONT_PATH)).get_charmap()
    if any(ord(char) not in available for label in labels for char in label):
        raise DatasetError(error_code)


def _make_figure(data: GroupedBarData) -> Figure:
    if not isinstance(data, GroupedBarData) or data.template_id != "grouped-bar" or not data.points:
        raise DatasetError("invalid_grouped_bar_contract")
    categories = list(dict.fromkeys(point.category for point in data.points))
    groups = list(dict.fromkeys(point.group for point in data.points if point.group is not None))
    if len(data.points) > 96 or len(categories) > 24 or len(groups) > len(COLORS):
        raise DatasetError("grouped_bar_limit_exceeded")
    if bool(groups) != (data.group_column is not None) or any(
        (point.group is None) != (data.group_column is None) for point in data.points
    ):
        raise DatasetError("invalid_grouped_bar_contract")
    labels = [data.value_unit]
    for point in data.points:
        labels.append(point.category)
        if point.group is not None:
            labels.append(point.group)
    _check_font_coverage(labels, "unsupported_grouped_bar_glyph")
    font = FontProperties(fname=str(FONT_PATH))
    values = [float(point.value) for point in data.points]
    if any(not isfinite(value) for value in values):
        raise DatasetError("invalid_grouped_bar_value")
    width = min(16.0, max(8.0, 4.0 + 0.5 * len(categories)))
    figure = Figure(figsize=(width, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    category_positions = {category: index for index, category in enumerate(categories)}
    if groups:
        slot = 0.8 / len(groups)
        for group_index, group in enumerate(groups):
            selected = [point for point in data.points if point.group == group]
            positions = [category_positions[point.category] - 0.4
                         + slot * (group_index + 0.5) for point in selected]
            axis.bar(positions, [float(point.value) for point in selected],
                     width=slot * 0.9, color=COLORS[group_index], label=_literal_label(group))
        axis.legend(frameon=False, loc="upper right",
                    prop=FontProperties(fname=str(FONT_PATH), size=9))
    else:
        axis.bar([category_positions[point.category] for point in data.points], values,
                 width=0.72, color=COLORS[0])
    axis.set_xticks(range(len(categories)), [_literal_label(category) for category in categories],
                    rotation=35 if len(categories) > 5 else 0, ha="right" if len(categories) > 5 else "center")
    axis.set_ylabel(_literal_label(data.value_unit), fontproperties=font)
    axis.set_xlim(-0.6, len(categories) - 0.4)
    lower_value = min(values)
    upper_value = max(values)
    lower = lower_value * 1.08 if lower_value < 0 else 0.0
    upper = upper_value * 1.08 if upper_value > 0 else 0.0
    if not isfinite(lower):
        lower = lower_value
    if not isfinite(upper):
        upper = upper_value
    if lower == upper:
        upper = 1.0
    axis.set_ylim(lower, upper)
    axis.axhline(0, color="#34434D", linewidth=0.9)
    axis.grid(axis="y", color="#D9E1E5", linewidth=0.6)
    axis.set_axisbelow(True)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.tight_layout()
    return figure


def _apply_style(figure: Figure, style: FigureStyle) -> None:
    """Change existing artist appearance only; retain positions, scales and warnings."""
    colors = {to_rgba(old)[:3]: to_rgba(new)[:3]
              for old, new in zip(COLORS, style.palette)}

    def recolor(value):
        rgba = to_rgba(value)
        return (*colors.get(rgba[:3], rgba[:3]), rgba[3])

    for axis in figure.axes:
        for image in axis.images:
            image.set_cmap(style.heatmap_cmap)
    # findobj includes legend copies; each artist is visited once.
    for artist in figure.findobj():
        if isinstance(artist, Patch):
            artist.set_facecolor(recolor(artist.get_facecolor()))
            artist.set_edgecolor(recolor(artist.get_edgecolor()))
        elif isinstance(artist, Line2D):
            original = to_rgba(artist.get_color())
            artist.set_color(recolor(original))
            if original[:3] in colors:
                artist.set_linewidth(artist.get_linewidth() * style.line_scale)
        elif isinstance(artist, Collection):
            original = artist.get_facecolors()
            edges = artist.get_edgecolors()
            # Continuous colorbars use a scalar mapping; do not replace it with a palette.
            if artist.get_array() is None:
                artist.set_facecolors([recolor(c) for c in original])
                artist.set_edgecolors([recolor(c) for c in edges])
                if any(tuple(c[:3]) in colors for c in (*original, *edges)):
                    artist.set_linewidths(artist.get_linewidths() * style.line_scale)
        elif isinstance(artist, Text) and artist not in figure.texts:
            artist.set_fontsize(artist.get_fontsize() * style.font_scale)


def _export_figure(
    figure: Figure, *, template_version: str, dataset_hash: str,
    parser_version: str, figure_spec_hash: str, style: FigureStyle = STANDARD_STYLE,
) -> RenderedFigure:
    """Export a frozen figure to three formats with identical input provenance."""
    if type(style) is not FigureStyle or STYLES.get(style.id) is not style:
        figure.clear()
        raise DatasetError("invalid_figure_style")
    style_hash = sha256(json.dumps({"profile": asdict(style), "font_sha256": FONT_SHA256},
                                  sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if style is not STANDARD_STYLE:
        figure_spec_hash = sha256(json.dumps({"data_spec_hash": figure_spec_hash,
                                             "style_sha256": style_hash},
                                            sort_keys=True).encode()).hexdigest()
    with rc_context({
        "font.family": FONT_NAME,
        "text.usetex": False,
        "svg.fonttype": "path",
        "svg.hashsalt": figure_spec_hash,
    }):
        try:
            if style is not STANDARD_STYLE:
                _apply_style(figure, style)
            outputs = []
            for format_name, media_type, metadata in (
                ("png", "image/png", {"Software": "Sci-Necromancer figure worker"}),
                ("pdf", "application/pdf", {"CreationDate": None, "Creator": "Sci-Necromancer figure worker"}),
                ("svg", "image/svg+xml", {"Date": None, "Creator": "Sci-Necromancer figure worker"}),
            ):
                stream = BytesIO()
                if style is not STANDARD_STYLE:
                    key = {"png": "Description", "pdf": "Subject", "svg": "Description"}[format_name]
                    metadata[key] = f"{style.version}; style_sha256={style_hash}; figure_spec_hash={figure_spec_hash}"
                figure.savefig(stream, format=format_name, dpi=style.dpi, metadata=metadata,
                               facecolor="white")
                content = stream.getvalue()
                outputs.append(FigureArtifact(
                    format=format_name, media_type=media_type,
                    sha256=sha256(content).hexdigest(), content=content,
                ))
        finally:
            figure.clear()
    return RenderedFigure(
        template_version=template_version,
        dataset_hash=dataset_hash,
        figure_spec_hash=figure_spec_hash,
        parser_version=parser_version,
        python_version=python_version(),
        matplotlib_version=matplotlib.__version__,
        dependency_lock_sha256=LOCK_SHA256,
        font=FONT_NAME,
        font_sha256=FONT_SHA256,
        dpi=style.dpi,
        width_inches=float(figure.get_size_inches()[0]),
        height_inches=HEIGHT_INCHES,
        randomness="none",
        style_id=style.id,
        style_version=style.version,
        style_sha256=style_hash,
        artifacts=tuple(outputs),
    )


def render_grouped_bar(data: GroupedBarData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Render one validated grouped-bar version to PNG/PDF/SVG bytes in memory."""
    if not isinstance(data, GroupedBarData):
        raise DatasetError("invalid_grouped_bar_contract")
    with rc_context({"text.usetex": False}):
        figure = _make_figure(data)
    return _export_figure(
        figure, template_version=GROUPED_BAR_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data), style=style,
    )


def _make_scatter_figure(data: ScatterData) -> Figure:
    if not isinstance(data, ScatterData) or data.template_id != "scatter" or not data.points:
        raise DatasetError("invalid_scatter_contract")
    groups = list(dict.fromkeys(point.group for point in data.points if point.group is not None))
    if len(data.points) > 5_000 or len(groups) > len(COLORS):
        raise DatasetError("scatter_limit_exceeded")
    if bool(groups) != (data.group_column is not None) or any(
        (point.group is None) != (data.group_column is None) for point in data.points
    ):
        raise DatasetError("invalid_scatter_contract")
    labels = [data.x_label, data.y_label, data.x_unit, data.y_unit, *groups]
    _check_font_coverage(labels, "unsupported_scatter_glyph")
    try:
        if any(not isfinite(float(value)) for point in data.points for value in (point.x, point.y)):
            raise DatasetError("invalid_scatter_value")
    except (ValueError, OverflowError) as error:
        raise DatasetError("invalid_scatter_value") from error
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    plot_groups = groups if groups else [None]
    for index, group in enumerate(plot_groups):
        selected = [point for point in data.points if point.group == group]
        axis.scatter(
            [float(point.x) for point in selected],
            [float(point.y) for point in selected],
            s=28, alpha=0.8, color=COLORS[index], edgecolors="none",
            label=_literal_label(group) if group is not None else None,
        )
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_xlabel(_literal_label(f"{data.x_label} ({data.x_unit})"), fontproperties=font)
    axis.set_ylabel(_literal_label(f"{data.y_label} ({data.y_unit})"), fontproperties=font)
    axis.grid(color="#D9E1E5", linewidth=0.6)
    axis.set_axisbelow(True)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    if groups:
        axis.legend(frameon=False, loc="best", prop=FontProperties(fname=str(FONT_PATH), size=9))
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(),
                  axis.xaxis.get_offset_text(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.tight_layout()
    return figure


def render_scatter(data: ScatterData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Render raw x/y observations only; never infer a fit or significance."""
    if not isinstance(data, ScatterData):
        raise DatasetError("invalid_scatter_contract")
    with rc_context({"text.usetex": False}):
        figure = _make_scatter_figure(data)
    return _export_figure(
        figure, template_version=SCATTER_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data), style=style,
    )


def _make_heatmap_figure(data: HeatmapData) -> Figure:
    if not isinstance(data, HeatmapData) or data.template_id != "heatmap" or not data.cells:
        raise DatasetError("invalid_heatmap_contract")
    rows = list(dict.fromkeys(cell.row_label for cell in data.cells))
    columns = list(dict.fromkeys(cell.column_label for cell in data.cells))
    if max(len(rows), len(columns)) > MAX_HEATMAP_DIMENSION:
        raise DatasetError("heatmap_limit_exceeded")
    lookup = {(cell.row_label, cell.column_label): cell.value for cell in data.cells}
    if len(lookup) != len(data.cells) or len(lookup) != len(rows) * len(columns):
        raise DatasetError("invalid_heatmap_contract")
    _check_font_coverage([*rows, *columns, data.value_unit], "unsupported_heatmap_glyph")
    matrix = [[float(lookup[(row, column)]) for column in columns] for row in rows]
    if any(not isfinite(value) for row in matrix for value in row):
        raise DatasetError("invalid_heatmap_value")
    figure = Figure(figsize=(max(8.0, len(columns) * 0.7), HEIGHT_INCHES),
                    dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    image = axis.imshow(matrix, cmap="viridis", aspect="auto", interpolation="nearest")
    axis.set_xticks(range(len(columns)), [_literal_label(label) for label in columns],
                    rotation=45, ha="right")
    axis.set_yticks(range(len(rows)), [_literal_label(label) for label in rows])
    colorbar = figure.colorbar(image, ax=axis)
    font = FontProperties(fname=str(FONT_PATH))
    colorbar.set_label(_literal_label(data.value_unit), fontproperties=font)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(),
                  *colorbar.ax.get_yticklabels(), colorbar.ax.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.tight_layout()
    return figure


def render_heatmap(data: HeatmapData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Export the supplied raw matrix on one shared color scale, without statistics."""
    if not isinstance(data, HeatmapData):
        raise DatasetError("invalid_heatmap_contract")
    with rc_context({"text.usetex": False}):
        figure = _make_heatmap_figure(data)
    return _export_figure(
        figure, template_version=HEATMAP_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data), style=style,
    )


def _make_trend_figure(data: TrendData) -> Figure:
    if not isinstance(data, TrendData) or data.template_id != "trend" or not data.points:
        raise DatasetError("invalid_trend_contract")
    groups = list(dict.fromkeys(point.group for point in data.points))
    if len(data.points) > 5_000 or len(groups) > len(COLORS):
        raise DatasetError("trend_limit_exceeded")
    if any((point.group is None) != (data.series_column is None) for point in data.points):
        raise DatasetError("invalid_trend_contract")
    _check_font_coverage([data.x_label, data.value_label, data.x_unit, data.value_unit,
                          *(group for group in groups if group is not None)],
                         "unsupported_trend_glyph")
    previous: dict[str | None, float] = {}
    for point in data.points:
        x, y = float(point.x), float(point.y)
        if not isfinite(x) or not isfinite(y):
            raise DatasetError("invalid_trend_value")
        if point.group in previous and x <= previous[point.group]:
            raise DatasetError("unordered_or_duplicate_trend_x")
        previous[point.group] = x
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    for index, group in enumerate(groups):
        points = [point for point in data.points if point.group == group]
        axis.plot([float(p.x) for p in points], [float(p.y) for p in points],
                  marker="o", markersize=4, linewidth=1.2, color=COLORS[index],
                  label=_literal_label(group) if group is not None else None)
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_xlabel(_literal_label(f"{data.x_label} ({data.x_unit})"), fontproperties=font)
    axis.set_ylabel(_literal_label(f"{data.value_label} ({data.value_unit})"), fontproperties=font)
    if data.series_column is not None:
        axis.legend(frameon=False, prop=FontProperties(fname=str(FONT_PATH), size=9))
    axis.grid(color="#D9E1E5", linewidth=0.6)
    axis.set_axisbelow(True)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(),
                  axis.xaxis.get_offset_text(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.tight_layout()
    return figure


def render_trend(data: TrendData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Render only supplied vertices, including already cumulative input unchanged."""
    if not isinstance(data, TrendData):
        raise DatasetError("invalid_trend_contract")
    with rc_context({"text.usetex": False}):
        figure = _make_trend_figure(data)
    return _export_figure(
        figure, template_version=TREND_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data), style=style,
    )


def _make_interval_figure(data: IntervalData) -> Figure:
    if (not isinstance(data, IntervalData) or data.template_id not in INTERVAL_TEMPLATE_VERSIONS
            or not data.points):
        raise DatasetError("invalid_interval_contract")
    if len(data.points) > MAX_INTERVAL_POINTS:
        raise DatasetError("interval_limit_exceeded")
    ratio = data.effect_type in ("OR", "RR", "HR")
    if (data.interval_type not in ("CI", "SD", "SE")
            or (data.interval_type == "CI" and
                (data.ci_level is None or not data.ci_level.is_finite() or not 0 < data.ci_level < 100))
            or (data.interval_type != "CI" and data.ci_level is not None)
            or (data.template_id == "forest" and
                (data.interval_type != "CI" or data.effect_type not in ("OR", "RR", "HR", "MD", "SMD")))
            or (data.template_id == "dot-interval" and data.effect_type is not None)
            or (data.effect_type in ("OR", "RR", "HR", "SMD") and data.value_unit != data.effect_type)):
        raise DatasetError("invalid_interval_contract")
    labels = [point.label for point in data.points]
    if len(set(labels)) != len(labels):
        raise DatasetError("duplicate_interval_label")
    _check_font_coverage([*labels, data.value_unit], "unsupported_interval_glyph")
    for point in data.points:
        if any(not isfinite(float(v)) or (v != 0 and float(v) == 0)
               for v in (point.estimate, point.lower, point.upper)):
            raise DatasetError("invalid_interval_value")
        if not point.lower <= point.estimate <= point.upper:
            raise DatasetError("invalid_interval_bounds")
        if ratio and point.lower <= 0:
            raise DatasetError("nonpositive_forest_ratio")
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    positions = list(range(len(data.points)))
    # Endpoints are supplied by the author, not derived from an error magnitude.
    axis.hlines(positions, [float(p.lower) for p in data.points],
                [float(p.upper) for p in data.points], color=COLORS[0], linewidth=1.2)
    axis.scatter([float(p.estimate) for p in data.points], positions,
                 s=30, color=COLORS[0], zorder=3)
    if ratio:
        axis.set_xscale("log")
    if data.template_id == "forest":
        axis.axvline(1 if ratio else 0, color="#67747B", linestyle="--", linewidth=0.8)
    axis.set_yticks(positions, [_literal_label(label) for label in labels])
    axis.invert_yaxis()
    interval_label = f"{data.ci_level}% CI" if data.interval_type == "CI" else data.interval_type
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_xlabel(_literal_label(f"{data.value_unit} ({interval_label})"), fontproperties=font)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    axis.grid(axis="x", color="#D9E1E5", linewidth=0.6)
    axis.set_axisbelow(True)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(), axis.xaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.tight_layout()
    return figure


def render_intervals(data: IntervalData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Export dot intervals or forest results with explicit type and CI disclosure."""
    if not isinstance(data, IntervalData) or data.template_id not in INTERVAL_TEMPLATE_VERSIONS:
        raise DatasetError("invalid_interval_contract")
    with rc_context({"text.usetex": False}):
        figure = _make_interval_figure(data)
    return _export_figure(
        figure, template_version=INTERVAL_TEMPLATE_VERSIONS[data.template_id],
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data), style=style,
    )


def _make_ranked_figure(data: RankedData) -> Figure:
    if (not isinstance(data, RankedData) or data.template_id != "ranked-lollipop" or not data.points
            or data.ordering not in ("source", "ascending", "descending")
            or type(data.top_n) is not int or not 1 <= data.top_n <= 24):
        raise DatasetError("invalid_ranked_contract")
    groups = list(dict.fromkeys(p.group for p in data.points if p.group is not None))
    if len(data.points) > 5_000 or len(groups) > len(COLORS):
        raise DatasetError("ranked_limit_exceeded")
    if (len({p.label for p in data.points}) != len(data.points)
            or any((p.group is None) != (data.group_column is None) for p in data.points)):
        raise DatasetError("invalid_ranked_contract")
    if any(not isfinite(float(p.value)) or (p.value != 0 and float(p.value) == 0) for p in data.points):
        raise DatasetError("invalid_ranked_value")
    ordered = (list(data.points) if data.ordering == "source" else
               sorted(data.points, key=lambda p: p.value, reverse=data.ordering == "descending"))
    selected = ordered[:data.top_n]
    _check_font_coverage([data.value_unit, *groups, *(p.label for p in selected)], "unsupported_ranked_glyph")
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    plot_groups = groups or [None]
    for index, group in enumerate(plot_groups):
        members = [(position, point) for position, point in enumerate(selected) if point.group == group]
        if not members:
            continue
        positions = [position for position, _ in members]
        values = [float(point.value) for _, point in members]
        axis.hlines(positions, 0, values, color=COLORS[index], linewidth=1.1)
        axis.scatter(values, positions, s=28, color=COLORS[index],
                     label=_literal_label(group) if group is not None else None, zorder=3)
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_yticks(range(len(selected)), [_literal_label(p.label) for p in selected])
    axis.invert_yaxis()
    axis.set_xlabel(_literal_label(data.value_unit), fontproperties=font)
    axis.axvline(0, color="#67747B", linewidth=0.7)
    if groups:
        axis.legend(frameon=False, prop=FontProperties(fname=str(FONT_PATH), size=9))
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(), axis.xaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.text(0.02, 0.02, f"Order: {data.ordering}; ties: source order. "
                f"Shown {len(selected)} of {len(data.points)}; omitted {len(data.points) - len(selected)}.",
                fontproperties=font, fontsize=8)
    figure.tight_layout(rect=(0, 0.06, 1, 1))
    return figure


def render_ranked(data: RankedData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Render explicitly selected supplied scores and disclose excluded rows."""
    with rc_context({"text.usetex": False}):
        figure = _make_ranked_figure(data)
    return _export_figure(figure, template_version=RANKED_TEMPLATE_VERSION,
                          dataset_hash=data.dataset_hash, parser_version=data.parser_version,
                          figure_spec_hash=_spec_hash(data), style=style)


def _make_composition_figure(data: CompositionData) -> Figure:
    if (not isinstance(data, CompositionData) or data.template_id != "composition"
            or not data.cells or data.display not in ("count", "percent")):
        raise DatasetError("invalid_composition_contract")
    groups = list(dict.fromkeys(c.group for c in data.cells))
    components = list(dict.fromkeys(c.component for c in data.cells))
    if len(groups) > MAX_COMPOSITION_GROUPS or len(components) > MAX_COMPOSITION_COMPONENTS:
        raise DatasetError("composition_limit_exceeded")
    lookup = {(c.group, c.component): c for c in data.cells}
    if len(lookup) != len(data.cells) or len(lookup) != len(groups) * len(components):
        raise DatasetError("invalid_composition_contract")
    for group in groups:
        cells = [lookup[group, component] for component in components]
        for cell in cells:
            if any(not v.is_finite() or not 0 <= v <= MAX_EXACT_COUNT or v != v.to_integral_value()
                   for v in (cell.count, cell.denominator)):
                raise DatasetError("invalid_composition_count")
        denominator = cells[0].denominator
        if (denominator <= 0 or any(c.denominator != denominator for c in cells)
                or sum(int(c.count) for c in cells) != int(denominator)):
            raise DatasetError("invalid_composition_denominator")
    _check_font_coverage([data.count_unit, *groups, *components], "unsupported_composition_glyph")
    font = FontProperties(fname=str(FONT_PATH))
    figure = Figure(figsize=(max(8.0, 0.65 * len(groups) + 3), HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    bottom = [0.0] * len(groups)
    for index, component in enumerate(components):
        cells = [lookup[group, component] for group in groups]
        # Validated integers are exactly representable; ignore caller Decimal precision.
        values = [float(c.count) if data.display == "count" else
                  100.0 * (float(c.count) / float(c.denominator)) for c in cells]
        axis.bar(range(len(groups)), values, bottom=bottom, width=0.7,
                 color=COLORS[index], label=_literal_label(component))
        bottom = [base + value for base, value in zip(bottom, values)]
    axis.set_xticks(range(len(groups)), [f"{_literal_label(group)}\n(n={int(lookup[group, components[0]].denominator)})"
                                       for group in groups])
    axis.set_ylabel(_literal_label(data.count_unit if data.display == "count" else
                                  f"Percent of {data.count_unit} within group"), fontproperties=font)
    axis.set_ylim(0, 100 if data.display == "percent" else max(bottom) * 1.08)
    axis.legend(frameon=False, loc="upper left", bbox_to_anchor=(1, 1),
                prop=FontProperties(fname=str(FONT_PATH), size=9))
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.text(0.02, 0.02, "Declared mutually exclusive, exhaustive categories; supplied within-group totals.",
                fontproperties=font, fontsize=8)
    figure.tight_layout(rect=(0, 0.06, 1, 1))
    return figure


def render_composition(data: CompositionData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Show counts or explicitly requested percentages using supplied denominators."""
    with rc_context({"text.usetex": False}):
        figure = _make_composition_figure(data)
    return _export_figure(figure, template_version=COMPOSITION_TEMPLATE_VERSION,
                          dataset_hash=data.dataset_hash, parser_version=data.parser_version,
                          figure_spec_hash=_spec_hash(data), style=style)


def _make_volcano_figure(data: VolcanoData) -> Figure:
    if not isinstance(data, VolcanoData) or data.template_id != "volcano" or not data.points:
        raise DatasetError("invalid_volcano_contract")
    if len(data.points) > 5_000 or len({p.identifier for p in data.points}) != len(data.points):
        raise DatasetError("invalid_volcano_contract")
    validate_volcano_options(p_kind=data.p_kind, p_threshold=data.p_threshold,
                             fold_threshold=data.fold_threshold, zero_p_floor=data.zero_p_floor)
    ordinates = []
    for point in data.points:
        if not isfinite(float(point.log2fc)) or (point.log2fc != 0 and float(point.log2fc) == 0):
            raise DatasetError("invalid_volcano_value")
        if not point.p_value.is_finite() or not 0 <= point.p_value <= 1:
            raise DatasetError("invalid_volcano_p")
        if point.p_value == 0 and data.zero_p_floor is None:
            raise DatasetError("volcano_zero_floor_required")
        if point.p_value > 0 and data.zero_p_floor is not None and data.zero_p_floor > point.p_value:
            raise DatasetError("volcano_floor_above_observed_p")
        ordinates.append(volcano_ordinate(point.p_value if point.p_value > 0 else data.zero_p_floor))
    categories = [0 if p.p_value > data.p_threshold or p.log2fc.copy_abs() < data.fold_threshold
                  else 1 if p.log2fc < 0 else 2 for p in data.points]
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    for category, color, label in ((0, "#85939A", "Other"),
                                   (1, COLORS[0], "Thresholds met / negative"),
                                   (2, COLORS[1], "Thresholds met / positive")):
        selected = [i for i, value in enumerate(categories) if value == category]
        if selected:
            axis.scatter([float(data.points[i].log2fc) for i in selected],
                         [ordinates[i] for i in selected], s=22, color=color,
                         label=label, alpha=0.8, edgecolors="none")
    for threshold in (-float(data.fold_threshold), float(data.fold_threshold)):
        axis.axvline(threshold, color="#67747B", linestyle="--", linewidth=0.7)
    axis.axhline(volcano_ordinate(data.p_threshold), color="#67747B", linestyle="--", linewidth=0.7)
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_xlabel("log2 fold change (supplied)", fontproperties=font)
    p_label = "P" if data.p_kind == "p" else "adjusted P"
    axis.set_ylabel(f"-log10({p_label})", fontproperties=font)
    axis.set_ylim(bottom=0)
    axis.legend(frameon=False, prop=FontProperties(fname=str(FONT_PATH), size=8))
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(),
                  axis.xaxis.get_offset_text(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    zero_count = sum(p.p_value == 0 for p in data.points)
    note = f"Existing {p_label}; no tests or correction. Zero P values: {zero_count}."
    if zero_count:
        note += f" Zeros displayed at declared floor {data.zero_p_floor}; source values unchanged."
    figure.text(0.02, 0.02, "\n".join(wrap(note, width=105)), fontproperties=font, fontsize=8)
    figure.tight_layout(rect=(0, 0.09, 1, 1))
    return figure


def render_volcano(data: VolcanoData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    """Plot supplied differential results, with explicit zero handling and thresholds."""
    with rc_context({"text.usetex": False}):
        figure = _make_volcano_figure(data)
    return _export_figure(figure, template_version=VOLCANO_TEMPLATE_VERSION,
                          dataset_hash=data.dataset_hash, parser_version=data.parser_version,
                          figure_spec_hash=_spec_hash(data), style=style)


def _make_distribution_figure(data: DistributionData) -> Figure:
    if (not isinstance(data, DistributionData) or data.template_id != "distribution" or not data.points
            or len(data.points) > 5_000
            or any(type(p.value) is not Decimal or not p.value.is_finite() or len(str(p.value)) > 128
                   or not isfinite(float(p.value)) or (p.value != 0 and float(p.value) == 0)
                   or (p.group is None) != (data.group_column is None) for p in data.points)):
        raise DatasetError("invalid_distribution_contract")
    groups = list(dict.fromkeys(p.group for p in data.points))
    if len(groups) > len(COLORS):
        raise DatasetError("distribution_limit_exceeded")
    _check_font_coverage([data.value_unit, *(g for g in groups if g is not None)],
                         "unsupported_distribution_glyph")
    values = [float(p.value) for p in data.points]
    span = max(values) - min(values)
    padding = max(span * 0.1, 5e-324) if span else (abs(values[0]) * 0.05 if values[0] else 1.0)
    if not isfinite(span) or not all(isfinite(v) for v in (min(values) - padding, max(values) + padding)):
        raise DatasetError("unplottable_distribution_range")
    figure = Figure(figsize=(8.0, HEIGHT_INCHES), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.subplots()
    labels, singleton, constant = [], 0, 0
    for index, group in enumerate(groups):
        members = tuple(p.value for p in data.points if p.group == group)
        stats = distribution_box_stats(members)
        axis.bxp([stats], positions=[index], widths=0.48, patch_artist=True, showfliers=False,
                 boxprops=dict(facecolor=COLORS[index], edgecolor=COLORS[index], alpha=0.25),
                 whiskerprops=dict(color=COLORS[index]), capprops=dict(color=COLORS[index]),
                 medianprops=dict(color=COLORS[index], linewidth=1.5))
        # All rows plotted once; lateral displacement conveys no numerical measurement.
        offsets = [index + (0.3 * (i / (len(members) - 1) - 0.5) if len(members) > 1 else 0)
                   for i in range(len(members))]
        axis.scatter(offsets, [float(v) for v in members], s=18, color=COLORS[index], alpha=0.65, zorder=3)
        labels.append(f"{_literal_label(group) if group is not None else 'All observations'}\n(n={len(members)})")
        singleton += len(members) == 1
        constant += min(members) == max(members)
    font = FontProperties(fname=str(FONT_PATH))
    axis.set_xticks(range(len(groups)), labels)
    axis.set_ylabel(_literal_label(data.value_unit), fontproperties=font)
    axis.set_ylim(min(values) - padding, max(values) + padding)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    for label in (*axis.get_xticklabels(), *axis.get_yticklabels(), axis.yaxis.get_offset_text()):
        label.set_fontproperties(font)
    figure.text(0.02, 0.02, "HF type 7 quartiles; observed 1.5-IQR whiskers; all rows shown (no outlier deletion).\n"
                f"Singleton groups: {singleton}; constant groups (including singletons): {constant}. No KDE or tests.",
                fontproperties=font, fontsize=8)
    figure.tight_layout(rect=(0, 0.09, 1, 1))
    return figure


def render_distribution(data: DistributionData, *, style: FigureStyle = STANDARD_STYLE) -> RenderedFigure:
    with rc_context({"text.usetex": False}):
        figure = _make_distribution_figure(data)
    return _export_figure(figure, template_version=DISTRIBUTION_TEMPLATE_VERSION,
                          dataset_hash=data.dataset_hash, parser_version=data.parser_version,
                          figure_spec_hash=_spec_hash(data), style=style)
