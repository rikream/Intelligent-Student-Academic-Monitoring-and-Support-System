# Project Status

**Project:** Intelligent Student Academic Monitoring and Support System\
**Status:** P3 acceptance partial: live student face matching and attendance submission verified; fresh template registration was not exercised. Browser speech recognition in the target VS Code Chromium browser fails with `network` before transcription. The typed fallback and API flow pass.\
**Last updated:** 2026-10-03

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
-   [x] Owner approval received to begin P0
-   [x] P0 foundation acceptance checks verified (speech network limitation documented)
-   [x] P1 demo-login approach approved
-   [x] P1 persistence, role scoping and student/subject/enrollment checks verified
-   [x] P1 expanded fictional demo dataset seeded and role-scoped API/UI views verified
-   [x] P2 attendance acceptance checks verified
-   [x] P3 implementation checks passed (automated tests, live API smoke checks, and UI polish remain consistent with the documented prototype)
-   [x] P3 acceptance: real student camera matching and attendance confirmation verified with an explicitly consenting participant in the target browser
-   [ ] P3 acceptance: fresh face-template registration flow verified (an encrypted STU001 template already existed and was preserved)
-   [ ] P3 acceptance: spoken-command transcription and review verified in the target browser
-   [x] Core manual P4 marks/notifications path implemented and browser-verified
-   [x] P4 voice-mark parsing, explicit review/confirmation, and typed fallback implemented and browser-verified
-   [x] Student active-session discovery, own-face verification flow, and self-only attendance submission implemented
-   [x] Rule-based P5 risk estimate implemented with missing-data explanations
-   [ ] P4 acceptance complete (live microphone transcription remains unverified)
-   [ ] P5 acceptance complete (full formula/data coverage and end-to-end recalculation acceptance remain outstanding)
-   [ ] End-to-end acceptance scenario passed

## Phase Tracker

  -------------------------------------------------------------------------
  Phase             Name              Status            Verification /
                                                        Notes
  ----------------- ----------------- ----------------- -------------------
  P0                Project             Complete          Frontend/backend start; health returns
                    Foundation                          200; tests pass. Live camera and local
                    detector verified. Web Speech API returns
                    a browser speech-service network error;
                    typed fallback works.

  P1                Database, API and Core complete    SQLite persistence, signed demo login,
                    Roles                                role-scoped APIs, admin writes, duplicate
                                                        checks and enrollment validation tested.
                                                        P2 confirms attendance role boundaries;
                                                        marks authorization is checked in P4.

  P2                Attendance        Complete          Manual sessions/records, percentages,
                    Foundation                          thresholds, corrections/audit, duplicate
                                                        handling and role limits tested. Live API,
                                                        browser professor view and SQLite restart
                                                        persistence verified.

  P3                Face and Voice    Implementation    Encrypted consent-gated
                    Attendance       complete;        templates and scoped
                                     acceptance       face proposals; typed
                                     pending          voice proposals; manual
                                                        confirmation and deletion
                                                        tested. A live student
                                                        camera match and attendance
                                                        confirmation now pass; fresh
                                                        template registration was
                                                        not exercised. Spoken
                                                        attendance returned a browser
                                                        speech-service network error.

  P4                Marks and         Core workflow    Manual assessment/mark
                    Notifications     implemented;     creation/update,
                                     acceptance       student-scoped reads,
                                     partial          notifications, validation
                                     and professor-visible update
                                     history tested. Deterministic
                                     voice extraction, editable
                                     fallback and confirm-before-save
                                     verified; live microphone
                                     transcription remains pending.

  P5                Risk Analysis and Rule-based       Attendance/marks based
                    Insights          baseline         estimate, factors,
                                     implemented;     recommendation and explicit
                                     acceptance       missing-data state are
                                     partial          implemented. Wider factor
                                                        coverage and full acceptance
                                                        pending.

  P6                Integration,      Partial          Role workspaces, manual
                    Testing and Demo                    marks-to-notification-to-risk
                                                        flow, tests/build and
                                                        responsive browser checks
                                                        verified. Student face matching/
                                                        submission passed; fresh face
                                                        registration, live speech service
                                                        and complete scenario remain pending.
  -------------------------------------------------------------------------

## Current Milestone

**Interactive analytics completed; live face/voice acceptance is partial**

### Role workspace refinement (2026-10-03)

-   Refined the existing role-scoped styles for student status and subject
    visibility, professor session/roster and face/voice workflows, and
    administrator management and academic tables. Added presentation-only
    class hooks to distinguish the professor face and voice panels and the
    active session context.
-   Kept the existing teal/navy palette, shared component language,
    responsive shell, login, APIs and all workflow behavior unchanged.
    No charts or features were added. Professor-account management and an
    administrator notification view remain unavailable in the existing API
    and were not represented as implemented.
-   Verification: `npm test` passed (46 tests across 14 files);
    `npm run build` passed with the existing 1,314.44 kB face-api chunk
    warning; `git diff --check` passed. Browser review covered student,
    professor and administrator workspaces at 390, 768 and 1440 px with no
    document-level horizontal overflow. Professor session roster, face/voice
    panels and mark-entry panel, and administrator management and academic
    tables were present; no camera or microphone was activated.

### Restrained university frontend visual refresh (2026-10-03)

-   Updated the shared frontend palette and components to use a dark navy
    institutional sidebar, a white/light-grey workspace, muted teal accents,
    subtle borders and lighter card treatment. Removed the remaining purple
    treatment and gradient from shared screens.
-   Added the Academic Support Portal label beneath ScholarSpace in the
    signed-in navigation brand. Existing dashboard layouts, API calls,
    authentication, routes, attendance, face, voice, marks, notifications
    and risk behavior were not changed.
-   Browser-checked the login and student, professor and administrator
    workspaces at 390, 768, 1024 and 1440 pixels. The login preselected
    `student.001`, `professor.cs` and `admin.demo` for their respective
    roles; all role workspaces loaded, with no document-level horizontal
    overflow at the sampled widths.
