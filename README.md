<div align="center">
  <a href="https://www.rad-sci.org/" target="_blank"><img src="public/readme-assets/sci-necromancer-logo.svg" height="180" alt="SCI-Necromancer logo"></a>

  <p><a href="README.md">English</a> · <a href="README_CN.md">中文</a> · <a href="README_DE.md">Deutsch</a></p>
  <p>
    <a href="https://github.com/picspin/Sci-Necromancer/actions/workflows/ci.yml"><img src="https://github.com/picspin/Sci-Necromancer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&amp;logoColor=white" alt="Vite 6"></a>
    <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue-3-42B883?logo=vuedotjs&amp;logoColor=white" alt="Vue 3"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4A959F.svg" alt="MIT License"></a>
    <a href="https://github.com/picspin/Sci-Necromancer"><img src="https://img.shields.io/badge/Open%20Source-Yes-567A87" alt="Open Source"></a>
    <a href="#deployment"><img src="https://img.shields.io/badge/Deploy-Cloudflare%20%7C%20Vercel%20%7C%20Netlify-B4C3D7" alt="Cloudflare Vercel Netlify"></a>
  </p>
</div>

[![SCI cultivation path](public/readme-assets/sci-necromancer-cultivation.png)](https://www.rad-sci.org/)

## Overview

SCI-Necromancer is an open-source academic writing assistant for medical-imaging and cardiovascular conference abstracts. It turns source material into structured ISMRM, RSNA, ECR/ER, or ESC drafts through either standard analysis or the intentionally playful **邪修 / alchemy mode**.

The application assists with analysis, wording, formatting, figures, export, and independent blind review. It does **not** prove that data, ethics approvals, patient de-identification, statistics, citations, or submission compliance are correct. Authors remain responsible for every submission.

## Architecture

![Architecture](public/readme-assets/architecture.svg)

Vue 3 provides the shared interface and conference slices. Deterministic conference rules constrain provider prompts and validate outputs. The optional Skills & MCP layer adds a bundled read-only blind-review skill plus backend-provisioned PubMed, CiteCheck, and DOI verification. Local storage is the default; Supabase integration is optional.

## Features

- Guided standard workflow: source → analysis → type/category selection → generation → save/export.
- **邪修 mode** with the shared “一键炼丹” action for idea expansion.
- Conference-specific support for ISMRM, RSNA science/education, ECR/ER, and ESC.
- Complete English/Chinese application UI and localized errors/accessibility labels.
- Figure generation/editing and Markdown, PDF, JSON, and image export.
- Skills & MCP capability switches, safe local JSON-manifest import, and downloadable blind-review skill.
- Structured blind review across ethics, consent, de-identification, data integrity, methods, citations, reporting guidance, and conference rules.
- Fail-closed external verification: unavailable evidence services never count as verified.

## Quick Start

Requirements: Node.js 18+ and a Google Gemini or OpenAI-compatible API key.

```bash
git clone https://github.com/picspin/Sci-Necromancer.git
cd Sci-Necromancer
npm install
npm run dev
```

Open the local URL printed by Vite, then configure the provider under **Models**.

## Usage

1. Select ISMRM, RSNA, ECR/ER, or ESC.
2. Paste/upload source material, or switch to 邪修 mode and enter a research idea.
3. Analyze, confirm the suggested route, and generate the abstract.
4. Save, export, or run the independent blind review.
5. Verify every factual, ethical, privacy, statistical, citation, and conference-compliance claim before submission.

Under **Skills & MCP**, Skills and MCP can be loaded independently. External `.json` manifests may activate only a named, trusted adapter already built into the deployment; unbound manifests remain registry-only. Browser-side commands and credentials are ignored, and new executable MCP adapters must be provisioned by the backend administrator.

## Deployment

```bash
npm run test -- --run
npm run lint
npm run build
```

Deploy `dist/` to Cloudflare Pages/Workers static assets, Vercel, or Netlify with SPA fallback to `index.html`. Vercel can also host `api/blind-review.ts`. For privileged CiteCheck/DOI MCP review, configure the HTTPS facade variables and trusted edge token described in [the backend guide](docs/BLIND_REVIEW_BACKEND.md). Never place server credentials in `VITE_*` variables.

## References

- [RSNA abstract submission](https://www.rsna.org/annual-meeting/abstract-submission)
- [RSNA faculty and presenter resources](https://www.rsna.org/annual-meeting/attendee-resources/faculty-and-presenter-resources)
- [ISMRM abstract submission guide](https://www.ismrm.org/26m/call/submission-guide/)
- [ECR abstract submission](https://www.myesr.org/congress/submit/abstract-submission/)
- [ESC abstract rules](https://www.escardio.org/events/congresses/esc-congress/call-for-science/abstracts/rules/)
- [STARD](https://www.equator-network.org/reporting-guidelines/stard/) · [TRIPOD](https://www.tripod-statement.org/)

Official rules change. Always verify the current meeting website; internal reference material is a drafting aid, not authority.

## Troubleshooting

- **Blank page:** use Node 18+, run `npm install`, and inspect the browser console.
- **Provider error:** verify the API key, base URL, model name, quota, and provider privacy terms.
- **File extraction fails:** paste plain text and remove protected/scanned content.
- **External reviewer unavailable:** confirm the checkbox, backend facade, HTTPS configuration, timeout, and trusted edge header.
- **Unexpected output:** clear the workflow, regenerate from verified source material, and never submit unreviewed AI text.

MIT licensed. Contributions and evidence-based corrections are welcome.
