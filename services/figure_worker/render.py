"""In-memory deterministic data-figure rendering; no upload or billing side effects."""

from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
from io import BytesIO
import json
from math import isfinite
from pathlib import Path
from platform import python_version

import matplotlib
from matplotlib import get_data_path, rc_context
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
from matplotlib.font_manager import FontProperties
from matplotlib.ft2font import FT2Font

from services.figure_worker.dataset import DatasetError, GroupedBarData, ScatterData


GROUPED_BAR_TEMPLATE_VERSION = "grouped-bar-v1"
SCATTER_TEMPLATE_VERSION = "scatter-v1"
DPI = 160
HEIGHT_INCHES = 5.5
FONT_NAME = "DejaVu Sans"
FONT_PATH = Path(get_data_path()) / "fonts" / "ttf" / "DejaVuSans.ttf"
FONT_SHA256 = sha256(FONT_PATH.read_bytes()).hexdigest()
LOCK_SHA256 = sha256(Path(__file__).with_name("uv.lock").read_bytes()).hexdigest()
COLORS = ("#0B6970", "#B35431", "#4A6099", "#78639B",
          "#729444", "#A4436D", "#9A742E", "#567F8F")


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
    artifacts: tuple[FigureArtifact, ...] = field(repr=False)


def _literal_label(value: str) -> str:
    # Mathtext is not part of this template; retain dollar signs as plain labels.
    return value.replace("$", r"\$")


def _spec_hash(data: GroupedBarData | ScatterData) -> str:
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


def _export_figure(
    figure: Figure, *, template_version: str, dataset_hash: str,
    parser_version: str, figure_spec_hash: str,
) -> RenderedFigure:
    """Export a frozen figure to three formats with identical input provenance."""
    with rc_context({
        "font.family": FONT_NAME,
        "text.usetex": False,
        "svg.fonttype": "path",
        "svg.hashsalt": figure_spec_hash,
    }):
        try:
            outputs = []
            for format_name, media_type, metadata in (
                ("png", "image/png", {"Software": "Sci-Necromancer figure worker"}),
                ("pdf", "application/pdf", {"CreationDate": None, "Creator": "Sci-Necromancer figure worker"}),
                ("svg", "image/svg+xml", {"Date": None, "Creator": "Sci-Necromancer figure worker"}),
            ):
                stream = BytesIO()
                figure.savefig(stream, format=format_name, dpi=DPI, metadata=metadata,
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
        dpi=DPI,
        width_inches=float(figure.get_size_inches()[0]),
        height_inches=HEIGHT_INCHES,
        randomness="none",
        artifacts=tuple(outputs),
    )


def render_grouped_bar(data: GroupedBarData) -> RenderedFigure:
    """Render one validated grouped-bar version to PNG/PDF/SVG bytes in memory."""
    if not isinstance(data, GroupedBarData):
        raise DatasetError("invalid_grouped_bar_contract")
    return _export_figure(
        _make_figure(data), template_version=GROUPED_BAR_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data),
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


def render_scatter(data: ScatterData) -> RenderedFigure:
    """Render raw x/y observations only; never infer a fit or significance."""
    if not isinstance(data, ScatterData):
        raise DatasetError("invalid_scatter_contract")
    return _export_figure(
        _make_scatter_figure(data), template_version=SCATTER_TEMPLATE_VERSION,
        dataset_hash=data.dataset_hash, parser_version=data.parser_version,
        figure_spec_hash=_spec_hash(data),
    )