-   Frontend verification: 46 tests passed across 14 files; the production
    build succeeded with the existing 1,314.44 kB face-api chunk warning;
    `git diff --check` passed. No camera or microphone workflows were
    exercised in this visual-only pass.

### Role template differentiation (2026-10-03)

-   Refined the existing role-scoped CSS without replacing shared workspace
    components or changing application behavior. Student pages receive
    more whitespace and softer blue framing around personal attendance,
    progress, alerts and activity. Professor pages use tighter metrics,
    session controls and roster rows, with clear institutional rules on
    attendance tools. Administrator pages use denser tables, stronger
    dividers and formal management sections.
-   Shared typography, navy navigation, light workspace surfaces, teal
    accents, button/input styling and status conventions remain common.
    No charts, features, API, authentication or business logic were added.
-   Frontend tests pass: 46 tests across 14 files. The first suite run,
    concurrent with the build, had one attendance-workspace timing failure;
    the affected file passed independently and the subsequent full suite
    passed. Production build passed with the existing 1,314.44 kB face-api
    chunk warning.

### Classic university palette pass (2026-10-03)

-   Updated shared CSS tokens to use deep teal-blue `#205067`, sky-blue
    highlights `#7EB3D8`, charcoal text, blue-grey borders, white surfaces
    and a very light blue-grey canvas. Applied the same institutional family
    to login, navigation, buttons, focus states, tables and all three role
    workspaces.
-   Kept semantic status colors: muted green for success, amber for warnings
    and below-requirement attendance, and muted red for errors/high risk.
    No layout, workflow, component behavior, API, or business logic changed.
    A source scan found no purple color values; legacy `indigo`/`violet`
    class names remain only as hooks whose styles are now blue-teal.
-   Frontend tests passed: 46 tests across 14 files. An initial test run
    concurrent with the production build showed one existing attendance
    workspace timing failure; a full suite rerun without build contention
    passed. Production build passed with the existing 1,314.44 kB face-api
    chunk-size advisory.

### P3 implementation status

The P3 implementation is largely complete. The backend and frontend automated
checks, documented API smoke tests, and the current UI polish remain aligned
with the prototype that is implemented and tested in this repository.

### P3 acceptance status

P3 acceptance remains partial. Live student face matching and attendance
submission have been verified with an explicitly consenting participant. The
following remain unverified:

-   Fresh real camera-based face-template registration (an existing encrypted
    STU001 template was used for the verified match).
-   Spoken attendance command transcription and review in the target browser.

This distinction is intentional: automated tests and prototype checks confirm
implementation quality and code behavior, but they do not replace the required
real-world acceptance checks above.

### Hackathon final UI and academic workflow pass

-   Refined shared role navigation, active-section indication, branded
    navigation mark, risk distribution visualization, risk summary cards,
    assessment forms, mark tables, notification center and narrow-screen
    layouts. Existing attendance, face-consent/privacy, and professor
    confirmation flows were retained.
-   Added API-backed P4 foundations: professors may create assessments and
    save/update marks only in their assigned subjects and for enrolled
    students; maximum score is enforced; updates write an audit event; and
    each mark create/update creates a notification owned by the affected
    student.
-   Added student-only notification listing/read state and a role-scoped
    subject overview. Students receive only their own marks/risk row;
    professors see their assigned subject rosters; administrators may inspect
    the overall subject records. Backend authorization remains authoritative.
-   Added transparent P5 baseline scoring using attendance (75% and 80%
    boundaries) and the mean percentage of recorded assessments (<50%, <65%).
    Missing inputs are described, and no-data subjects return
    `insufficient_data` with no numeric score. This is a rule-based estimate,
    not an ML model; assignments and prior performance are not inputs.
-   Verified live in the browser: professor created fictional `Demo Midterm
    2026`, saved `35/40` for `DEMO001`, then confirmed an update to `36/40`.
    The professor viewed the audit entry. The student account displayed the
    updated result (90%), risk explanation, and both mark notifications.
    Administrator overview and professor/student views rendered. At 390px,
    student and professor views had no document-level horizontal overflow.
-   Final validation: `.\.venv\Scripts\python.exe -m pytest backend\tests`
    passed (29 tests); frontend `npm test` passed (24 tests); `npm run build`
    succeeded with the known ~1.31 MB face-api chunk warning; backend
    `compileall` and `git diff --check` passed.

### Completed

-   Added SQLAlchemy 2 models for users, student profiles, subjects,
    enrollments and professor-to-subject permissions. SQLite foreign keys,
    unique username/roll/code/enrollment constraints and semester checks
    are enforced.
-   Added environment configuration, startup schema initialization, a
    repeatable fictional-data seed command, and signed one-hour bearer
    tokens for clearly labelled demo login.
-   Added backend APIs for demo login/current user and role-scoped student,
    subject and enrollment reads; only administrators can create student,
    subject and enrollment records. Professors are restricted to assigned
    subjects and their enrolled students; students only see their records.
-   Owner selected the clearly labelled demo-login approach for P1.
-   Verified demo records, authentication, authorization, duplicate
    rejection, enrollment validation and data persistence across app
    restarts.
-   P1 backend tests pass (9 tests); frontend tests pass (7 tests);
    production build succeeds with the face-api chunk warning.
-   Added class-session creation, manual attendance records, corrections,
    subject summaries, configurable 75%/80% thresholds and correction
    audit events.
-   Added attendance permissions: professors manage only assigned
    subjects, students see only their own enrolled records, and
    administrators can view summaries and make audited corrections.
-   Added professor manual attendance and role-specific summary views in P2.
-   Backend suite passes (18 tests) and frontend suite passes (10 tests).
    `pip check`, Python compilation, `git diff --check`, and the frontend
    production build pass; Vite reports the existing large face-api chunk
    warning.
-   Live HTTP checks verified session creation and roster retrieval,
    recording, duplicate rejection (409), administrator correction,
    audit history, summary recalculation, student-scoped access, and
    denied writes by an unassigned professor (403). A backend restart
    preserved the session, corrected summary and audit history.
