# Project working agreement

## Code discovery

Prefer codebase-memory-mcp graph tools for code discovery: `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, then `get_architecture`. Use `search_code` for graph-augmented text search. Fall back to `rg` for literals, config, non-code files, or insufficient graph results; index the repository first if it is not indexed.

## Engineering decisions

- Present the plan and reasons for architecture, module, dependency, or data-flow changes; wait for user confirmation. Ask when scope is unclear. Explain and obtain confirmation before adding production dependencies.
- Follow the existing lock file for JS/TS package management; prefer `uv` for Python. Run relevant tests and lint after code changes. Keep behavior changes separate from structure-only refactors.
- Choose the simplest design that meets current requirements. After each implementation, remove uncalled functions, one-use connection wrappers, and speculative abstractions. Before a new module, write a 5–10-line design draft covering inputs, outputs, boundaries, and need.
- Research experiments must record hypothesis, configuration, actual measured results, and conclusion; use fixed seeds, record versions/hardware, and compare against a baseline before claiming improvement. Do not fabricate figures or optimize before profiling.

## Deployment handoff

For every feature or fix that may affect production, inspect the actual changed files and include a deployment-impact notice in the user-facing handoff and PR description. State separately whether Supabase migrations, Vercel backend deployment, and Cloudflare Worker frontend rebuild/deployment are required; give the safe order, environment-variable changes, smoke checks, and whether each action was actually performed. Say explicitly when no production redeployment is needed. Never claim that a merge, a push, or a preview deployment put the change live.

Use [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) for the current architecture, commands, and release checklist. Do not deploy or apply production migrations unless the user authorized that release operation.
