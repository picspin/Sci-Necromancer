"""Local, bounded composite plans. No scripts, joins, model calls or billing."""

from dataclasses import dataclass, replace
from hashlib import sha256
import json
from math import isfinite
import re
from textwrap import wrap

from matplotlib import rc_context
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
from matplotlib.font_manager import FontProperties
from matplotlib.transforms import Bbox

from services.figure_worker.dataset import (
    DatasetError, GroupedBarData, HeatmapData, IntervalData, _safe_label,
    parse_csv_bytes, validate_grouped_bar, validate_heatmap, validate_intervals,
)
from services.figure_worker.render import (
    DPI, FONT_PATH, GROUPED_BAR_TEMPLATE_VERSION, HEATMAP_TEMPLATE_VERSION, INTERVAL_TEMPLATE_VERSIONS,
    FigureArtifact, RenderedFigure, _check_font_coverage, _draw_grouped_bar, _draw_heatmap,
    _draw_intervals, _export_figure, _literal_label, _spec_hash,
)
from services.figure_worker.styles import FigureStyle, resolve_style


SCHEMA_VERSION = "figure-multipanel-spec-v1"
TEMPLATE_VERSION = "multipanel-grid-v1"
TEMPLATES = {"grouped-bar": GROUPED_BAR_TEMPLATE_VERSION, "heatmap": HEATMAP_TEMPLATE_VERSION,
             "dot-interval": INTERVAL_TEMPLATE_VERSIONS["dot-interval"]}


@dataclass(frozen=True)
class Panel:
    title: str
    source_rows: tuple[int, ...]
    data: GroupedBarData | HeatmapData | IntervalData


@dataclass(frozen=True)
class MultipanelPlan:
    title: str
    synthetic: bool
    style: FigureStyle
    frozen_spec: bytes
    panels: tuple[Panel, ...]