-   Browser UI sign-in and professor attendance summary/workspace were
    verified against the live backend.
-   Added AES-GCM encrypted face descriptors, explicit professor consent
    confirmation, assignment-scoped registration/removal/matching, and a
    student-owned status/delete view. Recognition returns only a proposal;
    it never writes attendance by itself.
-   Added local face detector, landmark and recognition model assets under
    the existing package license. The UI handles camera denial and exposes
    model-loading checks without opening the camera.
-   Added exact-name/roll voice command parsing, Web Speech API capture,
    typed fallback and explicit professor review before using the existing
    attendance API.
-   Backend suite passes (24 tests), frontend suite passes (19 tests),
    dependency checks and Python compilation pass, and production build
    passes with the existing face-api bundle-size warning.
-   Live browser verification loaded all local recognition models, displayed
    the professor face/voice panels, completed typed-command review and
    confirmation through the attendance API, and showed the student's
    own face-template privacy status.
-   Live HTTP checks used only a fabricated 128-number descriptor to
    verify encrypted template registration, matching proposal and removal.
    No real biometric sample was collected or stored.
-   Refreshed the existing sign-in and role-based workspaces with consistent
    navigation, responsive cards/tables, clearer attendance status and
    empty states, and administrator forms connected to the existing student,
    subject and enrollment APIs. No dashboard data is hardcoded.
-   Preserved the existing attendance, face-consent/privacy, professor-review
    and voice-command flows. Professor-account and assignment management
    remain unavailable because no matching API operations exist.
-   Fixed narrow-screen sign-out visibility and contained wide data tables
    within their scroll regions; student, professor and administrator views
    were inspected in the browser at desktop and 390px widths.
-   The final browser pass additionally verified assessment creation, mark
    saving, student result visibility, notification association, and risk
    display through the real local API and fictional SQLite demo records.
-   Added focused API and UI tests for score validation, role/subject privacy,
    notifications, mark auditing, risk explanations and assessment workflow.

### Voice-assisted marks, camera consent, and risk recommendations

-   Added deterministic extraction of a single numeric or common English
    number-word score and exact enrolled-student full-name/roll-number lookup
    against the selected subject roster. Unknown, ambiguous, repeated,
    multiple-score, negative and out-of-range commands are rejected without
    submitting a mark.
-   Added browser speech capture with editable transcript and typed fallback.
    The proposal displays the student, assessment and score; only explicit
    **Confirm & Save** calls the existing marks endpoint. Cancel performs no
    write. Successful saves refresh the professor overview and use the
    existing audit/notification behavior.
-   Added required camera-use consent before `getUserMedia` is requested.
    Revoking consent stops the stream and clears a pending match; existing
    per-student face-template registration consent and professor match review
    remain separate.
-   Made rule-based risk recommendations use actual attendance/marks values
    and name a practical next step. Assignments and previous-performance
    inputs remain absent and are not fabricated.
-   Browser smoke test with fictional `DEMO001`: typed “Aarav Rao got 18
    marks”, reviewed the 18/40 proposal, and confirmed the save. The professor
    overview refreshed; the student dashboard displayed 18/40 and the
    corresponding notification. After restarting the backend to load the new
    risk recommendation, the student view showed a recommendation grounded
    in the recorded 45.0% assessment average.
-   Live speech transcription through the microphone and real camera-based
    matching remain unverified. The typed fallback and disabled-before-consent
    camera gate are covered by frontend tests.

### Student active-session attendance flow

-   Added an explicit `ended_at` lifecycle for attendance sessions. Professors
    can end a selected session; session responses now identify the professor,
    whether the session is active, and (for students only) the current
    student's attendance status. On SQLite startup, the existing
    `class_sessions` table is upgraded without replacing data, and legacy
    sessions are treated as ended rather than falsely advertised as live.
-   The student dashboard fetches sessions through the existing
    `GET /api/attendance/sessions` route, which remains restricted to subjects
    the student is enrolled in. Only active sessions appear as joinable; an
    existing record shows its status and removes the join action.
-   The student opens the webcam only after selecting **Join & Mark
    Attendance**. The existing browser face-descriptor function and
    `POST /api/attendance/sessions/{id}/face-match` route are reused. Student
    matching is restricted server-side to that student's own template; a
    successful result requires a separate confirmation before submitting to
    `POST /api/attendance/sessions/{id}/records`.
-   Student attendance writes are server-authorized for the authenticated
    student's own ID, present status, enrollment, and an active session.
    Duplicate submissions remain protected by the existing unique constraint
    and return the existing conflict response. Successful submission refreshes
    the session status and attendance summary.
-   Automated coverage includes active/ended listing, legacy schema upgrade,
    own-student authorization, duplicate/ended rejection, private face
    matching, no-session state, camera denial, unknown face, confirmation
    before record, and professor session closure.
-   Automated and mocked-browser checks do not prove live webcam recognition.
    No real face match with an explicitly consenting participant was performed.

### Expanded fictional demo dataset

-   Expanded the repeatable `backend.seed` command to provide 30 fictional
    student accounts (`student.001`–`student.030`, `STU001`–`STU030`), six
    professor accounts (retaining `professor.cs` and `professor.math`), and
    eight CSE subjects. The `User` schema has usernames but no professor
    display-name field; README documents the fictional names represented by
    the professor accounts without changing the schema.
-   Seeded varied 3–5-course schedules, eight ended historical sessions per
    CSE subject, attendance records for enrolled students only, four
    assessments per subject, varied marks, and event-linked mark,
    attendance-warning, and high-risk notifications. Risk notifications use
    the existing rule-based risk calculation; no risk labels or historical
    performance were fabricated.
-   Existing `student.001` / `student.002` demo logins were retained and their
    fictional roll numbers updated to `STU001` / `STU002`. Two unrelated
    pre-existing student profiles, legacy subjects, and their records remain
    untouched. Consequently, a clean seed database has 30 students and eight
    subjects; the configured database has 32 students and 10 subjects after
    retaining those older records.
