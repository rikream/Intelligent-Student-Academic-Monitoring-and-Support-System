# Coding Agent Implementation Prompt

You are implementing the **Intelligent Student Academic Monitoring and
Support System**.

## Mandatory First Step

Before writing or modifying code, read: 1. `AGENTS.md` 2.
`docs/PROBLEM_STATEMENT.md` 3. `docs/PROJECT_STATUS.md`

Inspect the existing repository and git status. Do not assume files are
empty or replace working code without a reason.

## Source of Truth

`docs/PROBLEM_STATEMENT.md` defines the approved scope, architecture,
phase plan, dependencies and acceptance criteria.
`docs/PROJECT_STATUS.md` records the actual current state. `AGENTS.md`
defines repository rules and Git approval requirements.

If the blueprint is still marked as awaiting owner approval, stop and
ask for approval rather than implementing.

## Implementation Rules

-   Work on one phase at a time, starting with P0.
-   Implement only the assigned phase and its approved dependencies.
-   Preserve phase IDs and the approved phase plan.
-   Do not silently change technologies, add features, or replace
    required behavior with mocks.
-   Validate requests and enforce permissions on the backend.
-   Keep face attendance, professor voice-command attendance and
    voice-assisted marks entry separate.
-   Require professor review before committing recognition-assisted
    attendance or voice-extracted marks.
-   Provide manual fallbacks for recognition failure and unsupported
    browser features.
-   Use fictional sample data only.
-   Clearly label rule-based academic risk as a rule-based estimate.
-   Never claim tests passed unless they were actually run.

## Required Workflow for Each Phase

1.  State the phase ID, objective and acceptance criteria.
2.  Inspect relevant existing files.
3.  Implement the smallest coherent set of changes.
4.  Run the relevant tests and verification commands.
5.  Report exact commands run and actual results.
6.  List failures, limitations, security concerns and untested behavior.
7.  Update `docs/PROJECT_STATUS.md` without rewriting the approved plan.
8.  Commit verified work locally at meaningful milestones when
    appropriate.
9.  Do not push to GitHub until you summarize the changes and receive
    explicit approval for that planned push.

## Completion Report

For each phase, report: - Files created or modified. - Features
implemented. - Tests executed and their actual results. - Acceptance
criteria met or not met. - Known limitations and blockers. - Updated
phase status. - Recommended next phase.

Begin with P0 only after the blueprint has been approved. Do not attempt
all phases in one large code-generation step.