def validate_csv_multipanel_spec(payload: bytes, spec: dict) -> MultipanelPlan:
    required = {"schema_version", "dataset_sha256", "record_type_column", "title", "synthetic", "style", "panels"}
    if type(spec) is not dict or spec.keys() != required:
        raise DatasetError("invalid_multipanel_spec_fields")
    if spec["schema_version"] != SCHEMA_VERSION:
        raise DatasetError("unsupported_multipanel_spec_version")
    if type(spec["dataset_sha256"]) is not str or re.fullmatch(r"[a-f0-9]{64}", spec["dataset_sha256"]) is None:
        raise DatasetError("invalid_figure_dataset_hash")
    if type(spec["synthetic"]) is not bool or type(spec["panels"]) is not list or not 2 <= len(spec["panels"]) <= 4:
        raise DatasetError("invalid_multipanel_contract")
    if type(spec["title"]) is not str:
        raise DatasetError("invalid_multipanel_title")
    title = _safe_label(spec["title"], max_length=120, error_code="invalid_multipanel_title")
    style = resolve_style(spec["style"])
    dataset = parse_csv_bytes(payload)
    if dataset.sha256 != spec["dataset_sha256"]:
        raise DatasetError("figure_dataset_hash_mismatch")
    ids = {c.id: i for i, c in enumerate(dataset.columns)}
    discriminator = spec["record_type_column"]
    if type(discriminator) is not str or discriminator not in ids:
        raise DatasetError("invalid_multipanel_record_type_column")
    panels, covered, group_colors = [], set(), {}
    for raw in spec["panels"]:
        fields = {"template_id", "template_version", "title", "record_type", "mapping", "units"}
        if type(raw) is not dict or not fields <= raw.keys() or raw.keys() - fields - {"interval"}:
            raise DatasetError("invalid_multipanel_panel_fields")
        template = raw["template_id"]
        if type(template) is not str or template not in TEMPLATES:
            raise DatasetError("unavailable_multipanel_template")
        if raw["template_version"] != TEMPLATES[template]:
            raise DatasetError("unsupported_figure_template_version")
        if ("interval" in raw) != (template == "dot-interval"):
            raise DatasetError("invalid_multipanel_panel_fields")
        if type(raw["title"]) is not str:
            raise DatasetError("invalid_multipanel_title")
        panel_title = _safe_label(raw["title"], max_length=80, error_code="invalid_multipanel_title")
        record_type = raw["record_type"]
        if type(record_type) is not str or re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", record_type) is None:
            raise DatasetError("invalid_multipanel_record_type")
        mapping, units = raw["mapping"], raw["units"]
        roles = ({"category", "value"} if template == "grouped-bar" else
                 {"row", "column", "value"} if template == "heatmap" else
                 {"label", "estimate", "lower", "upper"})
        optional = {"group"} if template == "grouped-bar" else set()
        if (type(mapping) is not dict or not roles <= mapping.keys() or mapping.keys() - roles - optional
                or any(type(c) is not str or c not in ids or c == discriminator for c in mapping.values())):
            raise DatasetError("invalid_figure_spec_mapping")
        if type(units) is not dict or units.keys() != {"value"}:
            raise DatasetError("invalid_figure_spec_units")
        source_rows = tuple(i for i, row in enumerate(dataset._rows, start=2) if row[ids[discriminator]] == record_type)
        if not source_rows:
            raise DatasetError("empty_multipanel_selection")
        selected = replace(dataset, row_count=len(source_rows), _rows=tuple(dataset._rows[i - 2] for i in source_rows))
        try:
            if template == "grouped-bar":
                data = validate_grouped_bar(selected, category_column=mapping["category"], value_column=mapping["value"],
                                            group_column=mapping.get("group"), value_unit=units["value"])
            elif template == "heatmap":
                data = validate_heatmap(selected, row_column=mapping["row"], column_column=mapping["column"],
                                        value_column=mapping["value"], value_unit=units["value"])
            else:
                interval = raw["interval"]
                if (type(interval) is not dict or "type" not in interval or interval.keys() - {"type", "ci_level"}
                        or type(interval["type"]) is not str or ("ci_level" in interval and
                        (type(interval["ci_level"]) not in (str, int, float) or len(str(interval["ci_level"])) > 16))):
                    raise DatasetError("invalid_figure_spec_interval")
                data = validate_intervals(selected, template_id=template, label_column=mapping["label"],
                                          estimate_column=mapping["estimate"], lower_column=mapping["lower"],
                                          upper_column=mapping["upper"], value_unit=units["value"],
                                          interval_type=interval["type"], ci_level=interval.get("ci_level"))
        except DatasetError as error:
            row = source_rows[error.row - 2] if error.row is not None else None
            raise DatasetError(error.code, row=row, column=error.column) from error
        if isinstance(data, GroupedBarData):
            for index, group in enumerate(dict.fromkeys(p.group for p in data.points if p.group is not None)):
                if group_colors.setdefault(group, index) != index:
                    raise DatasetError("inconsistent_multipanel_group_order")
        covered.update(source_rows)
        panels.append(Panel(panel_title, source_rows, data))
    if len(covered) != dataset.row_count:
        raise DatasetError("uncovered_multipanel_rows")
    frozen = json.dumps(spec, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return MultipanelPlan(title, spec["synthetic"], style, frozen, tuple(panels))


def _make_multipanel_figure(plan: MultipanelPlan) -> Figure:
    """Reuse vector artists; do not paste single-panel raster exports into a canvas."""
    _check_font_coverage([plan.title, *(p.title for p in plan.panels)], "unsupported_multipanel_glyph")
    rows = 1 if len(plan.panels) == 2 else 2
    figure = Figure(figsize=(16, 5.5 * rows), dpi=DPI, facecolor="white")
    FigureCanvasAgg(figure)
    grid = figure.add_gridspec(rows, 2)
    font = FontProperties(fname=str(FONT_PATH))
    panel_axes = []
    try:
        for index, panel in enumerate(plan.panels):
            axis = figure.add_subplot(grid[index // 2, index % 2])
            before = set(figure.axes)
            if isinstance(panel.data, GroupedBarData):
                limits = _draw_grouped_bar(panel.data, axis)
                applied = axis.get_ylim()
                if axis.get_legend() is not None:
                    handles, labels = axis.get_legend_handles_labels()
                    axis.legend(handles, labels, frameon=False, loc="lower right", bbox_to_anchor=(1, 1.02),
                                ncol=min(4, len(handles)), prop=FontProperties(fname=str(FONT_PATH), size=9))
            elif isinstance(panel.data, HeatmapData):
                limits = _draw_heatmap(panel.data, axis)
                raw_values = [c.value for c in panel.data.cells]
                if min(raw_values) != max(raw_values) and limits[0] == limits[1]:
                    raise DatasetError("unplottable_multipanel_range")
                if limits[0] == limits[1]:
                    padding = abs(limits[0]) * 0.1 if limits[0] else 0.1
                    limits = (limits[0] - padding, limits[1] + padding)
                    axis.images[0].set_clim(*limits)
                applied = axis.images[0].get_clim()
            else:
                points = panel.data.points
                if any(p.lower != p.upper and float(p.lower) == float(p.upper) for p in points):
                    raise DatasetError("unplottable_multipanel_range")
                low, high = min(float(p.lower) for p in points), max(float(p.upper) for p in points)
                padding = (high - low) * 0.05 if high != low else abs(low) * 0.05 if low else 1.0
                limits = (low - padding, high + padding)
                if (not all(isfinite(v) for v in limits) or not isfinite(sum(limits))
                        or not isfinite(limits[1] - limits[0]) or limits[0] >= limits[1]):
                    raise DatasetError("unplottable_multipanel_range")
                axis.set_xlim(*limits)
                _draw_intervals(panel.data, axis)
                applied = axis.get_xlim()
            if (not all(isfinite(v) for v in limits) or not isfinite(limits[1] - limits[0])
                    or limits[0] >= limits[1] or applied != limits):
                raise DatasetError("unplottable_multipanel_range")
            axis.set_title(_literal_label("\n".join(wrap(f"{'ABCD'[index]}. {panel.title}", width=42))),
                           fontproperties=font, fontsize=11, loc="left", pad=15)
            panel_axes.append([axis, *(a for a in figure.axes if a not in before)])
        figure.suptitle(_literal_label("\n".join(wrap(plan.title, width=80))),
                        fontproperties=font, fontsize=14, y=0.97)
        disclosure = ("SYNTHETIC DEMONSTRATION - NOT RESEARCH EVIDENCE" if plan.synthetic else
                      "Supplied results only; no statistical inference.")
        figure.text(0.5, 0.025, disclosure + "\nValues and interval endpoints supplied; no AUC/CI estimation.",
                    ha="center", fontproperties=font, fontsize=9)
        figure.tight_layout(rect=(0.015, 0.085, 0.985, 0.91), pad=2, h_pad=4, w_pad=4)
        figure.canvas.draw()
        renderer = figure.canvas.get_renderer()
        bounds = [Bbox.union([a.get_tightbbox(renderer) for a in axes]).transformed(figure.transFigure.inverted())
                  for axes in panel_axes]
        if any(b.x0 < 0.015 or b.x1 > 0.985 or b.y0 < 0.085 or b.y1 > 0.91 for b in bounds):
            raise DatasetError("unplottable_multipanel_layout")
        if any(a.overlaps(b) for i, a in enumerate(bounds) for b in bounds[i + 1:]):
            raise DatasetError("overlapping_multipanel_layout")
        text_bounds = [t.get_window_extent(renderer).transformed(figure.transFigure.inverted()) for t in figure.texts]
        if (any(b.x0 < 0 or b.x1 > 1 or b.y0 < 0 or b.y1 > 1 for b in text_bounds)
                or any(a.overlaps(b) for a in text_bounds for b in bounds)):
            raise DatasetError("unplottable_multipanel_layout")
        return figure
    except DatasetError:
        figure.clear()
        raise
    except (ValueError, OverflowError) as error:
        figure.clear()
        raise DatasetError("unplottable_multipanel_range") from error
    except Exception:
        figure.clear()
        raise


def render_csv_multipanel_spec(payload: bytes, spec: dict) -> RenderedFigure:
    """Validate all panels before publishing any output, with original-row provenance."""
    plan = validate_csv_multipanel_spec(payload, spec)
    evidence = dict(
        template_version=TEMPLATE_VERSION, spec=json.loads(plan.frozen_spec),
        panels=[dict(source_rows=p.source_rows, data_spec_hash=_spec_hash(p.data)) for p in plan.panels],
        layout="two-columns-source-panel-order", transformations="none", inference="none",
    )
    evidence_bytes = json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode()
    with rc_context({"text.usetex": False}):
        figure = _make_multipanel_figure(plan)
    result = _export_figure(figure, template_version=TEMPLATE_VERSION, dataset_hash=plan.panels[0].data.dataset_hash,
                            parser_version=plan.panels[0].data.parser_version,
                            figure_spec_hash=sha256(evidence_bytes).hexdigest(), style=plan.style)
    manifest = dict(evidence, figure_spec_hash=result.figure_spec_hash,
                    parser_version=result.parser_version, python_version=result.python_version,
                    matplotlib_version=result.matplotlib_version, dependency_lock_sha256=result.dependency_lock_sha256,
                    font=result.font, font_sha256=result.font_sha256, style_sha256=result.style_sha256,
                    width_inches=result.width_inches, height_inches=result.height_inches, dpi=result.dpi,
                    randomness=result.randomness,
                    artifacts=[dict(format=a.format, media_type=a.media_type, sha256=a.sha256) for a in result.artifacts])
    content = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    artifact = FigureArtifact("manifest", "application/json", sha256(content).hexdigest(), content)
    return replace(result, artifacts=(*result.artifacts, artifact))