-   Clean-database seed totals: 30 students, six professors, eight CSE
    subjects, 120 enrollments, 64 sessions, 960 attendance records, 32
    assessments, 480 marks, and 220 notifications.
-   Configured database after seeding: 39 users, 32 students, 10 subjects,
    121 enrollments, 73 sessions, 961 attendance records, 33 assessments,
    481 marks, and 240 notifications. Existing rows explain the difference;
    running the seed twice left these totals unchanged. The legacy `MA301`
    subject remains assigned to `professor.math` alongside its new `CS302`
    assignment.
-   API and browser checks verified administrator visibility, professor
    subject/student scoping for `professor.cs` and `professor.math`, distinct
    dashboards for `student.001`–`student.003`, varied marks/attendance/risk/
    notification data, and enrollment-scoped active-session visibility.
-   P1 dataset work does not change the existing phase order, APIs, database
    schema, authentication, or role authorization.

### Professor face-template dropdown and model-check diagnosis

-   Reproduced with the configured seed database and the live professor UI.
    On a fresh `professor.cs` login, the attendance session selector was
    initially blank even though active CS301 sessions existed. The latest
    active session was ID 75 for CS301 (subject ID 1). Its professor is
    authorized for that subject; the subject has 14 enrolled students, all
    linked to student-role accounts. The roster endpoint returned all 14.
-   The dropdown uses the session roster from
    `GET /api/attendance/sessions/{session_id}/records`; it does not filter on
    face enrollment or consent. The separate
    `GET /api/attendance/sessions/{session_id}/face-templates` endpoint returns
    registration booleans only. It returned 14 entries, all
    `registered=false`; zero templates are currently stored for those
    students. The previous empty view was therefore not caused by missing
    seed enrollments, missing student accounts, lack of consent, or a
    registered-template filter. A blank session selection on fresh login left
    the session roster/form without a current session context.
-   Updated the professor workspace to select the latest active session for
    the selected subject when no valid session is selected. The template
    selector continues to use the full attendance roster and shows an
    explicit empty-list message when a selected session has no enrolled
    students. Added a frontend regression check confirming that a student
    without a template appears.
-   The face-model check uses the existing `loadFaceModels()` loader and local
    `/models` paths; no recognition library or asset paths were changed.
    Clicking **Check recognition models** in the browser successfully loaded
    the detector, landmark, and recognition models. The initial “not checked”
    message was the expected pre-action state, not a loading failure.
-   Face registration endpoint authorization was inspected: professor role,
    assignment to the session subject, student enrollment, and explicit
    registration consent are enforced. The `PUT
    /api/attendance/subjects/{subject_id}/students/{student_id}/face-template`
    integration behavior remains covered by tests using synthetic descriptors.
    No actual face was captured or registered in this task because that would
    require a real participant's explicit consent. No fake descriptor was
    added to the configured database.
-   Existing face-match and attendance integration tests cover descriptor
    matching and record submission with synthetic descriptors. Live camera
    enrollment, real face matching, and end-to-end student attendance remain
    unverified and require an explicitly consenting participant.

### Limitations and decisions for later phases

-   No consented participant was available for an end-to-end camera
    enrollment/match check, so real-image face matching remains unverified.
    P3 must not be marked complete until a fictional/consented test
    participant is checked.
-   Spoken attendance was tested in the target VS Code Chromium browser.
    Both commands returned the browser SpeechRecognition `network` error
    before a transcript. The typed command fallback and manual roster work;
    the browser speech service must be available for live transcription.
-   Face matching uses a prototype descriptor-distance cutoff and no
    liveness detection. It is not calibrated, does not prove identity and
    must remain professor-reviewed.
-   Persisting face templates requires a separate stable
    `FACE_TEMPLATE_ENCRYPTION_KEY`; losing or changing it prevents decrypting
    registered templates. Demo login remains password-free and is not
    production authentication.
-   Demo login has no password by design and is local fictional-data-only;
    it is not suitable as production authentication. It can be disabled
    with `DEMO_LOGIN_ENABLED=false`.
-   The current prototype initializes schema with `create_all`; it does not
    migrate existing database schemas.
-   The UI review did not request camera permission or record speech. The
    professor face/voice panels and privacy controls were reachable, but
    real camera capture/matching and spoken-command transcription remain
    unverified as noted above.
-   Attendance uses `create_all` like the existing prototype schema; no
    migration tool is configured.
-   Voice-assisted marks implementation and typed fallback are available,
    but actual Web Speech microphone transcription is not yet verified in the
    target browser. Keep P4 acceptance partial until that check succeeds.
-   P5 remains an initial explainable rule-based estimate using only
    attendance and recorded assessment marks. Assignments and previous
    performance are not modeled.

## Technical Decisions --- Proposed, Not Yet Final

-   Frontend: React + Vite.
-   Backend: Python + FastAPI.
-   Database/ORM: SQLite + SQLAlchemy.
-   Styling/charts: Tailwind CSS + Recharts.
-   Tests: Pytest + Vitest.
-   Face attendance: locally hosted browser-side recognition models,
    encrypted backend descriptors, explicit consent, professor review and
    manual fallback. Recognition is not identity verification.
-   Voice features: browser speech recognition where supported, with
    editable/manual fallback.
-   Risk analysis: transparent rule-based score unless a genuine ML
    model is separately approved and validated.
-   P1 authentication: clearly labelled, server-configured demo login
    using seeded usernames and signed expiring bearer tokens, approved by
    the owner on 2026-10-02.
-   Demo data: fictional records only.
-   External paid APIs: not required for core functionality.

## Current Blockers

1.  Clarify that Section 4's P0/P1 feature-priority labels are distinct
    from the P0--P6 implementation phases in Section 9. Work follows the
    Section 9 phase plan without changing its order or scope.
