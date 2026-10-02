# Project Status

**Project:** Intelligent Student Academic Monitoring and Support System\
**Status:** Blueprint prepared; awaiting owner approval\
**Last updated:** 2026-10-02

## How to Maintain This File

-   Update this file after every significant task.
-   Preserve the approved phase plan and phase IDs from
    `docs/PROBLEM_STATEMENT.md`.
-   Record actual test results, not intended or assumed results.
-   Do not mark work complete without checking its acceptance criteria.
-   Record blockers and decisions explicitly.
-   Do not use this file to silently expand or replace project scope.

## Overall Status

-   [x] Initial project blueprint drafted
-   [ ] Owner approval received
-   [ ] Final technology/dependency choices verified
-   [ ] Implementation started
-   [ ] End-to-end acceptance scenario passed

## Phase Tracker

  -------------------------------------------------------------------------
  Phase             Name              Status            Verification /
                                                        Notes
  ----------------- ----------------- ----------------- -------------------
  P0                Project           Pending           Validate local
                    Foundation                          setup, webcam/model
                                                        loading, speech
                                                        support and
                                                        fallback.

  P1                Database, API and Pending           Verify persistence,
                    Roles                               role permissions,
                                                        duplicate roll
                                                        numbers and
                                                        enrollment
                                                        validation.

  P2                Attendance        Pending           Verify percentages,
                    Foundation                          threshold
                                                        boundaries,
                                                        corrections and
                                                        duplicate
                                                        prevention.

  P3                Face and Voice    Pending           Verify proposed
                    Attendance                          matches,
                                                        ambiguous/unknown
                                                        handling, review
                                                        flow and shared
                                                        persistence.

  P4                Marks and         Pending           Verify marks
                    Notifications                       validation, voice
                                                        confirmation,
                                                        notifications and
                                                        audit history.

  P5                Risk Analysis and Pending           Verify formula,
                    Insights                            categories,
                                                        explanations,
                                                        missing data and
                                                        recalculation.

  P6                Integration,      Pending           Verify end-to-end
                    Testing and Demo                    workflow, recovery
                                                        cases, clean setup
                                                        and demo
                                                        instructions.
  -------------------------------------------------------------------------

## Current Milestone

**M0 --- Blueprint review**

### Completed

-   Drafted problem statement and target users.
-   Defined P0/P1 scope and exclusions.
-   Proposed technology stack and architecture.
-   Defined phase objectives, tasks, dependencies, deliverables and
    acceptance criteria.
-   Defined testing, risk mitigations and end-to-end demo scenario.
-   Drafted repository and coding-agent rules.

### Not yet completed

-   Owner approval of the blueprint.
-   Final verification of library compatibility and dependency versions.
-   Any application implementation or test execution.

## Technical Decisions --- Proposed, Not Yet Final

-   Frontend: React + Vite.
-   Backend: Python + FastAPI.
-   Database/ORM: SQLite + SQLAlchemy.
-   Styling/charts: Tailwind CSS + Recharts.
-   Tests: Pytest + Vitest.
-   Face attendance: browser-side recognition with locally hosted model
    files, professor review and manual fallback.
-   Voice features: browser speech recognition where supported, with
    editable/manual fallback.
-   Risk analysis: transparent rule-based score unless a genuine ML
    model is separately approved and validated.
-   Demo data: fictional records only.
-   External paid APIs: not required for core functionality.

## Current Blockers

1.  Owner approval of the proposed scope and phase plan.
2.  Face-recognition library/model/browser compatibility must be
    verified in P0.
3.  Browser speech recognition support must be verified in the intended
    demo browser.
4.  Final authentication approach needs owner approval.

## Test Log

No project tests have been run because implementation has not started.

  Date   Test / Check   Result    Notes
  ------ -------------- --------- -------------------------
  ---    ---            Not run   Implementation pending.

## Decisions and Changes Log

  -----------------------------------------------------------------------
  Date                    Decision / Change       Approval
  ----------------------- ----------------------- -----------------------
  2026-10-02              Initial blueprint and   Awaiting owner approval
                          P0--P6 phase plan       
                          drafted                 

  -----------------------------------------------------------------------

## Next Actions

1.  Review and approve the blueprint in `docs/PROBLEM_STATEMENT.md`.
2.  Resolve the open decisions in Section 13 of that document.
3.  Verify existing repository structure and installed tools before
    changing anything.
4.  Start P0 only after approval.
5.  Update this file with actual P0 results before moving to P1.
