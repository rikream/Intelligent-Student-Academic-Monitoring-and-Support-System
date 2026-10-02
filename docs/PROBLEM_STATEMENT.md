# Problem Statement and Approved Project Plan

**Project:** Intelligent Student Academic Monitoring and Support System\
**Document version:** 1.0\
**Status:** Draft for owner review; treat decisions as approved only
after explicit owner approval.

## 1. Problem Statement

Student academic information can be spread across attendance records,
assessment marks, assignment results and separate communication
channels. Students may not notice attendance concerns early, professors
may spend time maintaining records manually, and administrators may
struggle to identify subjects where students need support.

Manual attendance and marks entry can also introduce delays and
recording errors. The proposed system organizes academic information,
offers multiple attendance-entry methods, notifies students about
important updates and provides explainable subject-level academic risk
insights.

## 2. Proposed Solution

Build a web-based prototype with: - Student, professor and administrator
interfaces. - Student and subject management. - Manual attendance. -
Face-based attendance with professor review and manual correction. -
Professor-operated voice-command attendance using student names or roll
numbers. - Subject-wise attendance percentages and alerts around the 75%
threshold. - Marks entry and voice-assisted marks entry. - In-app
notifications when marks are created or updated. - Explainable,
subject-wise academic risk analysis. - Academic dashboards, charts and
filters. - A shared backend and database.

## 3. Target Users

-   **Students:** View their attendance, marks, notifications, risk
    explanations and recommendations.
-   **Professors:** Manage attendance, enter marks and review academic
    progress for their permitted classes.
-   **Administrators:** Manage student/subject records and inspect
    aggregate academic insights.

## 4. Scope and Priorities

### P0 --- Required prototype features

1.  Student and subject records.
2.  Student, professor and administrator interfaces with
    backend-enforced permissions.
3.  Manual attendance and face-based attendance.
4.  Professor voice-command attendance.
5.  Attendance calculations and alerts around the 75% threshold.
6.  Marks entry and voice-assisted marks entry.
7.  In-app notifications for marks updates.
8.  Subject-wise risk analysis with explanations.
9.  Academic dashboards and basic charts.
10. Shared database, fictional demo data and automated tests for core
    logic.

### P1 --- Add only after P0 works

-   Basic liveness checks for face attendance.
-   Attendance trend charts and estimates of classes needed to recover
    attendance.
-   Downloadable attendance/risk reports.
-   More advanced recommendations.
-   Additional dashboard filters and visual polish.

### Out of scope for the initial hackathon

-   Live college ERP/student information system integration.
-   A mobile app or hardware biometric devices.
-   Automated disciplinary decisions based on risk scores.
-   Claims of production-grade biometric security or guaranteed identity
    verification.
-   Training a complex predictive model without suitable data.
-   Email/SMS delivery requiring external services.
-   Speaker identity verification for voice attendance.

## 5. Functional Requirements

### FR-1: Student and Subject Management

-   Store student identity fields such as roll number, name, department
    and semester.
-   Manage subjects and student-subject enrollments.
-   Prevent duplicate roll numbers and invalid enrollments.
-   Expose only data permitted by the user's role.

### FR-2: Roles and Permissions

-   Support student, professor and administrator roles.
-   Enforce authorization in the backend for every protected operation.
-   Students may view only their own private academic records.
-   Professors may act only on permitted class/subject records.
-   Administrators may manage approved student and subject records.

### FR-3: Manual Attendance

-   Create a class session for a subject.
-   Record present/absent status for enrolled students.
-   Allow authorized corrections and retain an audit event.
-   Prevent duplicate records for the same student and class session.

### FR-4: Face-Based Attendance

-   Register and remove a student's face template with consent.
-   Use the live camera to detect a face and generate a descriptor using
    a compatible library/model.
-   Compare descriptors against registered profiles for the current
    class.
-   Present proposed matches and confidence information for professor
    review.
-   Unknown or ambiguous matches must not be silently saved.
-   Require review/confirmation before attendance is finalized.
-   Keep manual attendance available when recognition fails.
-   Store face descriptors/templates securely; prefer not to retain raw
    photos where practical.
-   Basic liveness detection is P1 unless explicitly promoted to a
    required feature.

**Limitation:** Face matching is not proof of identity. The prototype
must not claim guaranteed anti-spoofing or production-grade biometric
verification.