2.  Complete end-to-end P3 spoken-command acceptance after the target
    browser speech service is reachable; separately verify fresh face-template
    registration with explicit consent before marking P3 fully accepted.
3.  P4 acceptance remains incomplete until live microphone transcription is
    verified; voice-mark proposal, cancellation, save, refresh, and student
    notification have been checked through the typed fallback.
4.  P5 acceptance requires review of the approved formula/data coverage and
    full update-driven end-to-end behavior; current scoring is a documented
    attendance/marks baseline.
5.  P6 acceptance still requires the complete scenario, including the
    outstanding real camera and spoken-attendance checks, and recovery-case
    verification.
6.  Verify fresh face-template registration with an explicitly consenting
    participant; student camera matching and attendance submission have
    already passed live.

## Test Log

| Date | Test / Check | Result | Notes |
|------|--------------|--------|-------|
| 2026-10-02 | Python version checks | Passed via installed interpreter path | Python 3.14.8; pip 26.2.1. The VS Code process PATH did not resolve `python`; the installed interpreter was used explicitly. |
| 2026-10-02 | P0 `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 1 test | FastAPI health endpoint test. |
| 2026-10-02 | P0 `npm test` (frontend) | Passed: 7 tests | Browser capability fallbacks. |
| 2026-10-02 | P0 `npm run build` | Passed with warning | Vite reports face-api chunk is about 1.31 MB. |
| 2026-10-02 | P0 browser camera/model check | Passed | Local detector loaded; live 640x480 stream started and stopped. Detection only. |
| 2026-10-02 | P0 browser speech/manual fallback check | Partial | Recognition failed with `network`; typed fallback worked; no controlled transcript. |
| 2026-10-02 | P1 `.venv` dependency installation and `pip check` | Passed | SQLAlchemy 2.1.2, PyJWT 2.15.1, python-dotenv 1.2.4 added; no broken requirements. |
| 2026-10-02 | `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 9 tests | Health plus roles, access scoping, duplicate/invalid records, demo-login disablement, seed idempotence and database persistence. No warnings. |
| 2026-10-02 | P1 demo seed command | Passed | `.\.venv\Scripts\python.exe -m backend.seed`; rerun preserved 5 users, 2 students, 2 subjects and 2 enrollments. |
| 2026-10-02 | P1 HTTP smoke | Passed | Health HTTP 200; admin sees 2 students / 2 subjects; CS professor sees only `DEMO001` and `CS301`. |
| 2026-10-02 | P1 `npm test` | Passed: 7 tests | Frontend regression suite. |
| 2026-10-02 | P1 `npm run build` | Passed with warning | Existing face-api chunk-size warning remains. |
| 2026-10-02 | P2 initial backend suite | Passed: 17 tests | Includes P1 and P2; short test-only JWT key warnings were corrected by using a key of at least 32 bytes; final run pending. |
| 2026-10-02 | P2 initial frontend suite | Passed: 9 tests | Includes P0 capability fallbacks and professor attendance recording/correction; final run pending. |
| 2026-10-02 | P2 `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 18 tests | Full backend P0-P2 regression suite, including administrator correction and audit. |
| 2026-10-02 | P2 `npm test` | Passed: 10 tests | Full frontend suite, including demo sign-in and attendance workspace flows. |
| 2026-10-02 | P2 `npm run build` | Passed with warning | Production build succeeds; existing face-api chunk-size warning remains. |
| 2026-10-02 | P2 `pip check`, `compileall`, `git diff --check` | Passed | No broken requirements, Python compilation errors or whitespace errors. |
| 2026-10-02 | P2 live HTTP and browser smoke | Passed | Created/marked/corrected session; summary and audit verified; duplicate returned 409; student scope and professor denial verified; professor UI displayed live summary. |
| 2026-10-02 | P2 SQLite restart persistence | Passed | Attendance session, corrected 100% summary and administrator audit event survived backend restart. |
| 2026-10-02 | P3 `.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt` | Passed | Added cryptography 49.0.0 for AES-GCM descriptor encryption; `pip check` reports no broken requirements. |
| 2026-10-02 | P3 `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 24 tests | Includes encrypted template registration, consent, class/role scoping, proposal-only match, unknown/ambiguous rejection and deletion. Match API tests use fabricated numeric vectors, not biometric images. |
| 2026-10-02 | P3 `npm test` | Passed: 19 tests | Includes exact voice parsing, typed/speech proposal confirmation, consent-gated face UI, unsupported camera fallback and student template removal. |
| 2026-10-02 | P3 `npm run build` | Passed with warning | Production build succeeds; face-api chunk remains about 1.31 MB. |
| 2026-10-02 | P3 live HTTP/browser smoke | Partial | Health returned 200 after restart; synthetic descriptor enrollment/proposal/removal passed; local recognition models loaded; professor typed-command review/confirmation reached the live API. No real face capture or spoken phrase was tested. |
| 2026-10-02 | UI polish `npm test` | Passed: 21 tests | All 10 frontend test files pass, including administrator record form/API tests. |
| 2026-10-02 | UI polish `npm run build` | Passed with warning | Vite production build succeeds; face-api chunk remains about 1.31 MB. |
| 2026-10-02 | UI polish browser review | Passed, limited | Student, professor and administrator workspaces rendered at 920px and 390px; mobile navigation/sign-out and nested table scrolling checked. No page-level horizontal overflow. Face/voice panels were viewed after selecting an existing session; no camera or speech capture was attempted. |
| 2026-10-02 | UI polish `git diff --check` | Passed | No whitespace errors. |
| 2026-10-02 | Final backend `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 29 tests | Adds assessment/mark validation, authorization, notification privacy/read, update audit and risk formula tests; includes P0-P3 regression. |
| 2026-10-02 | Final frontend `npm test` | Passed: 24 tests | 11 test files, including student academic views, professor mark submission/update confirmation and audit history. |
| 2026-10-02 | Final frontend `npm run build` | Passed with warning | Production build succeeds; existing face-api chunk is about 1.31 MB. |
| 2026-10-02 | Final backend compilation and `git diff --check` | Passed | `python -m compileall backend`; no whitespace errors (Git notes existing CRLF conversion for status file). |
| 2026-10-02 | Live academic workflow/browser | Passed for tested flow | Created fictional assessment; saved 35/40 then confirmed update to 36/40 for DEMO001; professor saw audit history; student saw 90%, risk explanation and create/update notifications. No P3 device capture/transcription performed. |
| 2026-10-02 | Responsive browser check | Passed for sampled screens | Admin overview inspected at desktop; student and professor views at 390px showed no document-level horizontal overflow. |
| 2026-10-02 | Final backend restart, health and OpenAPI routes | Passed | `/api/health` returned `ok`; academic overview and mark-audit routes are registered. Initial route-check script used an unsupported `ContainsKey` call on deserialized PowerShell JSON; corrected property-name check passed. |
| 2026-10-02 | Voice marks and consent/risk changes: `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 30 tests | Added risk recommendation checks; uses existing API/model and fictional demo data. |
| 2026-10-02 | Voice marks and consent/risk changes: frontend `npm test` | Passed: 35 tests | 12 files; parser cases, mocked Web Speech result, pre-confirmation no-write, cancel, unsupported speech fallback, API failure, and camera consent gate covered. |
| 2026-10-02 | Voice marks and consent/risk changes: `npm run build` | Passed with warning | Existing 1,314.44 kB face-api chunk warning. |
| 2026-10-02 | Voice marks and consent/risk changes: `.\.venv\Scripts\python.exe -m compileall backend`; `git diff --check` | Passed | No Python compilation or whitespace errors; Git reported existing LF-to-CRLF normalization notice for `docs/PROJECT_STATUS.md`. |
| 2026-10-02 | Live typed voice-mark browser flow | Passed for typed fallback | Reviewed and confirmed fictional DEMO001, 18/40; professor overview refreshed; student view showed the mark and its notification. Web Speech microphone transcription and real camera matching were not attempted/verified. |
| 2026-10-02 | Updated live backend health and risk recommendation | Passed | Restarted project Uvicorn process without changing the database; `/api/health` returned `{"status":"ok"}` and student browser showed current-data recommendation for 45.0% recorded assessment average. |
| 2026-10-02 | Student active-session flow: `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 35 tests | Includes session lifecycle/backfill migration, student self-only present recording, duplicate/ended rejection, and face-match student scoping. |
| 2026-10-02 | Student active-session flow: frontend `npm test` | Passed: 41 tests | Includes API-backed session discovery, no-session empty state, no automatic camera access, mock face verification/confirmation, camera denial, unknown face, already-recorded state, and professor end-session UI. |
| 2026-10-02 | Student active-session flow: `npm run build` | Passed with warning | Existing 1,314.44 kB face-api chunk warning. |
| 2026-10-02 | Student active-session flow: `.\.venv\Scripts\python.exe -m compileall backend`; `git diff --check` | Passed | No Python compilation or whitespace errors; Git reported existing LF-to-CRLF normalization notice for `docs/PROJECT_STATUS.md`. Live webcam matching remains unverified. |
| 2026-10-02 | Live SQLite lifecycle migration and student session-list smoke | Passed | Restarted the local backend; health returned `ok`. Existing seven class sessions were preserved and now report ended; the prior present record remains visible in the student's own session status. |
| 2026-10-02 | Expanded seed idempotency and data-shape tests | Passed: 2 focused tests | Clean database produced 30 students, six professors, eight subjects, 120 enrollments, 64 sessions, 960 attendance records, 32 assessments, 480 marks, and event-linked notifications; rerun preserved counts. |
| 2026-10-02 | Configured database seed rerun | Passed | Seed ran twice; totals remained 39 users, 32 students, 10 subjects, 121 enrollments, 73 sessions, 961 attendance records, 33 assessments, 481 marks, and 240 notifications. Pre-existing unrelated rows were retained. |
| 2026-10-02 | Full backend `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 37 tests | Covers seed counts/idempotency, role scoping, active-session enrollment visibility and existing P0–P4 API behavior. |
| 2026-10-02 | Frontend `npm test` | Passed: 41 tests | 13 test files. |
| 2026-10-02 | Frontend `npm run build` | Passed with warning | Existing face-api bundle is 1,314.44 kB, above Vite's 500 kB advisory threshold. |
| 2026-10-02 | Backend `.\.venv\Scripts\python.exe -m compileall backend` and `git diff --check` | Passed | Python compilation passed; Git only reported its existing LF-to-CRLF advisory for `docs/PROJECT_STATUS.md`. |
| 2026-10-02 | Browser demo-account review | Passed for sampled dashboards | Admin showed 32 students/10 subjects; `professor.cs` and `professor.math` showed their permitted subjects/rosters; `student.001`–`.003` showed different schedules, attendance, marks/risk/notifications. Existing active CS301 session appeared for enrolled student.001 and not student.002, who is not enrolled in CS301. |
| 2026-10-03 | Professor face roster/model diagnosis | Passed for current data and local models | Session 75 / CS301 returned 14 enrolled account-backed roster entries and 14 `registered=false` statuses; the professor was authorized. Fresh login initially had no selected session. After auto-selecting the latest active session, the browser showed all 14 students; **Check recognition models** loaded all local models. No real descriptor registration or camera match was performed. |
| 2026-10-03 | Targeted frontend professor-face flow regression | Passed: 5 tests | Confirms active session selection, roster visibility when template is absent, and existing attendance workspace behavior. |
| 2026-10-03 | Full backend `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 37 tests | Existing API, permissions, seed, and synthetic face-match coverage. |
| 2026-10-03 | Full frontend `npm test` | Passed: 42 tests | 13 test files, including fresh-login session selection and unregistered-student listing. |
| 2026-10-03 | Frontend `npm run build` | Passed with warning | Face-api chunk remains 1,314.44 kB; Vite advisory threshold is 500 kB. |
| 2026-10-03 | Backend `.\.venv\Scripts\python.exe -m compileall backend`; `git diff --check` | Passed | Python compilation succeeded; Git reported its existing LF-to-CRLF advisory for `docs/PROJECT_STATUS.md`. |
| 2026-10-03 | Local face-template encryption configuration | Passed | Generated a cryptographically random 64-byte `FACE_TEMPLATE_ENCRYPTION_KEY` in ignored root `.env`; restarted Uvicorn. Live professor API returned 14 template statuses without an encryption configuration error. |
| 2026-10-03 | Face-template registration API check | Passed, synthetic descriptor only | Consent-confirmed 128-value descriptor was encrypted and registered through the existing PUT route against a disposable seeded SQLite database, then deleted there. No real participant face was captured or saved. |
| 2026-10-03 | Manual attendance browser flow | Passed | `runAction` refreshed data with the default full-page loading state after saving, replacing the visible workspace and appearing to redirect. It now refreshes with `showLoading: false`. `professor.cs` marked fictional STU006 present in active session 76; the route stayed `#manual-attendance`, success feedback and updated row appeared without full-page loading, and after re-login the status remained present. |
| 2026-10-03 | Backend `.\.venv\Scripts\python.exe -m pytest backend\tests` | Passed: 37 tests | Full P0–P4 backend suite. |
| 2026-10-03 | Frontend `npm test` | Passed: 43 tests | 13 test files. Added regression for retaining the selected attendance session and workspace after marking present. |
| 2026-10-03 | Frontend `npm run build` | Passed with warning | Face-api chunk remains 1,314.44 kB, above Vite's 500 kB advisory threshold. |
| 2026-10-03 | Backend `.\.venv\Scripts\python.exe -m compileall backend`; `git diff --check` | Passed | Python compilation succeeded; Git only reported its existing LF-to-CRLF advisory for the status document. |
| 2026-10-03 | Restrained frontend visual refresh: frontend `npm test` | Passed: 46 tests | 14 test files. |
| 2026-10-03 | Restrained frontend visual refresh: frontend `npm run build` | Passed with warning | Existing face-api chunk is 1,314.44 kB, above Vite's 500 kB advisory threshold. |
| 2026-10-03 | Restrained frontend visual refresh: role-workspace browser checks | Passed for sampled widths | Student, professor and administrator workspaces at 390, 768, 1024 and 1440 px; no document-level horizontal overflow. |
| 2026-10-03 | Restrained frontend visual refresh: `git diff --check` | Passed | No whitespace errors. |
| 2026-10-03 | Role workspace refinement: frontend `npm test` | Passed: 46 tests | 14 test files. |
| 2026-10-03 | Role workspace refinement: frontend `npm run build` | Passed with warning | Existing face-api chunk is 1,314.44 kB, above Vite's 500 kB advisory threshold. |
| 2026-10-03 | Role workspace refinement: browser review | Passed for sampled widths | Student, professor and administrator workspaces at 390, 768 and 1440 px; no document-level horizontal overflow. Professor session roster, face/voice and mark-entry panels, and administrator management/academic tables were present. No camera or microphone was activated. |
| 2026-10-03 | Role workspace refinement: `git diff --check` | Passed | No whitespace errors. |
| 2026-10-03 | Voice recognition focused frontend tests | Passed: 7 tests | Covers short-command configuration, error-specific messages for network, microphone permission/device and no-speech, typed-fallback focus, and unsupported browser state. |
| 2026-10-03 | Voice recognition frontend `npm test` | Passed: 60 tests across 16 files | Full frontend regression suite. |
| 2026-10-03 | Voice recognition frontend `npm run build` | Passed with warning | Existing face-api chunk is 1,314.44 kB, above Vite's 500 kB advisory threshold. |
| 2026-10-03 | Live Web Speech retry and typed fallback | Partial | VS Code Chromium returned `network` before transcript with microphone permission `granted`; the updated UI clearly reported browser-service failure and no offline transcription. Typed command parsed STU001 as Aarav Rao and previewed present; review alone caused no API request. |
| 2026-10-03 | Voice recognition `git diff --check` | Passed | No whitespace errors. |

