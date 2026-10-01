"""Strict local CSV/FigureSpec boundary; never execute model-provided code."""

from __future__ import annotations

import re

from services.figure_worker.dataset import (
    DatasetError, parse_csv_bytes, validate_grouped_bar, validate_heatmap,
    validate_intervals, validate_scatter, validate_trend,
)
from services.figure_worker.render import (
    GROUPED_BAR_TEMPLATE_VERSION, HEATMAP_TEMPLATE_VERSION, INTERVAL_TEMPLATE_VERSIONS,
    SCATTER_TEMPLATE_VERSION, TREND_TEMPLATE_VERSION, RenderedFigure,
    render_grouped_bar, render_heatmap, render_intervals, render_scatter, render_trend,
)


SCHEMA_VERSION = "figure-spec-v1"
TEMPLATE_VERSIONS = {
    "grouped-bar": GROUPED_BAR_TEMPLATE_VERSION,
    "scatter": SCATTER_TEMPLATE_VERSION,
    "heatmap": HEATMAP_TEMPLATE_VERSION,
    "trend": TREND_TEMPLATE_VERSION,
    **INTERVAL_TEMPLATE_VERSIONS,
}


def render_csv_spec(payload: bytes, spec: dict) -> RenderedFigure:
    """Validate a frozen plan and source hash, then render with installed templates.

    This is a local boundary, not a member API: ownership, lease/billing and
    renderer isolation must be enforced by the future task orchestration layer.
    """
    if type(spec) is not dict:
        raise DatasetError("invalid_figure_spec")
    required = {"schema_version", "template_id", "template_version", "dataset_sha256", "mapping", "units"}
    if not required <= spec.keys() or spec.keys() - required - {"interval"}:
        raise DatasetError("invalid_figure_spec_fields")
    if spec["schema_version"] != SCHEMA_VERSION:
        raise DatasetError("unsupported_figure_spec_version")
    template = spec["template_id"]
    if type(template) is not str or template not in TEMPLATE_VERSIONS:
        raise DatasetError("unavailable_figure_template")
    if spec["template_version"] != TEMPLATE_VERSIONS[template]:
        raise DatasetError("unsupported_figure_template_version")
    source_hash = spec["dataset_sha256"]
    if type(source_hash) is not str or re.fullmatch(r"[a-f0-9]{64}", source_hash) is None:
        raise DatasetError("invalid_figure_dataset_hash")
    mapping, units = spec["mapping"], spec["units"]
    if type(mapping) is not dict or type(units) is not dict:
        raise DatasetError("invalid_figure_spec_mapping")
    if template == "grouped-bar":
        roles, optional, unit_roles = {"category", "value"}, {"group"}, {"value"}
    elif template == "scatter":
        roles, optional, unit_roles = {"x", "y"}, {"group"}, {"x", "y"}
    elif template == "heatmap":
        roles, optional, unit_roles = {"row", "column", "value"}, set(), {"value"}
    elif template == "trend":
        roles, optional, unit_roles = {"x", "value"}, {"series"}, {"x", "value"}
    else:
        roles, optional, unit_roles = {"label", "estimate", "lower", "upper"}, set(), {"value"}
    if (not roles <= mapping.keys() or mapping.keys() - roles - optional
            or any(type(column) is not str or re.fullmatch(r"col_([1-9][0-9]?|100)", column) is None
                   for column in mapping.values())):
        raise DatasetError("invalid_figure_spec_mapping")
    if (units.keys() != unit_roles
            or any(type(unit) is not str or not unit.strip() or len(unit) > 48 for unit in units.values())):
        raise DatasetError("invalid_figure_spec_units")
    if template in INTERVAL_TEMPLATE_VERSIONS:
        interval = spec.get("interval")
        if (type(interval) is not dict or "type" not in interval
                or interval.keys() - {"type", "ci_level", "effect_type"}
                or type(interval["type"]) is not str
                or ("ci_level" in interval and
                    (type(interval["ci_level"]) not in (int, float, str)
                     or len(str(interval["ci_level"])) > 16))
                or ("effect_type" in interval and type(interval["effect_type"]) is not str)):
            raise DatasetError("invalid_figure_spec_interval")
    elif "interval" in spec:
        raise DatasetError("invalid_figure_spec_fields")
    dataset = parse_csv_bytes(payload)
    if dataset.sha256 != source_hash:
        raise DatasetError("figure_dataset_hash_mismatch")
    if template == "grouped-bar":
        return render_grouped_bar(validate_grouped_bar(
            dataset, category_column=mapping["category"], value_column=mapping["value"],
            group_column=mapping.get("group"), value_unit=units["value"],
        ))
    if template == "scatter":
        return render_scatter(validate_scatter(
            dataset, x_column=mapping["x"], y_column=mapping["y"], group_column=mapping.get("group"),
            x_unit=units["x"], y_unit=units["y"],
        ))
    if template == "heatmap":
        return render_heatmap(validate_heatmap(
            dataset, row_column=mapping["row"], column_column=mapping["column"],
            value_column=mapping["value"], value_unit=units["value"],
        ))
    if template == "trend":
        return render_trend(validate_trend(
            dataset, x_column=mapping["x"], value_column=mapping["value"],
            series_column=mapping.get("series"), x_unit=units["x"], value_unit=units["value"],
        ))
    return render_intervals(validate_intervals(
        dataset, template_id=template, label_column=mapping["label"],
        estimate_column=mapping["estimate"], lower_column=mapping["lower"], upper_column=mapping["upper"],
        value_unit=units["value"], interval_type=interval["type"],
        ci_level=interval.get("ci_level"), effect_type=interval.get("effect_type"),
    ))
