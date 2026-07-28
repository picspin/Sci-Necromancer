#!/usr/bin/env python3
"""Validate the Sci-Necromancer blind-review report contract."""

import json
import sys
from pathlib import Path

RECOMMENDATIONS = {"pass-with-caveats", "minor-revision", "major-revision", "reject"}
DIMENSIONS = {"ethics-and-consent", "de-identification", "data-integrity", "methodology", "citation-integrity", "conference-compliance", "reporting-guideline"}
SEVERITIES = {"critical", "high", "medium", "low", "info"}
FINDING_STATUSES = {"verified", "supported", "unsupported", "contradictory", "not-verifiable"}
EXTERNAL_STATUSES = {"verified", "issues-found", "unavailable", "not-run"}
REVIEWERS = {"pubmed", "citecheck", "doi-mcp"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate(report: object) -> None:
    require(isinstance(report, dict), "report must be an object")
    require(report.get("version") == "blind-review-v1", "invalid version")
    require(report.get("conference") in {"ISMRM", "RSNA", "ER", "ESC"}, "invalid conference")
    require(report.get("overallStatus") in {"verified-with-limitations", "action-required"}, "invalid overallStatus")
    require(isinstance(report.get("reviewedAt"), str) and bool(report["reviewedAt"].strip()), "reviewedAt is required")
    assessment = report.get("modelAssessment")
    require(isinstance(assessment, dict), "modelAssessment must be an object")
    require(assessment.get("recommendation") in RECOMMENDATIONS, "invalid recommendation")
    require(isinstance(assessment.get("summary"), str) and bool(assessment["summary"].strip()), "summary is required")
    require(isinstance(assessment.get("findings"), list), "findings must be an array")
    for index, finding in enumerate(assessment["findings"]):
        require(isinstance(finding, dict), f"findings[{index}] must be an object")
        require(isinstance(finding.get("id"), str), f"findings[{index}].id must be a string")
        require(finding.get("dimension") in DIMENSIONS, f"invalid findings[{index}].dimension")
        require(finding.get("severity") in SEVERITIES, f"invalid findings[{index}].severity")
        require(finding.get("verificationStatus") in FINDING_STATUSES, f"invalid findings[{index}].verificationStatus")
        for field in ("claim", "evidence", "recommendation"):
            require(isinstance(finding.get(field), str), f"findings[{index}].{field} must be a string")
    external = report.get("externalVerification")
    require(isinstance(external, list), "externalVerification must be an array")
    for index, item in enumerate(external):
        require(isinstance(item, dict), f"externalVerification[{index}] must be an object")
        require(item.get("reviewer") in REVIEWERS, f"invalid externalVerification[{index}].reviewer")
        require(item.get("status") in EXTERNAL_STATUSES, f"invalid externalVerification[{index}].status")
        require(isinstance(item.get("checkedAt"), str) and bool(item["checkedAt"].strip()), f"externalVerification[{index}].checkedAt is required")
        require(isinstance(item.get("summary"), str) and bool(item["summary"].strip()), f"externalVerification[{index}].summary is required")
        require(isinstance(item.get("records"), list), f"externalVerification[{index}].records must be an array")
    if report.get("overallStatus") == "verified-with-limitations":
        require(all(item.get("status") == "verified" for item in external), "verified-with-limitations requires every external reviewer to be verified")
    require(report.get("disclaimer") == "blind_review.disclaimer", "invalid disclaimer")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_report.py REPORT.json", file=sys.stderr)
        return 2
    try:
        validate(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"invalid: {exc}", file=sys.stderr)
        return 1
    print("valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
