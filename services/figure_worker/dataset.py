"""Bounded CSV intake and the first deterministic data-figure input contract.

This module does not call a model, infer a statistical result, or render an image.
Raw rows remain inside ``ParsedCsv`` and must not be forwarded to Jev or an LLM.
"""

from __future__ import annotations

import csv
from bisect import bisect_right
from dataclasses import dataclass, field
from decimal import Context, Decimal, InvalidOperation, ROUND_HALF_EVEN
from fractions import Fraction
from hashlib import sha256
from io import StringIO
from math import isfinite
from unicodedata import category as unicode_category, normalize


PARSER_VERSION = "csv-v1"
MAX_CSV_BYTES = 10 * 1024 * 1024
MAX_ROWS = 50_000
MAX_COLUMNS = 100
MAX_CELLS = 1_000_000
MAX_GROUPED_BAR_POINTS = 96
MAX_GROUPED_BAR_CATEGORIES = 24
MAX_GROUPED_BAR_GROUPS = 8
MAX_SCATTER_POINTS = 5_000
MAX_SCATTER_GROUPS = 8
MAX_HEATMAP_DIMENSION = 12
MAX_INTERVAL_POINTS = 24
MAX_COMPOSITION_GROUPS = 12
MAX_COMPOSITION_COMPONENTS = 8
MAX_EXACT_COUNT = 2**53 - 1


class DatasetError(ValueError):
    """A content-free error suitable for a future user-facing validation layer."""

    def __init__(self, code: str, *, row: int | None = None, column: str | None = None):
        super().__init__(code)
        self.code = code
        self.row = row
        self.column = column


@dataclass(frozen=True)
class ColumnProfile:
    id: str
    name: str = field(repr=False)
    kind: str
    missing_count: int


@dataclass(frozen=True)
class ParsedCsv:
    parser_version: str
    sha256: str
    byte_count: int
    row_count: int
    columns: tuple[ColumnProfile, ...]
    _rows: tuple[tuple[str, ...], ...] = field(repr=False)


@dataclass(frozen=True)
class GroupedBarPoint:
    category: str = field(repr=False)
    group: str | None = field(repr=False)
    value: Decimal


