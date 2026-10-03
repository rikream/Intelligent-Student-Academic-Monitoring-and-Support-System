import { useCallback, useEffect, useState } from "react";
import { requestApi } from "./apiClient.js";
import FaceAttendancePanel from "./FaceAttendancePanel.jsx";
import FaceTemplatePrivacy from "./FaceTemplatePrivacy.jsx";
import VoiceAttendancePanel from "./VoiceAttendancePanel.jsx";
import StudentActiveAttendance from "./StudentActiveAttendance.jsx";
import AdminRecordManagement from "./AdminRecordManagement.jsx";
import AcademicWorkspace from "./AcademicWorkspace.jsx";
import AnalyticsDashboard from "./AnalyticsDashboard.jsx";

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function AttendanceWorkspace({ token, user }) {
  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [academicOverviews, setAcademicOverviews] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [analyticsSubjectId, setAnalyticsSubjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNotifications = useCallback(async () => {
    if (user.role !== "student") {
      setNotifications([]);
      return;
    }
    try {
      setNotifications(await requestApi("/notifications", { token }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [token, user.role]);

  const canRecord = user.role === "professor";
  const activeSubject = subjects.find((subject) => String(subject.id) === subjectId);
  const activeSession = sessions.find((session) => String(session.id) === sessionId);
  const loadData = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [loadedSubjects, loadedEnrollments, loadedSessions, loadedStudents] = await Promise.all([
        requestApi("/subjects", { token }),
        requestApi("/enrollments", { token }),
        requestApi("/attendance/sessions", { token }),
        user.role === "administrator" ? requestApi("/students", { token }) : Promise.resolve([]),
      ]);
      setSubjects(loadedSubjects);
      setEnrollments(loadedEnrollments);
      setSessions(loadedSessions);
      setStudents(loadedStudents);
      setSubjectId((selected) =>
        loadedSubjects.some((subject) => String(subject.id) === selected)
          ? selected
          : String(loadedSubjects[0]?.id ?? ""),
      );

      const [summaries, overviews] = await Promise.all([
        Promise.all(
          loadedSubjects.map(async (subject) => ({
            subject,
            rows: await requestApi(`/attendance/subjects/${subject.id}/summary`, { token }),
          })),
        ),
        Promise.all(
          loadedSubjects.map(async (subject) => [
            String(subject.id),
            await requestApi(`/academic/subjects/${subject.id}/overview`, { token }),
          ]),
        ),
      ]);
      setSummaryRows(summaries.flatMap(({ rows }) => rows));
      setAcademicOverviews(Object.fromEntries(overviews));
      setAnalyticsSubjectId((selected) =>
        loadedSubjects.some((subject) => String(subject.id) === selected)
          ? selected
          : String(loadedSubjects[0]?.id ?? ""),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token, user.role]);

  const refreshAcademicOverview = useCallback(async (selectedId) => {
    if (!selectedId) return;
    const overview = await requestApi(
      `/academic/subjects/${selectedId}/overview`,
      { token },
    );
    setAcademicOverviews((current) => ({ ...current, [selectedId]: overview }));
  }, [token]);

  const loadRoster = useCallback(async () => {
    if (!sessionId) {
      setRoster([]);
      return;
    }
    try {
      setRoster(await requestApi(`/attendance/sessions/${sessionId}/records`, { token }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [sessionId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    const selectedSession = sessions.find(
      (session) =>
        String(session.id) === sessionId
        && String(session.subject_id) === subjectId,
    );
    if (selectedSession) {
      return;
    }
    const latestActiveSession = sessions.find(
      (session) =>
        session.is_active && String(session.subject_id) === subjectId,
    );
    if (latestActiveSession) {
      setSessionId(String(latestActiveSession.id));
    }
  }, [sessions, sessionId, subjectId]);

  async function runAction(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await loadData({ showLoading: false });
      await loadRoster();
      return true;
    } catch (actionError) {
      setError(actionError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createSession() {
    if (!activeSubject) {
      setError("Choose a subject before starting a class session.");
      return;
    }
    await runAction(async () => {
      const created = await requestApi("/attendance/sessions", {
        token,
        method: "POST",
        body: JSON.stringify({ subject_id: activeSubject.id }),
      });
      setSessionId(String(created.id));
    }, "Class session started.");
  }

  async function endSession() {
    if (!activeSession || !activeSession.is_active) return;
    await runAction(
      () => requestApi(`/attendance/sessions/${activeSession.id}/end`, {
        token,
        method: "POST",
      }),
      "Class session ended. Students can no longer join it.",
    );
  }

  async function saveRecord(entry, status) {
    return runAction(async () => {
      const existing = entry.status !== null;
      await requestApi(
        `/attendance/sessions/${sessionId}/records${existing ? `/${entry.student_id}` : ""}`,
        {
          token,
          method: existing ? "PUT" : "POST",
          body: JSON.stringify(existing ? { status } : { student_id: entry.student_id, status }),
        },
      );
    }, `${entry.roll_number} marked ${status}.`);
  }

  async function submitStudentAttendance(sessionId, studentId) {
    setError("");
    setNotice("");
    try {
      await requestApi(`/attendance/sessions/${sessionId}/records`, {
        token,
        method: "POST",
        body: JSON.stringify({ student_id: studentId, status: "present" }),
      });
      setNotice("Attendance marked successfully.");
      await loadData({ showLoading: false });
      return "saved";
    } catch (submitError) {
      if (submitError.message.toLowerCase().includes("attendance already exists")) {
        setNotice("Attendance was already recorded for this session.");
        await loadData({ showLoading: false });
        return "already";
      }
      setError(submitError.message);
      return "failed";
    }
  }

  const visibleSessions = sessions.filter((session) => String(session.subject_id) === subjectId);
  const subjectCount = subjects.length;
  const totalSessions = summaryRows.reduce((total, row) => total + row.total_sessions, 0);
  const presentSessions = summaryRows.reduce((total, row) => total + row.present_sessions, 0);
  const attendanceAverage = totalSessions
    ? Math.round((presentSessions / totalSessions) * 100)
    : null;
  const studentsNeedingSupport = summaryRows.filter(
    (row) => row.alert === "below_requirement",
  ).length;
  const uniqueStudents = new Set(enrollments.map((enrollment) => enrollment.student_id)).size;
  const isStudent = user.role === "student";
  const isAdmin = user.role === "administrator";
  const analyticsSubject = subjects.find(
    (subject) => String(subject.id) === analyticsSubjectId,
  );
  const studentId = summaryRows[0]?.student_id;
  const studentRisk = Object.values(academicOverviews)
    .flatMap((overview) => overview.risk)
    .filter((risk) => risk.student_id === studentId)
    .sort((left, right) => {
      const priority = { high: 3, medium: 2, low: 1, insufficient_data: 0 };
      return (priority[right.risk_level] ?? 0) - (priority[left.risk_level] ?? 0);
    })[0];
  const riskLabel = !studentRisk || studentRisk.risk_level === "insufficient_data"
    ? "Awaiting data"
    : `${studentRisk.risk_level[0].toUpperCase()}${studentRisk.risk_level.slice(1)}`;
  const professorCount = new Set(sessions.map((session) => session.professor_name)).size;
  const professorStudentsNeedingSupport = new Set(
    summaryRows
      .filter((row) => row.alert === "below_requirement")
      .map((row) => row.student_id),
  ).size;
  const displayName = summaryRows[0]?.student_name ?? user.username;
  const title = isStudent
    ? `Welcome back, ${displayName.split(" ")[0]}`
    : isAdmin
      ? "Academic overview"
      : "Teaching overview";
  const subtitle = isStudent
    ? "Here’s a clear view of your attendance and enrolled subjects."
    : isAdmin
      ? "Monitor the academic records and attendance activity in your workspace."
      : "Review your classes and keep attendance records up to date.";

  return (
    <section className={`attendance-workspace attendance-workspace--${user.role}`}>
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">{isStudent ? "STUDENT DASHBOARD" : isAdmin ? "ADMINISTRATOR DASHBOARD" : "PROFESSOR DASHBOARD"}</p>
          <h1 id="overview">{title}</h1>
          <p className="workspace-intro">{subtitle}</p>
        </div>
      </div>

      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {loading ? (
        <div className="loading-card" role="status"><span className="loading-indicator" />Loading your academic workspace...</div>
      ) : (
        <>
          <section className="metric-grid" aria-label="Academic summary">
            <article className="metric-card">
              <div className="metric-label">{isStudent ? "Overall attendance" : isAdmin ? "Students" : "Assigned courses"}</div>
              <div className="metric-value">{isStudent ? attendanceAverage === null ? "—" : `${attendanceAverage}%` : isAdmin ? students.length : subjectCount}</div>
              <div className="metric-footnote">{isStudent ? totalSessions ? `${presentSessions} of ${totalSessions} sessions attended` : "No class sessions recorded yet" : isAdmin ? "Student profiles in the system" : "Courses assigned to your account"}</div>
              {isStudent && attendanceAverage !== null && (
                <div className={`metric-progress ${attendanceAverage < 75 ? "is-danger" : attendanceAverage <= 80 ? "is-warning" : ""}`} role="img" aria-label={`Overall attendance ${attendanceAverage} percent`}>
                  <span style={{ width: `${Math.min(attendanceAverage, 100)}%` }} />
                </div>
              )}
            </article>
            <article className="metric-card">
              <div className="metric-label">{isStudent ? "Risk status" : isAdmin ? "Professors" : "Students"}</div>
              <div className={`metric-value ${isStudent && studentRisk?.risk_level === "high" ? "metric-value-danger" : ""}`}>{isStudent ? riskLabel : isAdmin ? professorCount : uniqueStudents}</div>
              <div className="metric-footnote">{isStudent ? studentRisk ? "Highest subject-level rule-based estimate" : "No risk estimate is available yet" : isAdmin ? "Professors represented in session history" : "Unique students across assigned courses"}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">{isStudent ? "Enrolled subjects" : isAdmin ? "Courses" : "Active sessions"}</div>
              <div className="metric-value">{isStudent || isAdmin ? subjectCount : sessions.filter((session) => session.is_active).length}</div>
              <div className="metric-footnote">{isStudent ? "Subjects linked to your student account" : isAdmin ? "Available subject records" : "Currently open class sessions"}</div>
            </article>
            <article className={`metric-card ${studentsNeedingSupport || professorStudentsNeedingSupport || (studentRisk && ["high", "medium"].includes(studentRisk.risk_level)) ? "metric-card-attention" : ""}`}>
              <div className="metric-label">{isStudent ? "Recent activity" : isAdmin ? "Active sessions" : "Students below requirement"}</div>
              <div className="metric-value">
                {isStudent
                  ? notifications.length
                  : isAdmin
                    ? sessions.filter((session) => session.is_active).length
                    : professorStudentsNeedingSupport}
              </div>
              <div className="metric-footnote">
                {isStudent
                  ? "Notifications in your account"
                  : isAdmin
                    ? "Currently open class sessions"
                    : "Unique students below their course requirement"}
              </div>
            </article>
          </section>

          <AnalyticsDashboard
            role={user.role}
            subjects={subjects}
            selectedSubjectId={analyticsSubjectId}
            onSubjectSelect={setAnalyticsSubjectId}
            summaryRows={summaryRows}
            sessions={sessions}
            enrollments={enrollments}
            students={students}
            academicOverviews={academicOverviews}
            notifications={notifications}
            token={token}
          />

          {isStudent && (
            <StudentActiveAttendance
              token={token}
              sessions={sessions}
              onRefresh={loadData}
              onSubmitAttendance={submitStudentAttendance}
            />
          )}

          <section id="attendance" className="dashboard-section" aria-labelledby="attendance-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">ATTENDANCE OVERVIEW</p>
                <h2 id="attendance-heading">{isStudent ? "Your subject progress" : "Subject attendance"}</h2>
                <p className="section-description">
                  Attendance is present sessions divided by all class sessions. Missing records count as not present.
                </p>
              </div>
              <span className="section-count">{summaryRows.length} {isStudent ? "subjects" : "student records"}</span>
            </div>
            {summaryRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
                </div>
                <h3>No attendance data yet</h3>
                <p>{isStudent ? "Your subject attendance will appear here after class sessions are recorded." : "Attendance summaries will appear here after sessions and student records are available."}</p>
              </div>
            ) : isStudent ? (
              <div className="subject-progress-grid">
                {summaryRows.map((row) => (
                  <article className="subject-progress-card" key={`${row.subject_id}-${row.student_id}`}>
                    <div className="subject-progress-top">
                      <div>
                        <span className="subject-code">{row.subject_code}</span>
                        <h3>{row.subject_name}</h3>
                      </div>
                      <span className={`alert-badge ${row.alert}`}>
                        {row.alert === "no_sessions"
                          ? "No sessions"
                          : row.alert === "below_requirement"
                            ? "Below requirement"
                            : row.alert === "warning"
                              ? "Near threshold"
                              : "On track"}
                      </span>
                    </div>
                    <div className="subject-attendance-value">
                      <strong>{row.attendance_percent === null ? "—" : `${row.attendance_percent}%`}</strong>
                      <span>{row.present_sessions} of {row.total_sessions} classes</span>
                    </div>
                    <div className={`progress-track ${row.alert}`} role="img" aria-label={`${row.subject_code} attendance ${row.attendance_percent ?? "not available"} percent`}>
                      <span style={{ width: `${Math.min(row.attendance_percent ?? 0, 100)}%` }} />
                    </div>
                    <p className="subject-explanation">
                      {row.alert === "no_sessions"
                        ? "Attendance will be calculated once class sessions are recorded."
                        : row.alert === "below_requirement"
                          ? `Your attendance is below the ${row.requirement_percent}% requirement. Speak with your professor about support.`
                          : row.alert === "warning"
                            ? `Your attendance is approaching the ${row.requirement_percent}% requirement. Keep attending upcoming classes.`
                            : `You are meeting the ${row.requirement_percent}% attendance requirement.`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-wrap academic-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Student</th>
                      <th>Sessions</th>
                      <th>Present</th>
                      <th>Attendance</th>
                      <th>Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={`${row.subject_id}-${row.student_id}`}>
                        <td><span className="subject-code">{row.subject_code}</span><span className="table-secondary">{row.subject_name}</span></td>
                        <td className="person-cell"><span className="person-avatar">{row.student_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span>{row.student_name}<span className="table-secondary">{row.roll_number}</span></span></td>
                        <td>{row.total_sessions}</td>
                        <td>{row.present_sessions}</td>
                        <td className="attendance-cell">
                          <div className="table-progress"><span style={{ width: `${Math.min(row.attendance_percent ?? 0, 100)}%` }} /></div>
                          <strong>{row.attendance_percent === null ? "—" : `${row.attendance_percent}%`}</strong>
                        </td>
                        <td>
                          <span className={`alert-badge ${row.alert}`}>
                            {row.alert === "no_sessions"
                              ? "No sessions"
                              : row.alert === "below_requirement"
                                ? `Below ${row.requirement_percent}%`
                                : row.alert === "warning"
                                  ? `Warning (≤${row.warning_percent}%)`
                                  : "On track"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <AcademicWorkspace
            token={token}
            role={user.role}
            subjects={subjects}
            selectedSubjectId={analyticsSubjectId}
            onSubjectChange={setAnalyticsSubjectId}
            academicOverviews={academicOverviews}
            refreshOverview={refreshAcademicOverview}
            sharedNotifications={notifications}
            refreshNotifications={loadNotifications}
          />

          {isAdmin && (
            <AdminRecordManagement
              token={token}
              students={students}
              subjects={subjects}
              enrollments={enrollments}
              onRefresh={loadData}
            />
          )}

          {canRecord && (
            <section id="manual-attendance" className="dashboard-section" aria-labelledby="manual-attendance-heading">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">CLASS MANAGEMENT</p>
                  <h2 id="manual-attendance-heading">Take attendance</h2>
                  <p className="section-description">Start a class session, then record attendance or review recognition-assisted proposals.</p>
                </div>
              </div>
              <section className="panel workflow-card">
                <h3>Manual attendance</h3>
              {subjects.length === 0 ? (
                <div className="empty-state compact-empty">
                  <h3>No assigned subjects</h3>
                  <p>Your permitted subjects will appear here when they are assigned.</p>
                </div>
              ) : (
                <>
                  <label htmlFor="attendance-subject">Assigned subject</label>
                  <select
                    id="attendance-subject"
                    value={subjectId}
                    onChange={(event) => {
                      setSubjectId(event.target.value);
                      setSessionId("");
                      setRoster([]);
                    }}
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code} · {subject.name}
                      </option>
                    ))}
                  </select>
                  <div className="actions session-actions">
                    <button type="button" onClick={createSession} disabled={busy || !activeSubject}>
                      Start class session
                    </button>
                    <label htmlFor="attendance-session">Existing session</label>
                    <select
                      id="attendance-session"
                      value={sessionId}
                      onChange={(event) => setSessionId(event.target.value)}
                    >
                      <option value="">Choose a session</option>
                      {visibleSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.is_active ? "Active · " : "Ended · "}{formatDate(session.held_at)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeSession && (
                    <p className="note session-context">
                      Session {activeSession.id}: {activeSession.subject_code} · {formatDate(activeSession.held_at)}
                      {activeSession.is_active ? " · Active" : " · Ended"}
                    </p>
                  )}
                  {activeSession?.is_active && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={endSession}
                    >
                      End class session
                    </button>
                  )}
                  {activeSession && (
                    <div className="table-wrap academic-table-wrap">
                      {roster.length === 0 ? (
                        <p>No students are enrolled in this subject.</p>
                      ) : (
                        <table>
                          <thead>
                            <tr><th>Roll number</th><th>Student</th><th>Recorded status</th><th>Manual action</th></tr>
                          </thead>
                          <tbody>
                            {roster.map((entry) => (
                              <tr key={entry.student_id}>
                                <td>{entry.roll_number}</td>
                                <td>{entry.student_name}</td>
                                <td>{entry.status ?? "Not recorded"}</td>
                                <td className="row-actions">
                                  <button
                                    type="button"
                                    disabled={busy || entry.status === "present"}
                                    onClick={() => saveRecord(entry, "present")}
                                  >
                                    {entry.status ? "Correct to present" : "Mark present"}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    disabled={busy || entry.status === "absent"}
                                    onClick={() => saveRecord(entry, "absent")}
                                  >
                                    {entry.status ? "Correct to absent" : "Mark absent"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )}
              </section>
            </section>
          )}
          {user.role === "student" && <FaceTemplatePrivacy token={token} />}
          {canRecord && activeSession && (
            <>
              <FaceAttendancePanel
                key={`face-${activeSession.id}`}
                token={token}
                subjectId={activeSession.subject_id}
                sessionId={activeSession.id}
                roster={roster}
                onConfirmPresent={(entry) => saveRecord(entry, "present")}
              />
              <VoiceAttendancePanel
                key={`voice-${activeSession.id}`}
                roster={roster}
                onConfirm={(entry, status) => saveRecord(entry, status)}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
