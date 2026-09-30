"""Bounded CSV intake and the first deterministic data-figure input contract.

This module does not call a model, infer a statistical result, or render an image.
Raw rows remain inside ``ParsedCsv`` and must not be forwarded to Jev or an LLM.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
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