### FR-5: Voice-Command Attendance

-   Let the professor speak a student name or roll number and an
    attendance command.
-   Convert speech to text using browser speech recognition where
    supported.
-   Resolve the command to an enrolled student and display the proposed
    action.
-   Ask for confirmation; ambiguous or unmatched commands must not
    create a record.
-   Use the same backend attendance validation and persistence as manual
    attendance.
-   Provide a typed/manual fallback when voice recognition is
    unavailable.

**Boundary:** This feature recognizes professor-spoken commands; it does
not identify students by their unique voice.

### FR-6: Attendance Monitoring

-   Calculate subject-wise attendance percentage from stored sessions
    and records.
-   Configure warnings as attendance approaches the 75% requirement,
    with an initial warning example at 80%.
-   Alert when attendance falls below 75%.
-   Show history and explain the calculation.
-   Calculate classes needed to recover attendance only when the
    calculation's assumptions are clear and mathematically valid.

### FR-7: Marks Management and Voice-Assisted Entry

-   Create assessments with a maximum mark value and relevant subject.
-   Allow authorized professors to create and update marks.
-   Validate scores against the assessment's allowed range.
-   Convert professor speech into editable text and extract student,
    subject, assessment and score.
-   Require review and confirmation before saving extracted values.
-   Do not silently save ambiguous or low-confidence speech.
-   Use the same marks record for manual and voice-assisted entry.
-   Retain a basic audit history of changes.

### FR-8: Notifications

-   Create an in-app notification when marks are entered or updated.
-   Show the subject, assessment and relevant mark information permitted
    for that student.
-   Track read/unread state and notification history.
-   Do not claim email or SMS delivery in the initial scope.

### FR-9: Academic Risk Analysis

-   Evaluate attendance, assessment marks, assignment performance and
    previous academic performance where available.
-   Use a documented and testable scoring formula.
-   Classify risk as Low, Medium or High.
-   Explain the contributing factors and provide practical suggestions.
-   Recalculate when relevant academic data changes.
-   Handle missing data explicitly; do not silently treat missing values
    as zero.
-   Label this as a rule-based estimate unless a separately approved,
    trained and evaluated ML model is implemented.

### FR-10: Insights and Dashboards

-   Student view: own attendance, marks, notifications and risk
    explanations.
-   Professor view: permitted classes, attendance, marks and academic
    summaries.
-   Administrator view: student/subject management and aggregate risk
    insights.
-   Include basic charts and useful filters after core workflows work.

## 6. Non-Functional Requirements

-   The prototype should run locally using documented commands.
-   Use fictional demo records by default.
-   Keep configuration/secrets outside source control.
-   Validate inputs on the backend.
-   Protect private academic and biometric data.
-   Handle API errors, empty data, unsupported browser capabilities and
    denied device permissions.
-   Provide automated tests for calculations, validation, permissions
    and important integration paths.
-   Prefer clear, maintainable code over unnecessary abstraction.

## 7. Proposed Technology Stack

-   Frontend: React + Vite.
-   Styling: Tailwind CSS.
-   Charts: Recharts.
-   Backend: Python + FastAPI.
-   ORM/database: SQLAlchemy + SQLite.
-   Testing: Pytest for backend; Vitest for frontend logic/components.
-   Face recognition: evaluate a compatible browser-side face
    detection/recognition library, such as `@vladmandic/face-api`, and
    locally hosted model files in Phase P0.
-   Speech: browser Web Speech API where supported, with manual
    fallback.
-   Version control: Git.

Exact dependency versions and the final face-recognition implementation
must be verified in P0 before they are treated as fixed. Core
functionality must not depend on a paid API.

## 8. Architecture and Data Entities

The frontend calls a FastAPI backend. The backend owns authorization,
validation, business rules and persistence. A shared SQLite database
supports all interfaces.

Required conceptual entities: - `User` - `Student` - `Subject` -
`Enrollment` - `FaceTemplate` - `ClassSession` - `AttendanceRecord` -
`Assessment` - `MarkRecord` - `Notification` - `RiskAssessment` -
`AuditEvent`

Implementation may combine or split entities if the resulting schema
preserves the required concepts and behavior. Attendance must have a
uniqueness constraint for each student/session pair.

## 9. Approved Phase Plan

