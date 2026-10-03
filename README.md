# Intelligent Student Academic Monitoring and Support System

Local academic monitoring prototype with student, professor, and
administrator demo accounts; role-scoped records; SQLite persistence; manual
attendance; professor-reviewed face/voice attendance proposals; manual
assessment and voice-assisted marks workflows; student notifications; and explainable,
rule-based subject risk estimates. Live student face matching and attendance
confirmation have been verified; fresh face-template registration and spoken
attendance remain pending. In the target VS Code Chromium browser, Web Speech
recognition currently returns a browser `network` error; typed commands remain
available. This is not production authentication or a production biometric
system.

## Interface

The responsive interface provides role-specific student, professor, and
administrator workspaces. Dashboards use API-backed attendance, marks,
notification, and risk data. Professors can create assessments and save or
update marks for enrolled students; students can view only their own results,
notifications, and subject risk explanations. Administrators can inspect
aggregate insights and manage student, subject, and enrollment records. The
styles use the repository's existing CSS setup; no UI or chart dependencies
were added. Professor-account and subject-assignment management are not
available because the current API does not provide those operations.

## Requirements

- Node.js 22.12 or later and npm.
- Python 3.10 or later with pip (required for the FastAPI health service).
- A modern browser. Camera access requires localhost or HTTPS.

## Run locally

Copy `.env.example` to `.env` if you need to change the frontend API base URL.
For stable signed demo tokens across backend restarts, set `APP_SECRET_KEY`
to a private random value in `.env`. The development fallback generates an
ephemeral secret per process; existing tokens expire after one hour and will
not survive a backend restart when using that fallback.

Face-template enrollment requires a separate persistent
`FACE_TEMPLATE_ENCRYPTION_KEY` containing at least 32 bytes. Generate a
random value with `python -c "import secrets; print(secrets.token_urlsafe(48))"`
and put it in the local, git-ignored `.env` file. The API encrypts 128-number
face descriptors with AES-GCM before SQLite storage. Without this key,
template registration and matching existing templates return HTTP 503. Keep
the key private and do not change it after templates have been registered,
or those templates cannot be decrypted. Students can inspect and delete their
own stored template.

In PowerShell, create the backend environment and install its dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If `python` is not recognized after installing Python on Windows, open a new
terminal so it picks up the updated PATH. Python 3.14.8 and pip 26.2.1 were
verified for this project foundation.

Create the fictional demo accounts/records (safe to run repeatedly):

```powershell
.\.venv\Scripts\python.exe -m backend.seed
```

The repeatable fictional seed provides `admin.demo`, six professor accounts,
and `student.001` through `student.030` (roll numbers `STU001` through
`STU030`). Professor usernames retain `professor.cs` and `professor.math` for
compatibility; the additional accounts are `professor.kavya.iyer`,
`professor.rahul.menon`, `professor.neha.sharma`, and
`professor.vikram.nair`. Demo login accepts only an existing seeded username
and does not use passwords; it is deliberately limited to local fictional
data and is not production authentication. Set `DEMO_LOGIN_ENABLED=false` to
disable it.
The six accounts represent fictional professors Dr. Ananya Rao
(`professor.cs`), Prof. Arjun Mehta (`professor.math`), Dr. Kavya Iyer,
Prof. Rahul Menon, Dr. Neha Sharma, and Prof. Vikram Nair. The current user
schema stores professor usernames rather than display names, so the older
account names remain visible in the interface.

On a clean database, the seed creates 30 students, 6 professors, 8 CSE
subjects, 120 varied enrollments, 64 ended historical attendance sessions,
960 attendance records, 32 assessments, 480 marks, and event-linked student
notifications (220 on a clean database). The student schedules contain 3–5
courses each. Rerunning the
seed adds only missing demo records and preserves existing attendance,
academic records, and notifications. On an existing database, legacy records
such as the original `MA301` subject are retained rather than deleted.

Start the backend from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In a second PowerShell window, install and start the frontend:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. The frontend proxies `/api` requests to
`http://127.0.0.1:8000`. The backend health endpoint is
`http://127.0.0.1:8000/api/health`.

The API can be explored through its OpenAPI page at
`http://127.0.0.1:8000/docs`. Use `POST /api/auth/demo-login` with
`{"username":"admin.demo"}` to obtain a local bearer token, then authorize
requests with that token. The database schema is initialized with SQLAlchemy
`create_all`; missing tables are created on startup, but this prototype has
no migration tool for altering existing tables. Back up a non-disposable
database before structural schema changes.