## Decisions and Changes Log

  -----------------------------------------------------------------------
  Date                    Decision / Change       Approval
  ----------------------- ----------------------- -----------------------
  2026-10-02              Initial blueprint and   Owner approval to begin
                            P0--P6 phase plan
                            drafted
  2026-10-02              P0 implementation       Owner: "start"; P0 only
                            started
  2026-10-02              P0 foundation           Owner authorized P0;
                            completed              acceptance checks
                                                   recorded above
  2026-10-02              P1 demo login           Owner selected clearly
                            selected                labelled demo login
  2026-10-02              P1 database/API/roles   P1 foundation checks
                            implemented            recorded; attendance
                                                   authorization checked in P2;
                                                   marks authorization planned for P4
  2026-10-02              P2 attendance           Owner authorized next
                            completed              phase; acceptance checks
                                                   recorded above
  2026-10-02              P3 face and voice       Owner approved P3 after
                            started                P2 completion

  -----------------------------------------------------------------------

## Next Actions

1.  Verify the fresh face-template registration flow without overwriting
    the existing STU001 template; retry spoken attendance in a browser/network
    where the browser Web Speech service is reachable.
2.  Verify live microphone speech-to-text for voice-assisted marks in the
    target browser before marking P4 accepted.
3.  Confirm the P5 scoring formula/data coverage and complete the full
    end-to-end scenario; current results remain rule-based and partial.

