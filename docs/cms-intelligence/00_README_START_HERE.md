# Healthcare Intelligence Executive Dashboard — Claude Code Prompt Pack

## Purpose

This prompt pack is the implementation playbook for building a portfolio project that demonstrates an enterprise-grade healthcare intelligence system.

The project is inspired by the kinds of questions an Optum / UnitedHealthcare executive team could need answered, but the portfolio implementation must be treated as a **public-data-first demonstration**, not as a representation of confidential UHC/Optum systems or data.

The repository already contains the user's broader portfolio website. This project is one project inside that portfolio.

## How to use this pack

Run the phases in order with Claude Code from the existing portfolio repository.

1. `01_PHASE_1_REPOSITORY_DISCOVERY.md`
2. `02_PHASE_2_INTELLIGENCE_BLUEPRINT.md`
3. `03_PHASE_3_AGENT_IMPLEMENTATION.md`
4. `04_PHASE_4_DATA_SOURCE_AND_PIPELINE.md`
5. `05_PHASE_5_DASHBOARD_AND_UX.md`
6. `06_PHASE_6_MODEL_PROVIDER_EVALUATION.md`
7. `07_PHASE_7_HARDENING_TESTING_AND_PORTFOLIO.md`

Use `00_MASTER_ORCHESTRATOR.md` when you want Claude Code to manage the full program rather than executing one phase at a time.

## Expected project outcome

The finished portfolio project should demonstrate:

- A compelling executive dashboard
- A coordinated healthcare intelligence agent team
- Public CMS data ingestion and source monitoring
- A governed executive question catalog
- A reusable semantic/metric model
- Trend and anomaly detection
- Policy and reimbursement monitoring
- Evidence-backed executive narratives
- A provider/model-independent agent architecture
- A test harness for comparing LLM providers
- Clear provenance from dashboard insight back to source data
- A polished portfolio case-study narrative

## Important operating constraint

Do not invent access to UnitedHealthcare, Optum, CMS restricted research files, proprietary claims, PHI, or confidential corporate information.

Use public CMS data and synthetic/demo data for portfolio implementation.

Where an internal UHC/Optum data source would normally be required, create an adapter/interface and document the expected schema rather than fabricating the data.

## Development philosophy

Build this as a real software project, not as a giant prompt.

The system should separate:

- Agent instructions
- Domain logic
- Data adapters
- Source metadata
- Analytical methods
- Provider/runtime adapters
- Dashboard presentation
- Tests
- Evaluation datasets
- Portfolio documentation

Do not overbuild prematurely. Each phase must leave the repository in a runnable, inspectable state.

## Definition of done

The project is complete when a reviewer can:

1. Open the portfolio page.
2. Understand the executive problem in under one minute.
3. Interact with the dashboard.
4. See current or clearly dated public-data signals.
5. Open an insight and inspect the evidence.
6. See why the insight matters.
7. See which source produced the signal.
8. Understand the agent architecture.
9. Run the tests/evaluation harness.
10. Understand how the same intelligence layer could be moved from Claude to another model provider.
