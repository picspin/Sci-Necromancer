# ASCO + ESMO Oncology Conference Module Specification

Status: Draft — awaiting product approval before implementation
Rule baseline: ASCO Annual Meeting 2026; ESMO Congress 2026
Architecture principle: Ponytail — reuse the existing workflow and introduce no unnecessary entities

## 1. Objective

Add two first-class conference choices, `ASCO` and `ESMO`, alongside ISMRM, RSNA, ER, and ESC. Both choices use the established workflow:

1. Paste or upload an abstract.
2. Run standard analysis.
3. Infer the most likely submission type and oncology category.
4. Generate a rule-aware optimized abstract.
5. Optionally run creative optimization, deep update, save/clear, and blind review.

The implementation must preserve the existing Chinese/English internationalization behavior, membership/BYOK routing, bonus accounting, scientific-integrity warnings, and blind-review workflow.

## 2. Product Decisions and Assumptions

- The corrected target is ASCO and ESMO; CSCO is out of scope.
- ASCO and ESMO appear as two independent conference tabs.
- Both tabs share one reusable `OncologyConferencePanel`; organizer-specific behavior is supplied by typed configuration and rule modules.
- ASCO uses the complete 2026 requirements as the fallback baseline until a newer complete annual call is available.
- ESMO uses the official ESMO Congress 2026 abstract regulations.
- Annual deadlines are not hard-coded into the primary workflow because they change annually. The rule version remains visible in validation details or help content.
- Standard and creative modes may reorganize or polish user-provided facts, but must never invent sample sizes, outcomes, statistics, registrations, approvals, adverse events, or citations.
- No new backend API, database schema, third-party dependency, payment rule, or bonus rule is required for this feature.
- Existing AI accuracy and responsibility disclaimers apply. ESMO-specific generative-AI disclosure guidance is additionally enforced.

## 3. Three-Layer Domain Model

### Layer 1 — Organizer and submission type

#### ASCO

- Regular Abstract
- Late-Breaking Abstract — Shell
- Late-Breaking Abstract — Final
- Trials in Progress

#### ESMO

- Regular Abstract
- Late-Breaking Abstract — Preliminary Intent
- Late-Breaking Abstract — Final
- Trial in Progress

### Layer 2 — Oncology category

#### ASCO

Use the official annual-meeting track and subcategory taxonomy. Analysis returns:

- most likely track;
- most likely subcategory;
- confidence and evidence;
- up to two alternatives when ambiguity is material.

#### ESMO

Use the official ESMO Congress category taxonomy, including:

- AI for diagnostics and profiling;
- AI for clinical workflows and decision-making;
- AI for clinical research and drug development;
- basic, diagnostic, pathological, translational, and biomarker research;
- organ- and disease-specific oncology categories;
- developmental therapeutics and investigational immunotherapy;
- prevention, early detection, policy, supportive care, palliative care, and psycho-oncology;
- EONS cancer-nursing categories, identified separately when applicable.

The UI should use a searchable/selectable category control rather than render the entire taxonomy as a button grid.

### Layer 3 — Study and reporting design

Infer and validate the study design independently from the organizer category:

- randomized or non-randomized interventional trial;
- diagnostic/prognostic study;
- biomarker or translational study;
- observational or real-world evidence study;
- systematic review/meta-analysis;
- preclinical/basic research;
- AI/model-development or validation study;
- quality improvement, policy, supportive-care, or nursing study;
- trial in progress.

Apply relevant reporting checks where supported by the supplied content, including CONSORT, STARD, TRIPOD/TRIPOD+AI, PRISMA, STROBE, and oncology trial-registration expectations. These checks guide completeness; they do not fabricate missing information.

## 4. Shared Workflow and UI Contract

Both panels must align with the mature ISMRM/RSNA/ER/ESC workflow:

- conference tab remains visible at all supported viewport sizes;
- input state is retained while switching tabs;
- `分析 → 生成` is one billable member task;
- after a completed analysis, the first generation and one allowed regeneration follow the existing shared billing guard;
- repeated generation and repeated deep-update requests use the existing confirmation/re-entry protection;
- deep update forces a reasoning-oriented generation path through the existing provider abstraction;
- blind review remains separately billable for hosted members;
- save and clear controls activate under the same state rules as the other abstract panels;
- standard/creative mode and the “一键炼丹” control retain their existing shared labels and behavior;
- no extra organizer-specific action buttons are introduced unless required by a rule.