### Interactive academic analytics dashboards (2026-10-03)

-   Added Student, Professor and Administrator dashboards using existing
    role-scoped APIs and returned academic records. Visual transformations
    calculate attendance trends/distributions, assessment results,
    course-level attendance, risk summaries and recent activity; no chart
    values are fabricated. The existing teal/navy palette and workflows
    remain unchanged.
-   Student dashboard shows overall attendance, risk, enrolled subjects and
    recent activity, with subject and session-range filters for attendance,
    subject comparison, assessment performance, and a rule-based risk
    explanation/recommendation. Professor dashboard supports assigned-course
    and session-range selection, per-student attendance, attendance
    distribution, session trends, assessment averages and an attention
    table. Administrator dashboard shows institution-level risk/course/
    attendance summaries, a date-filtered activity trend, and recent
    session/mark activity.
-   Existing data/API limitations are surfaced: administrator professor
    counts represent professors in session history; activity trends can use
    session start dates and current mark-record update dates only; the
    current API does not expose administrator notifications or global
    attendance-record audit history. The risk display remains explicitly
    rule-based.
-   Live browser review: Student showed 92% overall attendance, Low risk,
    three enrolled subjects and three recent activities; selecting CS304
    updated the attendance trend, marks and risk detail. Latest-5 filtering
    changed the trend from nine to five points. Professor CS301 showed 14
    student bars, three distribution groups, nine session points, four
    assessment bars and 11 attention rows; selecting CS305 showed 16
    students and a five-session trend. Administrator showed three risk
    groups, eight course bars, three attendance-status groups, a dated
    activity trend and an eight-item recent feed; the seven-day activity
    filter narrowed the trend to two recorded points.
