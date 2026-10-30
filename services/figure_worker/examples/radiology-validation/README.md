# Radiology validation — SYNTHETIC DEMONSTRATION ONLY

These eight rows are independently authored illustrative values, not measured
clinical results, reference-paper data, model performance claims or valid study CIs.
There is no random generation or sampling. The declared 95% CI endpoints merely
demonstrate rendering **supplied** interval fields; this example does not estimate CIs or AUC.

The local three-panel example shares a single source dataset:

- A: `auc` records, already supplied AUC by center and method (grouped bars, zero baseline).
- B: the same four `auc` records, supplied estimates and endpoints (dot intervals).
- C: four `dice` records, supplied modality × method matrix (raw heatmap).

No cross-table joins, averaging, scaling of source values, threshold selection,
model training, ROC computation or statistical inference occurs. A/B are repeated
views of the same records, not independent samples. Every source row is covered.
The shared source hash is frozen in `spec.json`; changing data requires updating
and reviewing the plan, not silently replacing the hash in the renderer.

## Field dictionary

| Field / role ID     | Meaning / required records                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| record_type / col_1 | Exact ASCII discriminator: `auc` or `dice`. No expression syntax.                                  |
| center / col_2      | Illustrative Center A/B labels for `auc`.                                                          |
| method / col_3      | Illustrative Baseline/Example labels for all records.                                              |
| modality / col_4    | CT/MR labels; row role for the `dice` matrix.                                                      |
| metric / col_5      | Informational metric name, not inferred by the renderer. The confirmed units distinguish AUC/Dice. |
| value / col_6       | Supplied metric values (ratio); used by all panels.                                                |
| lower / col_7       | Supplied lower interval endpoint for `auc`.                                                        |
| upper / col_8       | Supplied upper interval endpoint for `auc`.                                                        |
| label / col_9       | Unique supplied point-interval label for `auc`.                                                    |

Blank fields are permitted only when not mapped for that record type. A missing
mapped value, invalid bound, incomplete matrix, unselected record type or empty
selection blocks the complete output. Source CSV line numbers remain in errors
and in the manifest, including deliberate reuse by A/B.

## Reproduce locally

From the repository root, use the existing dependency lock:

```bash
uv sync --project services/figure_worker --locked
uv run --project services/figure_worker --frozen --no-sync python -m services.figure_worker.examples.radiology_validation --style nejm --output /private/tmp/radiology-validation-demo
```

Choose a **new** output directory. Existing directories/files are not overwritten.
The demo renders PNG/PDF/SVG and a JSON provenance manifest; visual presets are
`standard`, `lancet`, `nature`, `cell`, `nejm` (journal-inspired, not submission certification).
The renderer reports its actual Python/Matplotlib/lock/font versions and hashes.
Same-environment repeated exports are tested; cross-platform byte identity is not promised.

This is a repository-dependent local demo, not yet a standalone downloadable
reproduction bundle or public gallery/UI. No production API, upload, private storage,
membership auth, Jev/LLM request, wallet charge or deployment is invoked.
