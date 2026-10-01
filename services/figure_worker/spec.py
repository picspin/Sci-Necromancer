"""Strict local CSV/FigureSpec boundary; never execute model-provided code."""

from __future__ import annotations

import re

from services.figure_worker.dataset import (
    DatasetError, parse_csv_bytes, validate_composition, validate_grouped_bar, validate_heatmap,
    validate_intervals, validate_ranked, validate_scatter, validate_trend, validate_volcano,
)
from services.figure_worker.render import (
    COMPOSITION_TEMPLATE_VERSION, GROUPED_BAR_TEMPLATE_VERSION, HEATMAP_TEMPLATE_VERSION, INTERVAL_TEMPLATE_VERSIONS,
    RANKED_TEMPLATE_VERSION, SCATTER_TEMPLATE_VERSION, TREND_TEMPLATE_VERSION, VOLCANO_TEMPLATE_VERSION, RenderedFigure,
    render_composition, render_grouped_bar, render_heatmap, render_intervals, render_ranked, render_scatter, render_trend, render_volcano,
)


SCHEMA_VERSION = "figure-spec-v1"
TEMPLATE_VERSIONS = {
    "grouped-bar": GROUPED_BAR_TEMPLATE_VERSION,
    "scatter": SCATTER_TEMPLATE_VERSION,
    "heatmap": HEATMAP_TEMPLATE_VERSION,
    "trend": TREND_TEMPLATE_VERSION,
    "ranked-lollipop": RANKED_TEMPLATE_VERSION,
    "composition": COMPOSITION_TEMPLATE_VERSION,
    "volcano": VOLCANO_TEMPLATE_VERSION,
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
    if not required <= spec.keys() or spec.keys() - required - {"interval", "ranking", "composition", "volcano"}:
        raise DatasetError("invalid_figure_spec_fields")
    if spec["schema_version"] != SCHEMA_VERSION:
        raise DatasetError("unsupported_figure_spec_version")
    template = spec["template_id"]
    if type(template) is not str or template not in TEMPLATE_VERSIONS:
        raise DatasetError("unavailable_figure_template")
    allowed_options = ({"interval"} if template in INTERVAL_TEMPLATE_VERSIONS else
                       {"ranking"} if template == "ranked-lollipop" else
                       {"composition"} if template == "composition" else
                       {"volcano"} if template == "volcano" else set())
    if spec.keys() - required - allowed_options:
        raise DatasetError("invalid_figure_spec_fields")
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
    elif template == "ranked-lollipop":
        roles, optional, unit_roles = {"label", "value"}, {"group"}, {"value"}
    elif template == "composition":
        roles, optional, unit_roles = {"group", "component", "count", "denominator"}, set(), {"count"}
    elif template == "volcano":
        roles, optional, unit_roles = {"identifier", "log2fc", "p"}, set(), {"log2fc", "p"}
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
    elif template == "ranked-lollipop":
        ranking = spec.get("ranking")
        if (type(ranking) is not dict or ranking.keys() != {"ordering", "top_n"}
                or type(ranking["ordering"]) is not str or type(ranking["top_n"]) is not int):
            raise DatasetError("invalid_figure_spec_ranking")
    elif template == "composition":
        composition = spec.get("composition")
        if (type(composition) is not dict
                or composition.keys() != {"display", "denominator_scope", "mutually_exclusive", "exhaustive"}
                or type(composition["display"]) is not str or type(composition["denominator_scope"]) is not str
                or composition["mutually_exclusive"] is not True or composition["exhaustive"] is not True):
            raise DatasetError("invalid_figure_spec_composition")
    elif template == "volcano":
        volcano = spec.get("volcano")
        required_options = {"p_kind", "p_threshold", "fold_threshold"}
        if (type(volcano) is not dict or not required_options <= volcano.keys()
                or volcano.keys() - required_options - {"zero_p_floor"}
                or type(volcano["p_kind"]) is not str
                or any(type(value) not in (int, float, str)
                       for key, value in volcano.items()
                       if key != "p_kind" and not (key == "zero_p_floor" and value is None))):
            raise DatasetError("invalid_figure_spec_volcano")
        if units != {"log2fc": "log2 fold change", "p": "probability"}:
            raise DatasetError("invalid_figure_spec_units")
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
    if template == "ranked-lollipop":
        return render_ranked(validate_ranked(
            dataset, label_column=mapping["label"], value_column=mapping["value"],
            group_column=mapping.get("group"), value_unit=units["value"],
            ordering=ranking["ordering"], top_n=ranking["top_n"],
        ))
    if template == "composition":
        return render_composition(validate_composition(
            dataset, group_column=mapping["group"], component_column=mapping["component"],
            count_column=mapping["count"], denominator_column=mapping["denominator"],
            count_unit=units["count"], **composition,
        ))
    if template == "volcano":
        return render_volcano(validate_volcano(
            dataset, identifier_column=mapping["identifier"], log2fc_column=mapping["log2fc"],
            p_column=mapping["p"], **volcano,
        ))
    return render_intervals(validate_intervals(
        dataset, template_id=template, label_column=mapping["label"],
        estimate_column=mapping["estimate"], lower_column=mapping["lower"], upper_column=mapping["upper"],
        value_unit=units["value"], interval_type=interval["type"],
        ci_level=interval.get("ci_level"), effect_type=interval.get("effect_type"),
    ))
