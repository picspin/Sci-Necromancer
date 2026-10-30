"""Independent journal-inspired appearance presets, not submission certification."""

from dataclasses import dataclass
from types import MappingProxyType

from services.figure_worker.dataset import DatasetError


@dataclass(frozen=True)
class FigureStyle:
    id: str
    version: str
    palette: tuple[str, ...]
    font_scale: float
    line_scale: float
    heatmap_cmap: str
    dpi: int


STANDARD_STYLE = FigureStyle(
    "standard", "standard-v1",
    ("#0B6970", "#B35431", "#4A6099", "#78639B", "#729444", "#A4436D", "#9A742E", "#567F8F"),
    1.0, 1.0, "viridis", 160,
)
STYLES = MappingProxyType({
    "standard": STANDARD_STYLE,
    "lancet": FigureStyle(
        "lancet", "lancet-inspired-v1",
        ("#1C5679", "#B43D32", "#4E8F82", "#9275A3", "#88752C", "#A0537B", "#537CB0", "#795948"),
        0.95, 1.15, "cividis", 300,
    ),
    "nature": FigureStyle(
        "nature", "nature-inspired-v1",
        ("#007C83", "#D16E26", "#7060A7", "#4978B0", "#5F8D3F", "#B64E7A", "#9B7B28", "#655F59"),
        0.9, 1.0, "viridis", 300,
    ),
    "cell": FigureStyle(
        "cell", "cell-inspired-v1",
        ("#4166A6", "#C94F56", "#36958C", "#9C68A8", "#B48A31", "#63934A", "#C16D38", "#586877"),
        1.0, 1.25, "magma", 300,
    ),
    "nejm": FigureStyle(
        "nejm", "nejm-inspired-v1",
        ("#92394D", "#356378", "#638578", "#806989", "#A47D39", "#507DAD", "#AB6547", "#657078"),
        0.95, 1.2, "cividis", 300,
    ),
})


def resolve_style(snapshot: dict) -> FigureStyle:
    """Resolve only a frozen allowlisted identity, never arbitrary appearance input."""
    if (type(snapshot) is not dict or snapshot.keys() != {"id", "version"}
            or type(snapshot["id"]) is not str or type(snapshot["version"]) is not str):
        raise DatasetError("invalid_figure_style")
    style = STYLES.get(snapshot["id"])
    if style is None or snapshot["version"] != style.version:
        raise DatasetError("unsupported_figure_style_version")
    return style