## Marks, notifications, and academic risk

Professors can create subject assessments and save marks for enrolled
students. Scores are validated against the assessment maximum on both the
frontend and backend. Updating a mark retains a basic audit event and creates
a student-owned in-app notification. Students can mark their own
notifications as read. The administrator and professor views show only
subjects the current role is permitted to inspect; student overviews and
notifications are restricted to the authenticated student's records.

Risk is a transparent rule-based estimate, not a trained model. Attendance
below 75% and recorded assessment averages below 50% contribute to a higher
score; near-threshold attendance and marks below 65% contribute to a medium
score. Missing inputs are called out in the explanation; no-data cases display
"Awaiting data" rather than a fabricated score. Assignments and prior
performance are not included in this initial formula.

Voice-assisted mark entry uses the browser Web Speech API when available and
an editable typed-sentence fallback otherwise. The professor reviews the
matched enrolled student, selected assessment and parsed score, then must
choose **Confirm & Save** before the existing marks endpoint is called. Unknown,
ambiguous, multiple-score and out-of-range phrases are rejected without a
write. Successful saves use the existing mark record, audit and notification
flow. The live typed-fallback flow has been verified; live microphone
transcription remains unverified in the target browser, so P4 is not fully
accepted.

Relevant API routes:

- `POST /api/academic/assessments` (assigned professor)
- `POST /api/academic/marks` (assigned professor; creates or updates a mark)
- `GET /api/academic/subjects/{subject_id}/overview` (role-scoped marks/risk)
- `GET /api/academic/marks/{mark_id}/audit` (assigned professor or administrator)
- `GET /api/notifications` (authenticated student's own notifications)
- `PUT /api/notifications/{notification_id}/read` (authenticated student's own notification)

## Checks

Run the frontend tests:

```powershell
Set-Location frontend
npm test
```

Run the backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests
```

P0/P1 verification on 2026-10-02: Python 3.14.8 / pip 26.2.1; FastAPI
0.142.2, Uvicorn 0.54.0, SQLAlchemy 2.1.2, PyJWT 2.15.1, HTTPX2 2.13.1,
and Pytest 9.1.1 installed. Backend tests pass (9 tests); frontend tests
pass (7 tests); production build succeeds with a face-api chunk-size
warning. Backend health returned HTTP 200. P1 tests cover seeded demo roles,
role-scoped access, denied writes, duplicate and invalid enrollments, and
SQLite persistence across app restarts. The browser loaded the local face
detection model and opened/stopped a live 640x480 camera preview. Speech
recognition returned a `network` error; the editable fallback worked. No
controlled phrase was transcribed. These checks do not implement face
recognition, attendance, or speech attendance.

## P0 browser checks

- Use **Start camera preview** to request camera access, then **Stop camera**.
  If camera access is unavailable or denied, use the always-available manual
  input instead.
- Use **Check face-model loading** to test the local Tiny Face Detector model.
  The detector manifest and weight shard are served locally from
  `frontend\public\models`. These small model assets are from the pinned
  `@vladmandic/face-api` dependency; see the adjacent license notice. They are
  not fetched from a third-party host at runtime.
- Try **Start speech check** in the target browser. Speech recognition support
  varies; the editable text field is the fallback. Nothing spoken or typed is
  saved as attendance in P0.

Only fictional or empty setup data is used. Camera captures are not stored.

P2 verification on 2026-10-02: backend tests pass (18 tests) and frontend
tests pass (10 tests). `pip check`, backend `compileall`, `git diff --check`,
and the production build pass. The build still reports the existing large
face-api chunk warning. Live HTTP checks exercised professor session
creation, roster retrieval, manual marking, duplicate rejection (409),
administrator correction, audit history, and summary recalculation. A
student could access only their enrolled session roster; an unassigned
professor was denied session creation (403). Attendance and correction audit
data remained available after a backend restart. The browser UI was checked
against the live API for professor sign-in and the attendance summary/work
space. No face or voice attendance behavior was implemented or tested in P2;
the prior P0 camera/model check passed, while browser speech recognition
previously failed with a network error and remains unverified.

P3 implementation is in progress. Backend tests cover consent-gated
descriptor registration, encryption, role restrictions, ambiguous/unknown
proposals, and deletion. Face matching uses locally served detector,
landmark, and recognition weights; the adjacent package license applies.
The recognition models loaded in the browser. The descriptor-distance cutoff
is a prototype heuristic, not a probability, liveness check, or identity
guarantee. Live student camera matching and confirmed attendance submission
were verified with an explicitly consenting participant; the existing
encrypted STU001 template was used, so fresh registration was not retested.
Typed voice command review and confirmation were verified through the live
API. Spoken attendance was attempted in the target VS Code Chromium browser;
the API is present and microphone permission reports `granted`, but recognition
returned the browser error `network` before producing a transcript. The app
does not provide offline speech transcription. The UI reports unsupported
browsers, microphone permission/device issues, no speech, and browser speech
service/network failures distinctly, and highlights the typed fallback.

P3 checks on 2026-10-02: `.\.venv\Scripts\python.exe -m pytest backend\tests`
passed (24 tests); frontend `npm test` passed (19 tests); `pip check`,
Python `compileall`, and `git diff --check` passed. `npm run build` succeeded
with the existing approximately 1.31 MB face-api chunk warning. API
integration tests and a local HTTP smoke check used synthetic descriptors
only; no real biometric sample was collected or saved. P3 remains in
progress until face capture/matching and a spoken command are checked with an
explicitly consenting participant and the intended browser.

Hackathon final UI and academic workflow verification on 2026-10-02:
backend tests pass (29 tests); frontend tests pass (24 tests); `npm run build`
succeeds with the existing face-api bundle-size warning. Browser checks on the
live local API created the fictional "Demo Midterm 2026" assessment, saved
35/40 for fictional student `DEMO001`, then confirmed an update to 36/40.
The professor viewed the audit event; the student dashboard showed the
updated 90% result, rule-based risk summary, and both mark notifications.
Administrator, professor, and student views rendered; student and professor
views at 390px had no document-level horizontal overflow. No live camera
matching or microphone transcription was attempted during this pass.

## Active attendance sessions

Professors start a live attendance session from **Take attendance** and can
explicitly end it after class. Students see only sessions for their enrolled
subjects in **Active Attendance Session**; historical sessions remain in the
session API but are not shown as joinable. The API reports the session
creator, active/ended state, and only the signed-in student's attendance
status. A student can open the camera only by selecting **Join & Mark
Attendance**. The browser captures a descriptor and sends it to the existing
face-match route; for student requests the backend compares against that
student's own enrolled face template only. A single self-match is shown for
confirmation before the existing attendance-record route is called.

Student attendance submission is backend-limited to the signed-in student's
own ID, present status, enrolled subject, and an active session. The unique
session/student constraint still prevents duplicate records; an already
recorded student sees their status rather than a second join action. Sessions
created before the active/ended field was introduced are migrated as ended,
so historical sessions are not exposed as active.

The student UI handles missing sessions, camera denial, unrecognized or
ambiguous faces, and duplicate submissions. Browser/UI and API tests cover
these paths. Actual webcam-based recognition against an explicitly consented
participant was not performed during this implementation; do not treat live
camera/face verification as acceptance-tested.

Verification for this addition: `.\.venv\Scripts\python.exe -m pytest
backend\tests` passed (35 tests); frontend `npm test` passed (41 tests);
`npm run build` succeeded with the existing approximately 1.31 MB face-api
bundle warning; Python `compileall` and `git diff --check` passed. Face matching
was exercised through API tests and a mocked browser camera/recognition
adapter, not a live webcam or real participant.

Run the production frontend build from the frontend folder:

```powershell
Set-Location frontend
npm run build
```

## P2 attendance workflow

Sign in in the frontend with a seeded demo username. A professor can choose
an assigned subject, start or reopen a class session, and record each
enrolled student's status manually. Correcting a recorded status adds an
audit event. Student and professor views show subject attendance summaries;
administrators can inspect aggregate subject rosters. The percentage is
`present sessions / all class sessions * 100`, rounded to two decimals.
Missing per-session records count as not present; a subject with no sessions
has an unavailable percentage rather than 0%.

Attendance thresholds are backend environment settings:

```dotenv
ATTENDANCE_REQUIREMENT_PERCENT=75
ATTENDANCE_WARNING_PERCENT=80
```

Below the requirement is flagged as below threshold; percentages from the
requirement through the warning threshold (inclusive) show a warning.
Only assigned professors may create sessions or end them. Students may
submit only their own present status during an active session; they cannot
change or correct an existing attendance record.
Administrator correction is allowed and audited. These manual workflows do
not use face matching or voice commands.

Attendance API routes:

- `POST /api/attendance/sessions` (assigned professor)
- `POST /api/attendance/sessions/{session_id}/end` (assigned professor)
- `GET /api/attendance/sessions`
- `GET /api/attendance/sessions/{session_id}/records`
- `POST /api/attendance/sessions/{session_id}/records` (assigned professor, or authenticated student recording their own presence in an active session)
- `PUT /api/attendance/sessions/{session_id}/records/{student_id}` (assigned professor or administrator)
- `GET /api/attendance/sessions/{session_id}/audit` (assigned professor or administrator)
- `GET /api/attendance/subjects/{subject_id}/summary`

## P3 face and voice attendance

Before the face panel requests camera access, the professor must confirm that
people in view have been informed and consent to face processing for that
session. Template registration separately requires the student's explicit
consent. Revoking camera-use consent stops the stream. Face matching remains a
proposal for professor review, not an automatic attendance write.

When a professor signs in with an active session, the latest active session
for the selected subject is selected automatically. The **Student face
template** list comes from that session's enrolled attendance roster; students
remain listed whether or not they already have a template. The separate
template-status endpoint only supplies each student's `registered` indicator.
Use **Check recognition models** to load and verify the local models from
`frontend/public/models`; the initial “not checked” message means the check
has not yet been requested in that page.

The professor can register a face descriptor only after affirming the
student's explicit consent. Camera frames are processed in the browser and
are not sent to the API. The 128-number descriptor is encrypted in the API
with AES-GCM. The browser compares no stored biometric data: the protected
backend performs matching only against students enrolled in the active
session's subject. A match response is a proposal with a descriptor distance,
not a confidence probability. Unknown or ambiguous results are not
confirmable. The student can remove their template from their account; an
assigned professor can also remove it from the class roster.

Voice commands follow the form `mark [full student name or roll number]
[present or absent]`. Recognition produces editable text and a proposed
action; the professor must confirm it before the same P2 attendance API
creates or corrects the record. Only exact name/roll-number matches are
accepted, and unclear or unmatched text creates no record. The Web Speech API
may process audio through the browser's configured speech service. The app
does not identify or verify the speaker.

Face-template API routes:

- `PUT /api/attendance/subjects/{subject_id}/students/{student_id}/face-template` (assigned professor; consent required)
- `DELETE /api/attendance/subjects/{subject_id}/students/{student_id}/face-template` (assigned professor)
- `GET /api/attendance/sessions/{session_id}/face-templates` (assigned professor; registration status only)
- `POST /api/attendance/sessions/{session_id}/face-match` (assigned professor proposal, or enrolled student's own-template verification)
- `GET /api/attendance/face-template` and `DELETE /api/attendance/face-template` (student's own status/removal)

## Voice-assisted marks

In the professor's subject assessment workspace, select an existing
assessment and use **Start microphone** or enter a sentence such as
`Rahul Sharma got 18 marks` / `Rahul Sharma 18` in the editable fallback.
Recognition resolves a full enrolled-student name or roll number against the
selected subject's live roster. A single score must be within the assessment
maximum. Review the student, assessment, and score; **Confirm & Save** is the
only action that calls `POST /api/academic/marks`. **Cancel** never writes.
Create/select an assessment first. Unsupported speech recognition is reported
and the typed fallback remains available. Existing backend validation,
professor subject authorization, mark auditing, and student-owned notifications
are reused.

The deterministic parser accepts digits and common English number words; it
is not an NLP model. Live browser microphone transcription was not verified in
this session. The typed proposal/confirmation/save flow was checked against
the running local API, and the student view displayed the saved mark and its
notification.

Latest verification on 2026-10-02:

- `.\.venv\Scripts\python.exe -m pytest backend\tests` — 30 passed.
- `npm test` — 35 passed.
- `npm run build` — succeeded; existing 1.31 MB face-api chunk warning.
- `.\.venv\Scripts\python.exe -m compileall backend` and `git diff --check` — passed.

Tests exercise the Web Speech result handler with a simulated browser
recognition event; they do not establish live microphone transcription
support in the target browser.