Keep these phase IDs, sequence, scope and acceptance criteria consistent
across all agents and documents. Tasks may be marked complete, but the
plan must not be silently rewritten.

### P0 --- Project Foundation

**Planned time:** 45 minutes\
**Dependencies:** None.

**Objective:** Establish the repository structure, development commands
and validate risky browser/device dependencies early.

**Tasks:** - Inspect the repository and preserve existing working
setup. - Establish frontend/backend structure, configuration and API
conventions. - Create dependency manifests, `.gitignore`, `.env.example`
and README. - Verify face library/model loading and webcam flow in the
target browser. - Verify speech recognition support and manual
fallback. - Add a basic health/test endpoint and test commands.

**Deliverables:** Runnable skeleton, manifests and setup documentation.

**Acceptance criteria:** - Frontend and backend start using documented
commands. - Health endpoint responds. - Webcam permission and model
loading have been tested. - Speech capability and fallback have been
tested. - No real student or biometric data is used during setup.

### P1 --- Database, API and Roles

**Planned time:** 2 hours\
**Dependencies:** P0.

**Objective:** Create the shared persistence and access-control
foundation.

**Tasks:** - Define database models and initialization/migration
strategy. - Implement authentication or a clearly isolated demo-login
mechanism. - Implement backend authorization for student, professor and
administrator roles. - Add student, subject and enrollment APIs. - Seed
fictional demo records.

**Deliverables:** Schema, seed script, APIs and role-specific access.

**Acceptance criteria:** - Data persists across backend restarts. -
Unauthorized attendance/marks operations are rejected. - Professors are
restricted to permitted class data. - Administrators can manage approved
records. - Duplicate roll numbers and invalid enrollments are rejected.

### P2 --- Attendance Foundation

**Planned time:** 2 hours\
**Dependencies:** P1.

**Objective:** Implement accurate attendance logic before recognition.

**Tasks:** - Create class sessions and manual attendance entry. - Store
status and attendance history. - Calculate subject-wise percentages. -
Add configurable warnings around 75%. - Enforce unique student/session
attendance.

**Deliverables:** Attendance API, professor entry screen and student
attendance view.

**Acceptance criteria:** - Percentage calculations pass independent test
cases. - Duplicate submissions cannot create duplicate records. -
Corrections recalculate percentages. - Threshold boundaries are
tested. - Corrections create audit events.

### P3 --- Face and Voice Attendance

**Planned time:** 3 hours\
**Dependencies:** P2.

**Objective:** Add both recognition-assisted attendance modes to the
existing workflow.

**Tasks:** - Register/remove face templates. - Capture camera input and
generate descriptors. - Match against registered profiles and propose
matches. - Add professor voice commands for names/roll numbers. - Parse
commands and resolve enrolled students. - Send proposed actions through
the same backend validation used by manual attendance. - Provide review,
correction and submission controls.

**Deliverables:** Face registration/attendance UI, voice attendance UI,
recognition adapters and integration tests.

**Acceptance criteria:** - A registered test student can be proposed for
attendance in face mode. - A spoken name/roll number can become a
proposed attendance action in voice mode. - Unknown faces, unclear
speech and unmatched names do not create records. - Duplicate and
unauthorized submissions are rejected. - Both methods update the same
attendance history and percentage. - Manual attendance works if
recognition fails.

**Boundary:** Face matching proposes identity and does not guarantee it.
Liveness is attempted after basic recognition works; it is not allowed
to block the rest of the project.

### P4 --- Marks and Notifications

**Planned time:** 2.5 hours\
**Dependencies:** P1.

**Objective:** Implement validated marks entry and in-app updates.

**Tasks:** - Create assessments and maximum-mark validation. - Add
manual marks creation/update. - Implement speech-to-text marks entry. -
Extract student, subject, assessment and score. - Require confirmation
before saving. - Notify students when marks are created or updated. -
Keep a basic audit history.

**Deliverables:** Marks UI/API, voice entry, notifications and tests.

**Acceptance criteria:** - Invalid marks and unauthorized changes are
rejected. - Unclear speech is not silently saved. - Voice and manual
entry update the same mark record. - Students see only their own
permitted marks and notifications. - Updating marks creates an
appropriate notification.

### P5 --- Risk Analysis and Insights

**Planned time:** 2 hours\
**Dependencies:** P2 and P4.

