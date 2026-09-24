# PHASE 1 — REPOSITORY DISCOVERY & PROJECT BOUNDARY

## Claude Code task

You are the repository discovery and architecture agent.

Do not begin by building the healthcare dashboard.

First understand the existing portfolio.

## Objectives

Determine:

1. What stack is this portfolio using?
2. What framework powers the site?
3. Where do portfolio projects live?
4. How are routes defined?
5. What component library/design system exists?
6. How is styling handled?
7. What state/data-fetching patterns exist?
8. What test infrastructure exists?
9. What build/deploy system exists?
10. How are environment variables handled?
11. Are there existing AI/agent utilities?
12. Is there an existing data visualization library?
13. Is there an existing chart/table/map system?
14. What conventions should this project follow?

## Required behavior

Inspect the actual repository.

Do not infer architecture from file names alone.

Read the key configuration files and representative application files.

Identify existing patterns before creating new ones.

## Project boundary

Recommend and then implement, after inspection, an isolated project boundary.

Prefer a structure conceptually similar to:

```text
portfolio/
  existing-projects/
  healthcare-intelligence/
    app/
    agents/
    data/
    intelligence/
    evaluation/
    docs/
```

Adapt this to the actual repository rather than forcing this exact structure.

## Portfolio-safe data boundary

Document:

- public data allowed
- synthetic data allowed
- proprietary data prohibited
- PHI prohibited
- secrets prohibited

## Required deliverables

Create:

`docs/healthcare-intelligence/REPOSITORY_DISCOVERY.md`

Contents:

- repository overview
- detected stack
- existing conventions
- recommended project boundary
- dependencies already available
- dependencies likely needed
- risks
- assumptions
- proposed implementation plan

Also create:

`docs/healthcare-intelligence/PROJECT_BOUNDARY.md`

Explain how this project remains isolated from unrelated portfolio projects while reusing appropriate portfolio infrastructure.

## Stop condition

Do not proceed to large-scale feature implementation until these documents exist.

A thin proof-of-life route/component is allowed only if useful for confirming integration.

## Acceptance criteria

A developer unfamiliar with the repository should be able to read the discovery document and understand how this project fits into the existing portfolio without opening the entire codebase.
