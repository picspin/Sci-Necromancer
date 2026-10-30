"""Render the independently authored SYNTHETIC radiology example locally."""

import argparse
import json
from pathlib import Path

from services.figure_worker.multipanel import render_csv_multipanel_spec
from services.figure_worker.styles import STYLES


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New directory; existing directories are never overwritten")
    parser.add_argument("--style", choices=tuple(STYLES), default="standard")
    options = parser.parse_args()
    example = Path(__file__).with_name("radiology-validation")
    spec = json.loads((example / "spec.json").read_text())
    style = STYLES[options.style]
    spec["style"] = dict(id=style.id, version=style.version)
    result = render_csv_multipanel_spec((example / "data.csv").read_bytes(), spec)
    options.output.mkdir(exist_ok=False)
    for artifact in result.artifacts:
        extension = "manifest.json" if artifact.format == "manifest" else artifact.format
        (options.output / f"radiology-validation.{extension}").write_bytes(artifact.content)
    print(f"Synthetic demonstration only: {options.output.resolve()}")
    print(f"dataset_sha256={result.dataset_hash}; figure_spec_hash={result.figure_spec_hash}")


if __name__ == "__main__":
    main()
