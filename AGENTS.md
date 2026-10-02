# AGENTS.md --- Project-Wide Coding Instructions

## Project

**Intelligent Student Academic Monitoring and Support System**

This repository contains a hackathon prototype. The approved
specification and phase plan are defined in: -
`docs/PROBLEM_STATEMENT.md` - `docs/PROJECT_STATUS.md`

## Mandatory Reading

Before making changes, read these three files in full: 1. `AGENTS.md` 2.
`docs/PROBLEM_STATEMENT.md` 3. `docs/PROJECT_STATUS.md`

If a file is missing, report that fact and do not invent its approved
contents.

## Project Documentation Location

All project planning and context documents must be stored in `docs/`,
except this root `AGENTS.md`.

Keep the approved development phases consistent across all AI agents.
Update `docs/PROJECT_STATUS.md` after every significant task and
preserve the existing phase plan.

If the project already uses a different structure or a
technology-specific convention, inspect it first and adapt without
breaking the existing setup.

## Scope Control

-   Implement only the current assigned phase and its explicitly
    approved dependencies.
-   Do not silently add features, change the technology stack, replace
    the database, or expand scope.
-   Do not report mocked, simulated, or incomplete functionality as
    fully implemented.
-   Keep face attendance, professor voice-command attendance, and
    voice-assisted marks entry as separate capabilities.
-   Face matching proposes an identity; it does not guarantee identity.
    Keep professor review and manual correction.
-   Voice attendance means the professor speaks student names or roll
    numbers. Speaker identity verification is not included unless
    explicitly approved.
-   Label rule-based academic risk calculations as rule-based; do not
    describe them as a trained ML model.
-   Use fictional demo data only unless real-data use is explicitly
    authorized.

## Architecture and Code Quality

-   Proposed stack: React + Vite, Python + FastAPI, SQLite + SQLAlchemy,
    Tailwind CSS, Recharts, Pytest and Vitest.
-   Inspect the existing repository before choosing exact package
    versions or changing conventions.
-   Keep frontend, API, business logic and persistence responsibilities
    clearly separated.
-   Use one shared backend and database for attendance, marks,
    notifications and risk calculations.
-   Validate all input on the backend. Frontend checks do not replace
    backend validation.
-   Enforce authorization on every protected endpoint, not only by
    hiding UI controls.
-   Store secrets in environment variables; never commit credentials.
-   Keep biometric data protected. Prefer face descriptors/embeddings
    over retained raw photos where practical, restrict access, and
    support deleting a template.
-   Handle unsupported browser features, denied camera/microphone
    permissions, ambiguous speech and failed recognition gracefully.
-   Keep a manual attendance fallback.
-   Do not introduce paid services without approval.

## Required Workflow

1.  Inspect the repository and current git status.
2.  Read the mandatory documents.
3.  Confirm the assigned phase and its acceptance criteria.
4.  Make the smallest coherent set of changes.
5.  Run relevant tests and verification commands.
6.  Report actual results, including failures and untested behavior.
7.  Update `docs/PROJECT_STATUS.md` with completed work, test results,
    blockers and next actions. Do not rewrite the approved phase plan.
8.  Commit verified changes locally at meaningful milestones when
    appropriate.
9.  Before pushing any changes to GitHub, ask for explicit approval as
    described below.

## Definition of Done

A task is done only when: - Its acceptance criteria have been checked. -
Relevant tests pass, or remaining failures are documented. - UI, API and
database behavior are consistent. - Error and unsupported cases are
handled. - Documentation and project status are updated. - No unapproved
scope or architecture changes were made.

## Git Commit and Push Approval

1.  Commit verified changes at meaningful milestones when appropriate.
2.  Before pushing any changes to GitHub, ask me for approval.
3.  Ask for approval only once for each planned push, summarizing the
    commits and changes that will be pushed.
4.  Wait for my explicit approval before executing `git push`.
5.  If I decline, do not push. Keep the local commits and continue
    development when appropriate.
6.  Do not ask for approval again for the same push unless the changes
    to be pushed have materially changed.
7.  Never force-push or rewrite shared Git history without my explicit
    approval.
8.  Report whether the push succeeded or failed.

**Default workflow:** Implement → Test → Commit locally → Update
`PROJECT_STATUS.md` → Ask me once → Push to GitHub only after approval.

## Phase IDs

Preserve these phase IDs and their order: - `P0` --- Project
foundation - `P1` --- Database, API and roles - `P2` --- Attendance
foundation - `P3` --- Face and voice attendance - `P4` --- Marks and
notifications - `P5` --- Risk analysis and insights - `P6` ---
Integration, testing and demo

Do not mark a phase complete until its acceptance criteria have been
verified.