**Objective:** Provide explainable subject-level academic insights.

**Tasks:** - Define a documented scoring formula using attendance,
marks, assignments and prior performance where available. - Calculate
Low/Medium/High risk. - Display contributing factors and
recommendations. - Recalculate when relevant records change. - Build
basic dashboard charts and filters.

**Deliverables:** Risk service, explanations, charts and tests.

**Acceptance criteria:** - Test cases match expected
scores/categories. - Every flagged subject has a data-grounded
explanation. - Relevant updates recalculate risk. - Missing data is
handled explicitly. - UI labels the result as a rule-based risk estimate
unless an approved ML model is actually trained and evaluated.

### P6 --- Integration, Testing and Demo

**Planned time:** 3 hours\
**Dependencies:** P1--P5.

**Objective:** Verify the complete application and prepare a
reproducible demonstration.

**Tasks:** - Connect the three role-specific dashboards. - Run
end-to-end tests for attendance, marks, notifications and risk
updates. - Fix integration defects and verify permissions. - Add
loading/error/empty/unsupported-browser states. - Prepare fictional demo
data and walkthrough. - Update setup documentation and project status.

**Deliverables:** Integrated prototype, test results, demo instructions
and updated documentation.

**Acceptance criteria:** - Main workflows operate from UI through API to
database. - Professor can record attendance and enter marks. - Student
sees updated attendance, marks and notifications. - Risk dashboard
reflects stored academic data. - Recognition failure does not corrupt
attendance. - Clean setup succeeds by following the README.

**Planned implementation total:** 15 hours 15 minutes, leaving about 8
hours 45 minutes of a 24-hour hackathon for integration surprises,
debugging, breaks and presentation. The timing is a target, not a
guarantee.

## 10. Required End-to-End Scenario

1.  Administrator creates a fictional student and enrolls them in a
    subject.
2.  Professor starts a class attendance session.
3.  Professor uses face or voice mode to propose attendance.
4.  Professor reviews and confirms attendance.
5.  Student view shows the updated attendance percentage.
6.  Professor enters an assessment mark manually or by voice.
7.  Student receives an in-app notification.
8.  Risk analysis reflects the updated academic data.
9.  Administrator sees the relevant subject-level insight.
10. Duplicate or unauthorized operations are rejected.

## 11. Risks and Mitigations

-   **Face library/model incompatibility:** validate in P0; use an
    adapter and documented fallback.
-   **Photo spoofing:** add basic liveness if feasible; never claim
    guaranteed anti-spoofing.
-   **Ambiguous names/noisy speech:** prefer roll numbers, show parsed
    commands and require confirmation.
-   **Unsupported speech recognition:** display clear status and provide
    manual fallback.
-   **Camera/microphone denial:** preserve manual attendance.
-   **Duplicate records:** enforce database constraints and safe repeat
    behavior.
-   **Misleading risk scores:** document formula and explain
    contributing factors.
-   **Data exposure:** enforce backend authorization and use fictional
    demo data.
-   **Conflicting agent changes:** preserve phase IDs, API contracts and
    repository instructions.
-   **Time overruns:** prioritize connected end-to-end functionality
    over optional polish.

## 12. Verification Strategy

-   Unit tests: percentages, threshold boundaries, marks validation,
    risk formula.
-   API tests: valid/invalid requests, roles, database constraints.
-   Frontend tests: forms, validation, notifications and role-specific
    views.
-   Integration tests: UI actions persist correctly and refresh
    dependent views.
-   Recognition tests: known/unknown faces, ambiguous names, unclear
    speech and duplicate attempts.
-   Privacy checks: users cannot access other students' private records
    or biometric templates.
-   Recovery checks: unsupported browser, denied device permissions,
    backend failure and empty datasets.
-   End-to-end test: execute the scenario in Section 10.

## 13. Decisions Requiring Owner Approval

-   Confirm the proposed stack and feature scope.
-   Confirm whether real role-based login is required from the start or
    a clearly labelled demo-login mechanism is acceptable.
-   Confirm face recognition with professor review and manual fallback;
    liveness remains an enhancement unless promoted to required scope.
-   Confirm that voice attendance means professor-spoken names/roll
    numbers, not speaker identity verification.
-   Confirm the risk model begins as transparent scoring.
-   Any scope or stack change must be recorded and explicitly approved
    before implementation.