The analysis result must show:

- predicted submission type;
- predicted track/category;
- study-design classification;
- organizer-specific eligibility issues;
- structural and character-limit compliance;
- missing facts requiring author confirmation;
- recommended corrections ranked by severity.

For ESMO only, analysis may recommend a preferred presentation format:

- Proffered Paper;
- Rapid Oral;
- Poster;
- ePoster.

This must be labeled as a recommendation, not a guaranteed decision. ESMO Trial-in-Progress submissions are restricted to Poster/ePoster recommendations.

ASCO must not ask the author to state a presentation preference because ASCO determines the presentation format.

## 5. ASCO Rule Profile

### 5.1 Regular and final late-breaking abstracts

Required structure:

- Background
- Methods
- Results
- Conclusions

Validation:

- title plus body plus table must not exceed 2,600 characters excluding spaces;
- at most one table and no more than 10 table rows;
- figures are not allowed;
- title is objective and does not reveal results or conclusions;
- drugs use generic names;
- case reports are rejected;
- category selection uses an official track and subcategory;
- statistical methods are appropriate and sufficiently described;
- ethics approval, informed consent, trial registration, funding, disclosure, prior-presentation, and embargo fields are checked when applicable.

### 5.2 Late-Breaking Abstract — Shell

Require or explicitly mark missing:

- Background;
- Methods;
- primary endpoint;
- analysis type;
- data-freeze date;
- planned statistical methods;
- estimated date of final data availability.

The shell must not invent final results or conclusions.

### 5.3 Trials in Progress

Use Background and Methods only. Reject or flag:

- results or preliminary outcome data;
- unregistered trials where registration is applicable;
- studies that are not open, ongoing, or enrolling under the current rule set.

## 6. ESMO Rule Profile

### 6.1 Regular and final late-breaking abstracts

Required structure:

- Background
- Methods
- Results
- Conclusions

Validation:

- title plus body plus table must not exceed 2,000 characters excluding spaces;
- at most one table;
- a table counts as 225 characters by default and its own content must not exceed 600 characters;
- illustrations and graphs are not allowed;
- no more than 20 authors;
- case reports are rejected;
- the title reflects content and does not state results or conclusions;
- commercial drug names are excluded from the title;
- generic compound names are lowercase; a registered commercial name may appear in the text only after the generic name where permitted;
- abbreviations are defined on first use and complex regimens are identified clearly;
- good English and patient anonymity are required;
- no supplementary manuscript is accepted;
- trial protocol/registration, regulatory approval, informed consent, funding, legal entity, editorial assistance, prior presentation, and declarations of interest are checked when applicable.

For clinical or translational patient-data abstracts, flag when the proposed presenter is a sponsor/company employee rather than an independent practicing physician or investigator. Preclinical and Trial-in-Progress exceptions must be handled according to the ESMO rule profile.

### 6.2 Late-Breaking Abstract — Preliminary Intent

Require or explicitly mark missing:

- title;
- first author and contact details;
- declaration of interest;
- Background;
- Methods;
- expected Results;
- expected Conclusions.

Eligibility should be limited to high-quality, genuinely late findings with potential major clinical or disease impact and without conclusive data at the regular deadline.

### 6.3 Late-Breaking Abstract — Final

Require the preliminary intent to be completed with current:

- author list;
- Results;
- Conclusions;
- optional single compliant table.

An unfinalized late-breaking abstract must be treated as ineligible rather than silently converted to a regular abstract.

### 6.4 Trial in Progress

Required structure:

- Background
- Trial design

Validation:

- phase I–III trial;
- recruitment has begun or is completed by the applicable deadline;
- no protocol-specified endpoint has been reached;
- no results or preliminary data;
- no encore Trial-in-Progress submission;
- presentation recommendation limited to Poster or ePoster.

### 6.5 ESMO generative-AI record

The output must include an author-reviewable AI-assistance record when AI was used beyond basic spelling, grammar, or reference formatting:

