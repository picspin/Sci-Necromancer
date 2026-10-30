"""Trusted browser bridge: local data in, schema/marked preview out. No code eval."""
from dataclasses import asdict
from hashlib import sha256
from io import BytesIO
from platform import python_version

import matplotlib
import numpy
import PIL
from PIL import Image

from services.figure_worker.dataset import DatasetError, parse_csv_bytes
from services.figure_worker.render import BROWSER_EXPORT, FONT_SHA256, LOCK_SHA256
from services.figure_worker.spec import render_csv_spec
from services.figure_worker.multipanel import render_csv_multipanel_spec

_MARKER = b"SCN1:sci-necromancer"


def inspect_csv(payload: bytes) -> dict:
    data = parse_csv_bytes(payload)
    return dict(dataset_sha256=data.sha256, row_count=data.row_count,
                byte_count=data.byte_count, columns=[asdict(c) for c in data.columns])


def read_watermark(png: bytes) -> str | None:
    with Image.open(BytesIO(png)) as image:
        if image.width * image.height > 40_000_000:
            raise DatasetError("invalid_browser_preview")
        pixels = image.convert("RGB").tobytes()
    if len(pixels) < len(_MARKER) * 8:
        return None
    decoded = bytes(sum((pixels[byte * 8 + bit] & 1) << (7 - bit)
                        for bit in range(8)) for byte in range(len(_MARKER)))
    return "sci-necromancer" if decoded == _MARKER else None


def render_preview(payload: bytes, spec: dict) -> tuple[bytes, dict, tuple]:
    token = BROWSER_EXPORT.set(True)
    try:
        renderer = (render_csv_multipanel_spec if type(spec) is dict and
                    spec.get("schema_version") == "figure-multipanel-spec-v1" else render_csv_spec)
        result = renderer(payload, spec)
    finally:
        BROWSER_EXPORT.reset(token)
    original = next(a.content for a in result.artifacts if a.format == "png")
    with Image.open(BytesIO(original)) as image:
        dimensions = dict(width_px=image.width, height_px=image.height,
                          dpi=image.info["dpi"][0])
        image.thumbnail((1000, 1000))
        preview = image.convert("RGB")
    pixels = bytearray(preview.tobytes())
    for index in range(len(_MARKER) * 8):
        pixels[index] = (pixels[index] & 0xFE) | ((_MARKER[index // 8] >> (7 - index % 8)) & 1)
    stream = BytesIO()
    Image.frombytes("RGB", preview.size, bytes(pixels)).save(stream, format="PNG")
    manifest = dict(
        dataset_sha256=result.dataset_hash, figure_spec_sha256=result.figure_spec_hash,
        template_version=result.template_version, style_id=result.style_id,
        style_version=result.style_version, style_sha256=result.style_sha256,
        export_profile="browser-600dpi-v1", width_mm=result.width_inches * 25.4,
        height_mm=result.height_inches * 25.4, **dimensions,
        source_baseline_lock_sha256=LOCK_SHA256, baseline_lock_is_runtime_lock=False,
        font_sha256=FONT_SHA256, randomness="none",
        runtime_dependencies=dict(python=python_version(), matplotlib=matplotlib.__version__,
                                  numpy=numpy.__version__, pillow=PIL.__version__),
        artifacts=[dict(format=a.format, media_type=a.media_type, sha256=a.sha256,
                        bytes=len(a.content)) for a in result.artifacts],
        preview_watermark="sci-necromancer", preview_sha256=sha256(stream.getvalue()).hexdigest(),
    )
    return stream.getvalue(), manifest, result.artifacts