-   Student, Professor and Administrator dashboards were checked at 390,
    768 and 1440 px with no document-level horizontal overflow. Existing
    assessment/workspace and analytics tests cover chart transformations,
    controls, rendered role data and empty states.
-   Verification: backend `pytest backend\tests` passed (38 tests);
    frontend `npm test` passed (55 tests across 16 files); frontend
    `npm run build` passed with the existing 1,314.44 kB face-api chunk-size
    advisory; backend `compileall` and `git diff --check` passed. No
    backend/API, schema, authentication or business-logic changes were made.

### Live face and voice attendance acceptance check (2026-10-03)

-   Used the existing active CS301 session 66 and fictional student STU001.
    The professor face panel reported that an encrypted STU001 template was
    already registered, so no new template was created, replaced or deleted.
    Local detector, landmark and recognition models loaded; camera consent
    was confirmed and the browser provided a 640x480 stream.
-   Professor-wide face matching first returned the expected safe ambiguous
    result, with Aarav Rao (STU001) at distance 0.2574 and Rhea Mukherjee
    (STU024) at 0.2671; no attendance was recorded by that proposal. In the
    student self-verification flow, the initial attempt reported “No face was
    detected.” After the consenting participant centered their face, the
    UI verified Aarav Rao (STU001), requested confirmation, and saved present
    attendance. The student dashboard showed 24 of 26 sessions attended and
    the session-66 status as present.
-   Two live spoken attendance attempts (present and absent) started
    listening but both ended with the exact error “Speech recognition failed
    (network). Type a command instead.” No speech transcript was produced.
    The browser speech service failed before command parsing/matching; typed
    fallback remains available.
-   Isolated the remaining voice stages through that documented fallback:
    “Mark STU001 present” resolved to Aarav Rao (STU001), proposed present,
    and confirmation submitted to the attendance records API. “Mark STU001
    absent” resolved and saved through the same confirmation flow; the
    professor roster then showed STU001 absent in session 66. This validates
    typed parsing, student resolution, confirmation, API update and roster
    refresh, but is not a pass for live speech transcription.
-   No source code or backend changes were needed or made, and tests were not
    rerun because no fix was applied. `STU001` is currently marked absent in
    active session 66 as the final requested voice-fallback test state. No
    commit or push was made.

### Browser speech recognition network diagnosis and fallback (2026-10-03)

-   The current attendance implementation uses the browser Web Speech API:
    `window.SpeechRecognition` with `webkitSpeechRecognition` as the
    compatibility fallback. The active target was VS Code's Electron
    Chromium (Chrome 150). Both API constructors were present; the page is a
    secure localhost context; `navigator.permissions.query({name:
    "microphone"})` returned `granted`.
-   Recognition was configured with `lang = "en-US"`,
    `interimResults = false`, and `maxAlternatives = 1`; this is a suitable
    short-command configuration and was retained. The `network` error is
    emitted by the browser SpeechRecognition service before `onresult`; no
    application backend request or transcript occurs at that point. The
    Web Speech API does not guarantee local/offline recognition, and this
    application does not contain an offline speech engine. Changing parser,
    attendance APIs or language settings cannot repair an unavailable
    browser speech service.
-   Improved only recognition error handling and fallback presentation:
    unsupported browser, microphone permission/service restriction, missing
    audio input, network/service failure, unsupported language, and no-speech
    now have distinct user messages. The network message explicitly states
    that offline transcription is not provided. Failures expose a prominent
    **VOICE RECOGNITION UNAVAILABLE** (or cause-specific) notice and a
    **Type command** button; typed parsing and the reviewed attendance API
    path are unchanged. Stale events after stopping recognition are ignored.
-   The pre-change live checks had separate present/absent starts, both
    returning `Speech recognition failed (network)` before a transcript.
    After the UI update, another live start returned the same browser error
    before speech could be transcribed. Live transcription therefore remains
    unavailable in this browser/network.
-   A fully local replacement would require bundling/downloading an offline
    speech model and adding a client-side inference runtime, model lifecycle,
    device performance/memory checks, and language/accuracy testing. That is
    not a small reliable patch for this prototype, so no offline engine or
    large model was added.
-   Verification after the UI fallback change: focused voice tests passed
    (7 tests), full frontend suite passed (60 tests across 16 files), the
    production build passed with the existing 1,314.44 kB face-api chunk
    warning, and `git diff --check` passed. A live retry still returned
    `network` before transcript. The visible typed fallback resolved STU001
    to Aarav Rao and previewed “present”; previewing did not call the API.
    The error banner and input were checked at 390, 768 and 1440 px without
    document-level horizontal overflow.
    Previous live testing had confirmed typed present/absent through the
    attendance API. No backend, database, authentication, parser or
    attendance logic was changed; no commit or push was made.