- AI may assist with an initial draft only under human oversight;
- authors remain fully responsible for accuracy, originality, confidentiality, and compliance;
- AI cannot be an author or co-author and must not be cited as an author;
- if AI generated or analyzed research data, the tool/model specifications and use must be described in Methods;
- the website must continue to state that generated or polished content may be inaccurate and does not guarantee acceptance, compliance, or publication.

## 7. Prompt and Output Contract

Every organizer rule module supplies:

- classification instructions;
- permitted submission types;
- official category vocabulary;
- mandatory headings;
- title/body/table limits;
- prohibited-content checks;
- ethics, anonymity, disclosure, funding, registration, and embargo checks;
- organizer-specific presentation rules;
- AI-use and non-fabrication guardrails;
- bilingual explanatory labels.

Generated content must separate:

1. optimized abstract;
2. compliance report;
3. unresolved author questions;
4. inferred classifications with confidence;
5. AI-assistance record where applicable.

Missing factual fields must use an explicit placeholder or author question, never a plausible invented value.

## 8. Planned Project Changes

Expected files/modules:

- extend the `Conference` union with `ASCO` and `ESMO`;
- update conference routing, preload, and tab configuration;
- add `OncologyConferencePanel.vue` as the shared UI implementation;
- add `ASCOModule.ts` and `ESMOModule.ts` rule/prompt modules;
- add typed organizer profiles and a shared oncology classifier/validator;
- add bilingual i18n keys for tabs, submission types, categories, validation, and help;
- add concise official-rule references under `public/`:
  - `ASCO-annual-meeting-abstract-guidelines.md`
  - `ESMO-2026-congress-abstract-guidelines.md`
- update floating help documentation and high-level README feature inventory without duplicating a full usage manual.

Implementation should first inspect whether existing panel primitives can be extracted safely. It must not copy the full ESC or RSNA panel twice.

## 9. Testing Strategy

Follow test-driven development:

1. Add failing unit tests for the typed rule profiles and validators.
2. Add failing classification/prompt-contract tests for each submission type.
3. Add failing component tests for routing, tab visibility, state isolation, workflow controls, and i18n.
4. Implement the smallest shared panel and rule modules that pass the tests.
5. Run regression tests for ISMRM, RSNA, ER, ESC, IMAGE, membership billing, blind review, and responsive navigation.

Required commands:

```bash
npm run lint
npm test -- --run
npm run build
npm run test:browser
```

Representative fixtures:

- ASCO regular randomized trial;
- ASCO incomplete LBA shell;
- ASCO Trial-in-Progress containing prohibited preliminary results;
- ESMO regular biomarker study;
- ESMO LBA preliminary intent without conclusive data;
- ESMO Trial-in-Progress containing prohibited results;
- ESMO clinical abstract with a sponsor-employee presenter conflict;
- ESMO AI-assisted data analysis missing a Methods disclosure;
- over-limit abstracts, excess tables/authors, case reports, commercial-title names, and non-anonymized patient identifiers.

## 10. Boundaries

In scope:

- ASCO and ESMO tabs;
- shared oncology workflow;
- organizer-specific templates, classifiers, prompts, validators, help, and tests;
- complete Chinese and English interface strings.

Out of scope:

- CSCO;
- automatic submission to conference portals;
- scraping authenticated submission systems;
- guaranteed acceptance or compliance claims;
- automatic invention of missing scientific content;
- payment, quota, OAuth, database, provider, or MCP changes;
- committing source PDFs or other large reference files.

## 11. Success Criteria

- ASCO and ESMO are independently accessible and do not hide existing tabs.
- Both use the same established analysis/generation workflow and control-state rules.
- ASCO and ESMO submission types are correctly distinguished before generation.
- Organizer-specific character, structure, table, presentation, eligibility, ethics, disclosure, and AI rules are enforced.
- ESMO presentation recommendations respect the Trial-in-Progress restriction and are never presented as guaranteed.
- No generated output silently fabricates missing study facts.
- Chinese and English switching is complete for every new visible string.
- Existing tests pass and new unit/component/browser tests cover the added routes and key rule branches.
- The implementation introduces a shared oncology abstraction rather than two copied conference panels.

## 12. Approval Gate

Implementation begins only after approval of this product decision:

- expose `ASCO` and `ESMO` as two independent conference choices while sharing one internal oncology panel and rule engine.
