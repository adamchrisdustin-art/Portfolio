# RECOMMENDED PROJECT STRUCTURE

Adapt this to the existing portfolio repository after Phase 1 inspection.

A strong target architecture is:

```text
portfolio-repo/
│
├── existing portfolio files...
│
├── healthcare-intelligence/
│   ├── app/
│   ├── components/
│   ├── data/
│   │   ├── adapters/
│   │   ├── fixtures/
│   │   ├── raw/
│   │   └── processed/
│   ├── intelligence/
│   │   ├── questions/
│   │   ├── metrics/
│   │   ├── trends/
│   │   ├── evidence/
│   │   └── policies/
│   ├── evaluation/
│   │   ├── tasks/
│   │   ├── fixtures/
│   │   └── results/
│   ├── agents/
│   ├── providers/
│   ├── tests/
│   └── docs/
│
├── .claude/
│   ├── agents/
│   ├── skills/
│   └── settings.json
│
└── docs/
    └── healthcare-intelligence/
```

The actual location should follow the portfolio's existing structure.

## Important distinction

There are three architectures:

### Development architecture

Claude Code + VS Code + repository

### Intelligence architecture

Orchestrator + domain agents + analytics + sources + evidence

### Product architecture

Dashboard + API/runtime + model provider + data services

Do not collapse these into one layer.

## Provider abstraction

Conceptually:

```text
                       Application
                           |
                    Intelligence API
                           |
                    Model Router
                  /        |        \
              Claude     OpenAI     Other
                                      |
                              Open Source /
                               Cerebras
```

Business rules and source logic stay above the model provider.

## Data abstraction

Conceptually:

```text
                 Semantic Model
                       |
       --------------------------------
       |        |        |            |
   Claims   Enrollment  Provider   Reimbursement
       |        |        |            |
    Public   Public    Public      Public
     CMS      CMS       CMS       CMS / PFS
       |
    Synthetic / Demo
       |
  Future Enterprise
```

The future enterprise layer should replace adapters, not the agent architecture.