@dataclass(frozen=True)
class GroupedBarData:
    template_id: str
    parser_version: str
    dataset_hash: str
    category_column: str
    value_column: str
    group_column: str | None
    value_unit: str
    points: tuple[GroupedBarPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class ScatterPoint:
    x: Decimal
    y: Decimal
    group: str | None = field(repr=False)


@dataclass(frozen=True)
class ScatterData:
    template_id: str
    parser_version: str
    dataset_hash: str
    x_column: str
    y_column: str
    group_column: str | None
    x_unit: str
    y_unit: str
    x_label: str = field(repr=False)
    y_label: str = field(repr=False)
    points: tuple[ScatterPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class HeatmapCell:
    row_label: str = field(repr=False)
    column_label: str = field(repr=False)
    value: Decimal


@dataclass(frozen=True)
class HeatmapData:
    template_id: str
    parser_version: str
    dataset_hash: str
    row_column: str
    column_column: str
    value_column: str
    value_unit: str
    cells: tuple[HeatmapCell, ...] = field(repr=False)


@dataclass(frozen=True)
class TrendData:
    template_id: str
    parser_version: str
    dataset_hash: str
    x_column: str
    value_column: str
    series_column: str | None
    x_unit: str
    value_unit: str
    x_label: str = field(repr=False)
    value_label: str = field(repr=False)
    # Each point's group is the user-mapped series; no grouping inference.
    points: tuple[ScatterPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class IntervalPoint:
    label: str = field(repr=False)
    estimate: Decimal
    lower: Decimal
    upper: Decimal


@dataclass(frozen=True)
class IntervalData:
    template_id: str
    parser_version: str
    dataset_hash: str
    label_column: str
    estimate_column: str
    lower_column: str
    upper_column: str
    value_unit: str
    interval_type: str
    ci_level: Decimal | None
    effect_type: str | None
    points: tuple[IntervalPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class RankedPoint:
    label: str = field(repr=False)
    value: Decimal
    group: str | None = field(repr=False)


@dataclass(frozen=True)
class RankedData:
    template_id: str
    parser_version: str
    dataset_hash: str
    label_column: str
    value_column: str
    group_column: str | None
    value_unit: str
    ordering: str
    top_n: int
    points: tuple[RankedPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class CompositionCell:
    group: str = field(repr=False)
    component: str = field(repr=False)
    count: Decimal
    denominator: Decimal


@dataclass(frozen=True)
class CompositionData:
    template_id: str
    parser_version: str
    dataset_hash: str
    group_column: str
    component_column: str
    count_column: str
    denominator_column: str
    count_unit: str
    display: str
    cells: tuple[CompositionCell, ...] = field(repr=False)


@dataclass(frozen=True)
class VolcanoPoint:
    identifier: str = field(repr=False)
    log2fc: Decimal
    p_value: Decimal


@dataclass(frozen=True)
class VolcanoData:
    template_id: str
    parser_version: str
    dataset_hash: str
    identifier_column: str
    log2fc_column: str
    p_column: str
    p_kind: str
    p_threshold: Decimal
    fold_threshold: Decimal
    zero_p_floor: Decimal | None
    points: tuple[VolcanoPoint, ...] = field(repr=False)


@dataclass(frozen=True)
class DistributionPoint:
    value: Decimal
    group: str | None = field(repr=False)


@dataclass(frozen=True)
class DistributionData:
    template_id: str
    parser_version: str
    dataset_hash: str
    value_column: str
    group_column: str | None
    value_unit: str
    points: tuple[DistributionPoint, ...] = field(repr=False)
    bin_edges: tuple[Decimal, ...] | None = field(default=None, repr=False)


@dataclass(frozen=True)
class RadarAxis:
    metric: str = field(repr=False)
    unit: str = field(repr=False)
    lower: Decimal
    upper: Decimal
    direction: str


@dataclass(frozen=True)
class RadarPoint:
    method: str = field(repr=False)
    metric: str = field(repr=False)
    value: Decimal


@dataclass(frozen=True)
class RadarData:
    template_id: str
    parser_version: str
    dataset_hash: str
    method_column: str
    metric_column: str
    value_column: str
    axes: tuple[RadarAxis, ...] = field(repr=False)
    points: tuple[RadarPoint, ...] = field(repr=False)


def validate_volcano_options(
    *, p_kind: str, p_threshold: int | float | str | Decimal,
    fold_threshold: int | float | str | Decimal,
    zero_p_floor: int | float | str | Decimal | None,
) -> tuple[Decimal, Decimal, Decimal | None]:
    """Shared by intake and renderer: explicit existing-P semantics, never FDR."""
    if p_kind not in ("p", "adjusted_p"):
        raise DatasetError("invalid_volcano_p_kind")
    values = []
    for raw in (p_threshold, fold_threshold, zero_p_floor):
        if raw is None and len(values) == 2:
            values.append(None)
            continue
        if type(raw) not in (int, float, str, Decimal) or len(str(raw)) > 128:
            raise DatasetError("invalid_volcano_threshold")
        try:
            value = Decimal(str(raw))
        except InvalidOperation as error:
            raise DatasetError("invalid_volcano_threshold") from error
        if not value.is_finite() or value <= 0:
            raise DatasetError("invalid_volcano_threshold")
        values.append(value)
    p, fold, floor = values
    if (p >= 1 or not isfinite(float(fold)) or float(fold) == 0
            or (floor is not None and (floor >= 1 or floor > p))):
        raise DatasetError("invalid_volcano_threshold")
    volcano_ordinate(p)
    if floor is not None:
        volcano_ordinate(floor)
    return p, fold, floor


def volcano_ordinate(p_value: Decimal) -> float:
    """Convert positive P without float underflow; fixed 28-digit log10 context."""
    if not p_value.is_finite() or not 0 < p_value <= 1:
        raise DatasetError("invalid_volcano_p")
    result = float(p_value.log10(context=Context(prec=28, rounding=ROUND_HALF_EVEN)).copy_negate())
    if not isfinite(result) or (p_value < 1 and result == 0):
        raise DatasetError("unplottable_volcano_p")
    return result


def _numeric_kind(values: list[str]) -> str:
    present = [value for value in values if value.strip()]
    if not present:
        return "empty"
    numeric = 0
    for value in present:
        try:
            numeric += Decimal(value.strip()).is_finite()
        except InvalidOperation:
            pass
    if numeric == len(present):
        return "numeric"
    return "mixed" if numeric else "text"


def _safe_label(value: str, *, max_length: int, error_code: str) -> str:
    label = normalize("NFC", value.strip())
    if (not label or len(label) > max_length
            or any(unicode_category(char) in {"Cc", "Cf", "Cs"} for char in label)):
        raise DatasetError(error_code)
    return label


def parse_csv_bytes(payload: bytes) -> ParsedCsv:
    """Parse one UTF-8, comma-delimited sheet without guessing units or types."""
    if not isinstance(payload, bytes) or not payload or len(payload) > MAX_CSV_BYTES:
        raise DatasetError("invalid_csv_size")
    try:
        text = payload.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as error:
        raise DatasetError("invalid_csv_encoding") from error
    if "\x00" in text:
        raise DatasetError("invalid_csv_content")
    try:
        reader = csv.reader(StringIO(text, newline=""), delimiter=",", strict=True)
        header = next(reader, None)
        if not header or len(header) > MAX_COLUMNS:
            raise DatasetError("invalid_csv_header")
        names = [_safe_label(name, max_length=120, error_code="invalid_csv_header") for name in header]
        if len({name.casefold() for name in names}) != len(names):
            raise DatasetError("invalid_csv_header")
        rows: list[tuple[str, ...]] = []
        for row_number, row in enumerate(reader, start=2):
            if len(row) != len(names):
                raise DatasetError("invalid_csv_row_width", row=row_number)
            if len(rows) >= MAX_ROWS or (len(rows) + 1) * len(names) > MAX_CELLS:
                raise DatasetError("csv_limit_exceeded", row=row_number)
            rows.append(tuple(row))
    except csv.Error as error:
        raise DatasetError("invalid_csv_syntax") from error
    if not rows:
        raise DatasetError("empty_csv_data")
    columns = tuple(
        ColumnProfile(
            id=f"col_{index + 1}",
            name=name,
            kind=_numeric_kind([row[index] for row in rows]),
            missing_count=sum(not row[index].strip() for row in rows),
        )
        for index, name in enumerate(names)
    )
    return ParsedCsv(
        parser_version=PARSER_VERSION,
        sha256=sha256(payload).hexdigest(),
        byte_count=len(payload),
        row_count=len(rows),
        columns=columns,
        _rows=tuple(rows),
    )


def validate_grouped_bar(
    dataset: ParsedCsv,
    *,
    category_column: str,
    value_column: str,
    value_unit: str,
    group_column: str | None = None,
) -> GroupedBarData:
    """Accept only already summarized category/value rows; never aggregate them."""
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [category_column, value_column, *([group_column] if group_column is not None else [])]
    if (any(not isinstance(column, str) or not column for column in chosen)
            or len(set(chosen)) != len(chosen)
            or any(column not in ids for column in chosen)):
        raise DatasetError("invalid_grouped_bar_mapping")
    if not isinstance(value_unit, str):
        raise DatasetError("invalid_grouped_bar_unit")
    unit = _safe_label(value_unit, max_length=48, error_code="invalid_grouped_bar_unit")
    points: list[GroupedBarPoint] = []
    seen: set[tuple[str, str | None]] = set()
    categories: set[str] = set()
    groups: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        try:
            category = _safe_label(row[ids[category_column]], max_length=80,
                                   error_code="missing_grouped_bar_label")
            group = (_safe_label(row[ids[group_column]], max_length=80,
                                 error_code="missing_grouped_bar_label")
                     if group_column is not None else None)
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number) from error
        raw_value = row[ids[value_column]].strip()
        if not raw_value:
            raise DatasetError("missing_grouped_bar_value", row=row_number, column=value_column)
        try:
            value = Decimal(raw_value)
            rendered_value = float(value)
        except (InvalidOperation, ValueError, OverflowError) as error:
            raise DatasetError("invalid_grouped_bar_value", row=row_number, column=value_column) from error
        if not value.is_finite() or not isfinite(rendered_value) or (value != 0 and rendered_value == 0):
            raise DatasetError("invalid_grouped_bar_value", row=row_number, column=value_column)
        key = (category, group)
        if key in seen:
            raise DatasetError("duplicate_grouped_bar_category", row=row_number)
        seen.add(key)
        categories.add(category)
        if group is not None:
            groups.add(group)
        if (len(seen) > MAX_GROUPED_BAR_POINTS or len(categories) > MAX_GROUPED_BAR_CATEGORIES
                or len(groups) > MAX_GROUPED_BAR_GROUPS):
            raise DatasetError("grouped_bar_limit_exceeded", row=row_number)
        points.append(GroupedBarPoint(category=category, group=group, value=value))
    return GroupedBarData(
        template_id="grouped-bar",
        parser_version=dataset.parser_version,
        dataset_hash=dataset.sha256,
        category_column=category_column,
        value_column=value_column,
        group_column=group_column,
        value_unit=unit,
        points=tuple(points),
    )


def validate_scatter(
    dataset: ParsedCsv,
    *,
    x_column: str,
    y_column: str,
    x_unit: str,
    y_unit: str,
    group_column: str | None = None,
) -> ScatterData:
    """Preserve one plotted point per source row; reject incomplete observations."""
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [x_column, y_column, *([group_column] if group_column is not None else [])]
    if (any(not isinstance(column, str) or not column for column in chosen)
            or len(set(chosen)) != len(chosen)
            or any(column not in ids for column in chosen)):
        raise DatasetError("invalid_scatter_mapping")
    if not isinstance(x_unit, str) or not isinstance(y_unit, str):
        raise DatasetError("invalid_scatter_unit")
    units = (
        _safe_label(x_unit, max_length=48, error_code="invalid_scatter_unit"),
        _safe_label(y_unit, max_length=48, error_code="invalid_scatter_unit"),
    )
    points: list[ScatterPoint] = []
    groups: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= MAX_SCATTER_POINTS:
            raise DatasetError("scatter_limit_exceeded", row=row_number)
        values: list[Decimal] = []
        for column_id in (x_column, y_column):
            raw_value = row[ids[column_id]].strip()
            if not raw_value:
                raise DatasetError("missing_scatter_value", row=row_number, column=column_id)
            try:
                value = Decimal(raw_value)
                rendered_value = float(value)
            except (InvalidOperation, ValueError, OverflowError) as error:
                raise DatasetError("invalid_scatter_value", row=row_number, column=column_id) from error
            if not value.is_finite() or not isfinite(rendered_value) or (value != 0 and rendered_value == 0):
                raise DatasetError("invalid_scatter_value", row=row_number, column=column_id)
            values.append(value)
        try:
            group = (_safe_label(row[ids[group_column]], max_length=80,
                                 error_code="missing_scatter_group")
                     if group_column is not None else None)
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number, column=group_column) from error
        if group is not None:
            groups.add(group)
            if len(groups) > MAX_SCATTER_GROUPS:
                raise DatasetError("scatter_limit_exceeded", row=row_number)
        points.append(ScatterPoint(x=values[0], y=values[1], group=group))
    return ScatterData(
        template_id="scatter",
        parser_version=dataset.parser_version,
        dataset_hash=dataset.sha256,
        x_column=x_column,
        y_column=y_column,
        group_column=group_column,
        x_unit=units[0],
        y_unit=units[1],
        x_label=dataset.columns[ids[x_column]].name,
        y_label=dataset.columns[ids[y_column]].name,
        points=tuple(points),
    )


def validate_heatmap(
    dataset: ParsedCsv, *, row_column: str, column_column: str,
    value_column: str, value_unit: str,
) -> HeatmapData:
    """Accept a complete raw long-form matrix; never fill, aggregate or cluster."""
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [row_column, column_column, value_column]
    if (any(not isinstance(column, str) or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_heatmap_mapping")
    if not isinstance(value_unit, str):
        raise DatasetError("invalid_heatmap_unit")
    unit = _safe_label(value_unit, max_length=48, error_code="invalid_heatmap_unit")
    cells: list[HeatmapCell] = []
    keys: set[tuple[str, str]] = set()
    rows: set[str] = set()
    columns: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        try:
            row_label = _safe_label(row[ids[row_column]], max_length=80,
                                    error_code="missing_heatmap_label")
            column_label = _safe_label(row[ids[column_column]], max_length=80,
                                       error_code="missing_heatmap_label")
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number) from error
        key = (row_label, column_label)
        if key in keys:
            raise DatasetError("duplicate_heatmap_cell", row=row_number)
        raw_value = row[ids[value_column]].strip()
        if not raw_value:
            raise DatasetError("missing_heatmap_value", row=row_number, column=value_column)
        try:
            value = Decimal(raw_value)
            plotted = float(value)
        except (InvalidOperation, ValueError, OverflowError) as error:
            raise DatasetError("invalid_heatmap_value", row=row_number, column=value_column) from error
        if not value.is_finite() or not isfinite(plotted) or (value != 0 and plotted == 0):
            raise DatasetError("invalid_heatmap_value", row=row_number, column=value_column)
        keys.add(key)
        rows.add(row_label)
        columns.add(column_label)
        if max(len(rows), len(columns)) > MAX_HEATMAP_DIMENSION:
            raise DatasetError("heatmap_limit_exceeded", row=row_number)
        cells.append(HeatmapCell(row_label, column_label, value))
    if len(keys) != len(rows) * len(columns):
        raise DatasetError("incomplete_heatmap_matrix")
    return HeatmapData("heatmap", dataset.parser_version, dataset.sha256,
                       row_column, column_column, value_column, unit, tuple(cells))


def validate_trend(
    dataset: ParsedCsv, *, x_column: str, value_column: str,
    x_unit: str, value_unit: str, series_column: str | None = None,
) -> TrendData:
    """Draw supplied numeric observations in order; no smoothing or accumulation."""
    try:
        observed = validate_scatter(dataset, x_column=x_column, y_column=value_column,
                                    x_unit=x_unit, y_unit=value_unit, group_column=series_column)
    except DatasetError as error:
        raise DatasetError(error.code.replace("scatter", "trend"),
                           row=error.row, column=error.column) from error
    previous: dict[str | None, Decimal] = {}
    for row_number, point in enumerate(observed.points, start=2):
        if point.group in previous and point.x <= previous[point.group]:
            raise DatasetError("unordered_or_duplicate_trend_x", row=row_number, column=x_column)
        previous[point.group] = point.x
    return TrendData("trend", observed.parser_version, observed.dataset_hash,
                     x_column, value_column, series_column, observed.x_unit, observed.y_unit,
                     observed.x_label, observed.y_label, observed.points)


def validate_intervals(
    dataset: ParsedCsv, *, template_id: str, label_column: str,
    estimate_column: str, lower_column: str, upper_column: str,
    value_unit: str, interval_type: str, ci_level: int | float | str | Decimal | None = None,
    effect_type: str | None = None,
) -> IntervalData:
    """Display explicitly supplied bounds; never estimate errors or pooled effects."""
    if template_id not in ("dot-interval", "forest"):
        raise DatasetError("invalid_interval_template")
    if interval_type not in ("CI", "SD", "SE"):
        raise DatasetError("invalid_interval_type")
    if template_id == "forest":
        if interval_type != "CI" or effect_type not in ("OR", "RR", "HR", "MD", "SMD"):
            raise DatasetError("invalid_forest_effect_type")
    elif effect_type is not None:
        raise DatasetError("invalid_interval_effect_type")
    level = None
    if interval_type == "CI":
        try:
            level = Decimal(str(ci_level))
        except InvalidOperation as error:
            raise DatasetError("invalid_interval_ci_level") from error
        if not level.is_finite() or not 0 < level < 100:
            raise DatasetError("invalid_interval_ci_level")
    elif ci_level is not None:
        raise DatasetError("invalid_interval_ci_level")
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [label_column, estimate_column, lower_column, upper_column]
    if (any(not isinstance(column, str) or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_interval_mapping")
    if not isinstance(value_unit, str):
        raise DatasetError("invalid_interval_unit")
    unit = _safe_label(value_unit, max_length=48, error_code="invalid_interval_unit")
    if effect_type in ("OR", "RR", "HR", "SMD") and unit != effect_type:
        raise DatasetError("invalid_forest_unit")
    points: list[IntervalPoint] = []
    labels: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= MAX_INTERVAL_POINTS:
            raise DatasetError("interval_limit_exceeded", row=row_number)
        try:
            label = _safe_label(row[ids[label_column]], max_length=80,
                                error_code="missing_interval_label")
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number, column=label_column) from error
        if label in labels:
            raise DatasetError("duplicate_interval_label", row=row_number)
        values = []
        for column in (estimate_column, lower_column, upper_column):
            raw = row[ids[column]].strip()
            if not raw:
                raise DatasetError("missing_interval_value", row=row_number, column=column)
            try:
                value = Decimal(raw)
                plotted = float(value)
            except (InvalidOperation, ValueError, OverflowError) as error:
                raise DatasetError("invalid_interval_value", row=row_number, column=column) from error
            if not value.is_finite() or not isfinite(plotted) or (value != 0 and plotted == 0):
                raise DatasetError("invalid_interval_value", row=row_number, column=column)
            values.append(value)
        estimate, lower, upper = values
        if not lower <= estimate <= upper:
            raise DatasetError("invalid_interval_bounds", row=row_number)
        if effect_type in ("OR", "RR", "HR") and lower <= 0:
            raise DatasetError("nonpositive_forest_ratio", row=row_number, column=lower_column)
        labels.add(label)
        points.append(IntervalPoint(label, estimate, lower, upper))
    return IntervalData(template_id, dataset.parser_version, dataset.sha256,
                        label_column, estimate_column, lower_column, upper_column,
                        unit, interval_type, level, effect_type, tuple(points))


def validate_ranked(
    dataset: ParsedCsv, *, label_column: str, value_column: str,
    value_unit: str, ordering: str, top_n: int, group_column: str | None = None,
) -> RankedData:
    """Validate all supplied scores before explicit ranking/top-N; no enrichment."""
    if ordering not in ("source", "ascending", "descending") or type(top_n) is not int or not 1 <= top_n <= 24:
        raise DatasetError("invalid_ranked_selection")
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [label_column, value_column, *([group_column] if group_column is not None else [])]
    if (any(not isinstance(column, str) or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_ranked_mapping")
    if not isinstance(value_unit, str):
        raise DatasetError("invalid_ranked_unit")
    unit = _safe_label(value_unit, max_length=48, error_code="invalid_ranked_unit")
    points: list[RankedPoint] = []
    labels: set[str] = set()
    groups: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= MAX_SCATTER_POINTS:
            raise DatasetError("ranked_limit_exceeded", row=row_number)
        try:
            label = _safe_label(row[ids[label_column]], max_length=80, error_code="missing_ranked_label")
            group = (_safe_label(row[ids[group_column]], max_length=80, error_code="missing_ranked_group")
                     if group_column is not None else None)
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number) from error
        if label in labels:
            raise DatasetError("duplicate_ranked_label", row=row_number)
        raw = row[ids[value_column]].strip()
        if not raw:
            raise DatasetError("missing_ranked_value", row=row_number, column=value_column)
        try:
            value = Decimal(raw)
            plotted = float(value)
        except (InvalidOperation, ValueError, OverflowError) as error:
            raise DatasetError("invalid_ranked_value", row=row_number, column=value_column) from error
        if not value.is_finite() or not isfinite(plotted) or (value != 0 and plotted == 0):
            raise DatasetError("invalid_ranked_value", row=row_number, column=value_column)
        labels.add(label)
        if group is not None:
            groups.add(group)
            if len(groups) > MAX_SCATTER_GROUPS:
                raise DatasetError("ranked_limit_exceeded", row=row_number)
        points.append(RankedPoint(label, value, group))
    return RankedData("ranked-lollipop", dataset.parser_version, dataset.sha256,
                      label_column, value_column, group_column, unit, ordering, top_n, tuple(points))


def validate_composition(
    dataset: ParsedCsv, *, group_column: str, component_column: str,
    count_column: str, denominator_column: str, count_unit: str, display: str,
    denominator_scope: str, mutually_exclusive: bool, exhaustive: bool,
) -> CompositionData:
    """Accept complete integer counts and declared within-group denominators."""
    if (display not in ("count", "percent") or denominator_scope != "within-group"
            or mutually_exclusive is not True or exhaustive is not True):
        raise DatasetError("unconfirmed_composition_semantics")
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [group_column, component_column, count_column, denominator_column]
    if (any(not isinstance(column, str) or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_composition_mapping")
    if not isinstance(count_unit, str):
        raise DatasetError("invalid_composition_unit")
    unit = _safe_label(count_unit, max_length=48, error_code="invalid_composition_unit")
    cells: list[CompositionCell] = []
    keys: set[tuple[str, str]] = set()
    totals: dict[str, int] = {}
    denominators: dict[str, Decimal] = {}
    components: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        try:
            group = _safe_label(row[ids[group_column]], max_length=80, error_code="missing_composition_label")
            component = _safe_label(row[ids[component_column]], max_length=80, error_code="missing_composition_label")
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number) from error
        if (group, component) in keys:
            raise DatasetError("duplicate_composition_cell", row=row_number)
        values = []
        for column in (count_column, denominator_column):
            try:
                value = Decimal(row[ids[column]].strip())
            except InvalidOperation as error:
                raise DatasetError("invalid_composition_count", row=row_number, column=column) from error
            if (not value.is_finite() or not 0 <= value <= MAX_EXACT_COUNT
                    or value != value.to_integral_value()):
                raise DatasetError("invalid_composition_count", row=row_number, column=column)
            values.append(value)
        count, denominator = values
        if denominator == 0 or count > denominator:
            raise DatasetError("invalid_composition_denominator", row=row_number)
        if group in denominators and denominators[group] != denominator:
            raise DatasetError("inconsistent_composition_denominator", row=row_number)
        denominators[group] = denominator
        totals[group] = totals.get(group, 0) + int(count)
        components.add(component)
        keys.add((group, component))
        if len(denominators) > MAX_COMPOSITION_GROUPS or len(components) > MAX_COMPOSITION_COMPONENTS:
            raise DatasetError("composition_limit_exceeded", row=row_number)
        cells.append(CompositionCell(group, component, count, denominator))
    if len(keys) != len(denominators) * len(components):
        raise DatasetError("incomplete_composition_matrix")
    if any(Decimal(totals[group]) != denominator for group, denominator in denominators.items()):
        raise DatasetError("composition_total_mismatch")
    return CompositionData("composition", dataset.parser_version, dataset.sha256,
                           group_column, component_column, count_column, denominator_column,
                           unit, display, tuple(cells))


def validate_volcano(
    dataset: ParsedCsv, *, identifier_column: str, log2fc_column: str, p_column: str,
    p_kind: str, p_threshold: int | float | str | Decimal,
    fold_threshold: int | float | str | Decimal,
    zero_p_floor: int | float | str | Decimal | None = None,
) -> VolcanoData:
    """Display existing differential results; no tests, adjustments or zero inference."""
    p_limit, fold_limit, floor = validate_volcano_options(
        p_kind=p_kind, p_threshold=p_threshold, fold_threshold=fold_threshold, zero_p_floor=zero_p_floor,
    )
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [identifier_column, log2fc_column, p_column]
    if (any(not isinstance(column, str) or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_volcano_mapping")
    points: list[VolcanoPoint] = []
    identifiers: set[str] = set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= MAX_SCATTER_POINTS:
            raise DatasetError("volcano_limit_exceeded", row=row_number)
        try:
            identifier = _safe_label(row[ids[identifier_column]], max_length=80,
                                     error_code="missing_volcano_identifier")
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number, column=identifier_column) from error
        if identifier in identifiers:
            raise DatasetError("duplicate_volcano_identifier", row=row_number)
        values = []
        for column in (log2fc_column, p_column):
            try:
                value = Decimal(row[ids[column]].strip())
            except InvalidOperation as error:
                raise DatasetError("invalid_volcano_value", row=row_number, column=column) from error
            if not value.is_finite():
                raise DatasetError("invalid_volcano_value", row=row_number, column=column)
            values.append(value)
        log2fc, p_value = values
        if not isfinite(float(log2fc)) or (log2fc != 0 and float(log2fc) == 0):
            raise DatasetError("invalid_volcano_value", row=row_number, column=log2fc_column)
        if not 0 <= p_value <= 1:
            raise DatasetError("invalid_volcano_p", row=row_number, column=p_column)
        if p_value == 0 and floor is None:
            raise DatasetError("volcano_zero_floor_required", row=row_number, column=p_column)
        if p_value > 0 and floor is not None and floor > p_value:
            raise DatasetError("volcano_floor_above_observed_p", row=row_number, column=p_column)
        try:
            volcano_ordinate(p_value if p_value > 0 else floor)
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number, column=p_column) from error
        identifiers.add(identifier)
        points.append(VolcanoPoint(identifier, log2fc, p_value))
    return VolcanoData("volcano", dataset.parser_version, dataset.sha256,
                       identifier_column, log2fc_column, p_column, p_kind,
                       p_limit, fold_limit, floor, tuple(points))


def validate_distribution(
    dataset: ParsedCsv, *, value_column: str, value_unit: str, group_column: str | None = None,
    bin_edges: list | tuple | None = None,
) -> DistributionData:
    """Keep every observation; no deletion, weighting, pooling or group inference."""
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [value_column, *([group_column] if group_column is not None else [])]
    if (any(type(column) is not str or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_distribution_mapping")
    if type(value_unit) is not str:
        raise DatasetError("invalid_distribution_unit")
    unit = _safe_label(value_unit, max_length=48, error_code="invalid_distribution_unit")
    points, groups = [], set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= MAX_SCATTER_POINTS:
            raise DatasetError("distribution_limit_exceeded", row=row_number)
        raw = row[ids[value_column]].strip()
        if len(raw) > 128:
            raise DatasetError("invalid_distribution_value", row=row_number, column=value_column)
        try:
            value = Decimal(raw)
        except InvalidOperation as error:
            raise DatasetError("invalid_distribution_value", row=row_number, column=value_column) from error
        if not value.is_finite() or not isfinite(float(value)) or (value != 0 and float(value) == 0):
            raise DatasetError("invalid_distribution_value", row=row_number, column=value_column)
        try:
            group = (_safe_label(row[ids[group_column]], max_length=80, error_code="missing_distribution_group")
                     if group_column is not None else None)
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number, column=group_column) from error
        if group is not None:
            groups.add(group)
        if len(groups) > MAX_SCATTER_GROUPS:
            raise DatasetError("distribution_limit_exceeded", row=row_number)
        points.append(DistributionPoint(value, group))
    if not points:
        raise DatasetError("empty_distribution")
    edges = validate_histogram_edges(bin_edges) if bin_edges is not None else None
    if edges is not None:
        # Validate complete coverage; per-group counts are derived during rendering.
        histogram_bin_counts(tuple(p.value for p in points), edges)
    return DistributionData("distribution", dataset.parser_version, dataset.sha256,
                            value_column, group_column, unit, tuple(points), edges)


def validate_histogram_edges(raw: list | tuple) -> tuple[Decimal, ...]:
    """Explicit shared boundaries, representable without collapsed plot bins."""
    if type(raw) not in (list, tuple) or not 2 <= len(raw) <= 51:
        raise DatasetError("invalid_histogram_edges")
    edges = []
    for item in raw:
        if type(item) is int and abs(item) >= 10**128:
            raise DatasetError("invalid_histogram_edges")
        if type(item) not in (str, int, float, Decimal) or len(str(item)) > 128:
            raise DatasetError("invalid_histogram_edges")
        try:
            value = Decimal(str(item))
        except InvalidOperation as error:
            raise DatasetError("invalid_histogram_edges") from error
        if not value.is_finite() or not isfinite(float(value)) or (value != 0 and float(value) == 0):
            raise DatasetError("invalid_histogram_edges")
        if edges and (value <= edges[-1] or float(value) <= float(edges[-1])):
            raise DatasetError("invalid_histogram_edges")
        edges.append(value)
    if not isfinite(float(edges[-1]) - float(edges[0])):
        raise DatasetError("unplottable_histogram_range")
    return tuple(edges)


def histogram_bin_counts(values: tuple[Decimal, ...], bin_edges: tuple[Decimal, ...]) -> tuple[int, ...]:
    """Count exactly, including the final edge; never silently exclude a row."""
    edges = validate_histogram_edges(bin_edges)
    if not values or len(values) > MAX_SCATTER_POINTS:
        raise DatasetError("invalid_histogram_values")
    counts = [0] * (len(edges) - 1)
    for value in values:
        if (type(value) is not Decimal or not value.is_finite() or len(str(value)) > 128
                or not isfinite(float(value)) or (value != 0 and float(value) == 0)):
            raise DatasetError("invalid_histogram_values")
        if not edges[0] <= value <= edges[-1]:
            raise DatasetError("histogram_value_outside_bins")
        counts[min(bisect_right(edges, value) - 1, len(counts) - 1)] += 1
    return tuple(counts)


def distribution_box_stats(values: tuple[Decimal, ...]) -> dict[str, float]:
    """H&F type 7 quartiles and observed 1.5-IQR whiskers; no outlier deletion."""
    if (not values or len(values) > MAX_SCATTER_POINTS
            or any(type(v) is not Decimal or not v.is_finite() or len(str(v)) > 128
                   or not isfinite(float(v)) or (v != 0 and float(v) == 0) for v in values)):
        raise DatasetError("invalid_distribution_value")
    # Canonicalize zero before Fraction conversion; a huge zero exponent has no meaning.
    ordered = [Decimal(0) if v == 0 else v for v in sorted(values)]

    def quantile(numerator):
        index, remainder = divmod((len(ordered) - 1) * numerator, 4)
        if remainder == 0:
            return Fraction(ordered[index])
        return (Fraction(ordered[index]) * (4 - remainder) + Fraction(ordered[index + 1]) * remainder) / 4

    q1, median, q3 = quantile(1), quantile(2), quantile(3)
    iqr = q3 - q1
    lower, upper = q1 - Fraction(3, 2) * iqr, q3 + Fraction(3, 2) * iqr
    inside = [v for v in ordered if lower <= v <= upper]
    stats = dict(q1=q1, med=median, q3=q3, whislo=min(inside), whishi=max(inside))
    if any(not isfinite(float(v)) or (v != 0 and float(v) == 0) for v in stats.values()):
        raise DatasetError("unplottable_distribution_summary")
    return {key: float(v) for key, v in stats.items()}


def validate_radar_axes(axes: list[dict]) -> tuple[RadarAxis, ...]:
    """Require explicit axis units, ranges and direction; never infer from a column."""
    if type(axes) is not list or not 3 <= len(axes) <= 8:
        raise DatasetError("invalid_radar_axes")
    result, labels = [], set()
    for axis in axes:
        if (type(axis) is not dict or axis.keys() != {"metric", "unit", "lower", "upper", "direction"}
                or type(axis["metric"]) is not str or type(axis["unit"]) is not str
                or axis["direction"] not in ("higher", "lower")):
            raise DatasetError("invalid_radar_axes")
        metric = _safe_label(axis["metric"], max_length=48, error_code="invalid_radar_metric")
        unit = _safe_label(axis["unit"], max_length=24, error_code="invalid_radar_unit")
        if metric in labels:
            raise DatasetError("duplicate_radar_axis")
        bounds = []
        for raw in (axis["lower"], axis["upper"]):
            if type(raw) not in (int, float, str, Decimal) or len(str(raw)) > 128:
                raise DatasetError("invalid_radar_bounds")
            try:
                value = Decimal(str(raw))
            except InvalidOperation as error:
                raise DatasetError("invalid_radar_bounds") from error
            if not value.is_finite() or not isfinite(float(value)) or (value != 0 and float(value) == 0):
                raise DatasetError("invalid_radar_bounds")
            bounds.append(value)
        lower, upper = bounds
        if lower >= upper:
            raise DatasetError("invalid_radar_bounds")
        labels.add(metric)
        result.append(RadarAxis(metric, unit, lower, upper, axis["direction"]))
    return tuple(result)


def radar_normalized(value: Decimal, axis: RadarAxis) -> float:
    """Exact-rational min-max normalization, then binary64; no clipping or ranking."""
    if (type(axis) is not RadarAxis
            or any(type(v) is not Decimal or not v.is_finite() or len(str(v)) > 128
                   or not isfinite(float(v)) or (v != 0 and float(v) == 0) for v in (axis.lower, axis.upper))
            or type(value) is not Decimal or not value.is_finite() or len(str(value)) > 128
            or not isfinite(float(value)) or (value != 0 and float(value) == 0)
            or not axis.lower <= value <= axis.upper or axis.lower >= axis.upper
            or axis.direction not in ("higher", "lower")):
        raise DatasetError("invalid_radar_value")
    low, high, raw = (Fraction(v) if v else Fraction(0) for v in (axis.lower, axis.upper, value))
    score = ((raw - low) if axis.direction == "higher" else (high - raw)) / (high - low)
    plotted = float(score)
    if score != 0 and plotted == 0:
        raise DatasetError("unplottable_radar_normalization")
    return plotted


def validate_radar(
    dataset: ParsedCsv, *, method_column: str, metric_column: str, value_column: str, axes: list[dict],
) -> RadarData:
    frozen_axes = validate_radar_axes(axes)
    lookup = {axis.metric: axis for axis in frozen_axes}
    ids = {column.id: index for index, column in enumerate(dataset.columns)}
    chosen = [method_column, metric_column, value_column]
    if (any(type(column) is not str or column not in ids for column in chosen)
            or len(set(chosen)) != len(chosen)):
        raise DatasetError("invalid_radar_mapping")
    points, keys, methods = [], set(), set()
    for row_number, row in enumerate(dataset._rows, start=2):
        if len(points) >= 32:
            raise DatasetError("radar_limit_exceeded", row=row_number)
        try:
            method = _safe_label(row[ids[method_column]], max_length=80, error_code="missing_radar_method")
            metric = _safe_label(row[ids[metric_column]], max_length=48, error_code="missing_radar_metric")
        except DatasetError as error:
            raise DatasetError(error.code, row=row_number) from error
        if metric not in lookup:
            raise DatasetError("undeclared_radar_metric", row=row_number, column=metric_column)
        if (method, metric) in keys:
            raise DatasetError("duplicate_radar_cell", row=row_number)
        raw = row[ids[value_column]].strip()
        if len(raw) > 128:
            raise DatasetError("invalid_radar_value", row=row_number, column=value_column)
        try:
            value = Decimal(raw)
            radar_normalized(value, lookup[metric])
        except (InvalidOperation, DatasetError) as error:
            code = error.code if isinstance(error, DatasetError) else "invalid_radar_value"
            raise DatasetError(code, row=row_number, column=value_column) from error
        methods.add(method)
        keys.add((method, metric))
        if len(methods) > 4:
            raise DatasetError("radar_limit_exceeded", row=row_number)
        points.append(RadarPoint(method, metric, value))
    if not methods or len(keys) != len(methods) * len(frozen_axes):
        raise DatasetError("incomplete_radar_matrix")
    return RadarData("radar", dataset.parser_version, dataset.sha256,
                     method_column, metric_column, value_column, frozen_axes, tuple(points))
