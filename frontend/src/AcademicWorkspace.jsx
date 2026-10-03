import { useEffect, useState } from "react";
import { requestApi } from "./apiClient.js";
import VoiceMarkEntry from "./VoiceMarkEntry.jsx";

function formatPercent(value) {
  return value === null ? "—" : `${value}%`;
}

function RiskBadge({ level }) {
  const label = level === "insufficient_data"
    ? "Awaiting data"
    : `${level[0].toUpperCase()}${level.slice(1)} risk`;
  return <span className={`risk-badge ${level}`}>{label}</span>;
}

export default function AcademicWorkspace({
  token,
  role,
  subjects,
  selectedSubjectId,
  onSubjectChange,
  academicOverviews,
  refreshOverview,
  sharedNotifications,
  refreshNotifications,
}) {
  const [subjectId, setSubjectId] = useState(selectedSubjectId ?? "");
  const [localOverview, setLocalOverview] = useState(null);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [assessmentId, setAssessmentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [score, setScore] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditRecordId, setAuditRecordId] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (selectedSubjectId) setSubjectId(selectedSubjectId);
  }, [selectedSubjectId]);

  const overview = academicOverviews
    ? academicOverviews[subjectId] ?? null
    : localOverview;
  const notifications = sharedNotifications ?? localNotifications;

  async function load() {
    if (refreshOverview) {
      await refreshOverview(subjectId);
      return;
    }
    if (!subjectId) {
      setLocalOverview(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await requestApi(`/academic/subjects/${subjectId}/overview`, { token });
      setLocalOverview(result);
      setAssessmentId((current) =>
        result.assessments.some((assessment) => String(assessment.id) === current)
          ? current
          : String(result.assessments[0]?.id ?? ""),
      );
      setStudentId((current) =>
        result.risk.some((student) => String(student.student_id) === current)
          ? current
          : String(result.risk[0]?.student_id ?? ""),
      );
    } catch (loadError) {
      setLocalOverview(null);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    if (role !== "student" || sharedNotifications !== undefined) return;
    try {
      setLocalNotifications(await requestApi("/notifications", { token }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    if (!refreshOverview) load();
  }, [subjectId, token, refreshOverview]);

  useEffect(() => {
    if (sharedNotifications === undefined) loadNotifications();
  }, [token, role, sharedNotifications]);

  async function submitAcademicAction(action, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("mark")) setScore("");
      if (normalizedMessage.includes("assessment")) {
        setTitle("");
      }
      await load();
      return true;
    } catch (actionError) {
      setError(actionError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationRead(id) {
    try {
      await requestApi(`/notifications/${id}/read`, { token, method: "PUT" });
      if (refreshNotifications) {
        await refreshNotifications();
      } else {
        await loadNotifications();
      }
    } catch (readError) {
      setError(readError.message);
    }
  }

  const isStudent = role === "student";
  const isProfessor = role === "professor";
  const activeAssessment = overview?.assessments.find(
    (assessment) => String(assessment.id) === assessmentId,
  );
  const existingMark = overview?.marks.find(
    (mark) =>
      String(mark.assessment_id) === assessmentId &&
      String(mark.student_id) === studentId,
  );
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const riskDistribution = [
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["insufficient_data", "Awaiting data"],
  ].map(([level, label]) => ({
    level,
    label,
    count: overview?.risk.filter((student) => student.risk_level === level).length ?? 0,
  }));
  const riskCount = riskDistribution.reduce((total, item) => total + item.count, 0);

  async function loadMarkAudit() {
    if (!existingMark) return;
    setAuditLoading(true);
    setError("");
    try {
      const history = await requestApi(
        `/academic/marks/${existingMark.id}/audit`,
        { token },
      );
      setAuditRecordId(existingMark.id);
      setAuditHistory(history);
    } catch (auditError) {
      setError(auditError.message);
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <section className="dashboard-section academic-workspace" id="academic-progress">
      <div className="section-heading">
        <div>
          <p className="section-kicker">{isProfessor ? "ASSESSMENT WORKSPACE" : "ACADEMIC INSIGHTS"}</p>
          <h2>{isStudent ? "Your academic progress" : isProfessor ? "Assessments & student progress" : "Subject risk overview"}</h2>
          <p className="section-description">
            {isStudent
              ? "Marks, attendance, and support indicators from your own academic records."
              : "Live subject records with transparent, rule-based risk estimates."}
          </p>
        </div>
      </div>

      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}

      <section className="panel academic-insights-panel">
        <div className="academic-toolbar">
          <div>
            <p className="metric-label">Selected subject</p>
            <strong>{overview ? `${overview.subject_code} · ${overview.subject_name}` : "Choose a subject"}</strong>
          </div>
          <label className="subject-picker" htmlFor="academic-subject">
            Subject
            <select
              id="academic-subject"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                onSubjectChange?.(event.target.value);
              }}
            >
              {subjects.length === 0 && <option value="">No subjects available</option>}
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="loading-card compact-loading" role="status">
            <span className="loading-indicator" />Loading subject records…
          </div>
        ) : !overview ? (
          <div className="empty-state compact-empty">
            <h3>Academic details will appear here</h3>
            <p>Select an enrolled or assigned subject to view current records.</p>
          </div>
        ) : (
          <>
            {!isStudent && riskCount > 0 && (
              <section className="risk-distribution" aria-label="Subject risk distribution">
                <div className="risk-distribution-heading">
                  <div>
                    <h3>Student risk distribution</h3>
                    <p>Current rule-based estimates for this subject</p>
                  </div>
                  <span>{riskCount} students</span>
                </div>
                <div className="risk-distribution-legend">
                  {riskDistribution.map((item) => (
                    <span className={`risk-count risk-count--${item.level}`} key={item.level}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              </section>
            )}
            {isProfessor && (
              <div className="academic-entry-grid">
                <form
                  className="academic-entry-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAcademicAction(
                      () => requestApi("/academic/assessments", {
                        token,
                        method: "POST",
                        body: JSON.stringify({
                          subject_id: Number(subjectId),
                          title,
                          max_score: Number(maxScore),
                        }),
                      }),
                      "Assessment created.",
                    );
                  }}
                >
                  <div className="card-heading">
                    <span className="card-icon indigo" aria-hidden="true">A</span>
                    <div><h3>Create an assessment</h3><p>Set a clear title and maximum score.</p></div>
                  </div>
                  <label htmlFor="assessment-title">Assessment name</label>
                  <input id="assessment-title" value={title} maxLength="120" onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Midterm examination" />
                  <label htmlFor="assessment-max-score">Maximum score</label>
                  <input id="assessment-max-score" type="number" min="0.01" step="any" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} required />
                  <button type="submit" disabled={busy}>{busy ? "Saving…" : "Create assessment"}</button>
                </form>
                <form
                  className="academic-entry-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!activeAssessment || Number(score) > activeAssessment.max_score) {
                      setError("Enter a score within the selected assessment maximum.");
                      return;
                    }
                    if (existingMark && Number(score) === existingMark.score) {
                      setNotice("This mark already has that score; no change was made.");
                      return;
                    }
                    if (
                      existingMark &&
                      !window.confirm(
                        `Update ${existingMark.student_name}'s ${existingMark.assessment_title} mark from ${existingMark.score} to ${score}? The student will be notified.`,
                      )
                    ) {
                      return;
                    }
                    submitAcademicAction(
                      () => requestApi("/academic/marks", {
                        token,
                        method: "POST",
                        body: JSON.stringify({
                          assessment_id: Number(assessmentId),
                          student_id: Number(studentId),
                          score: Number(score),
                        }),
                      }),
                      existingMark ? "Mark updated; student notified." : "Student mark saved.",
                    );
                  }}
                >
                  <div className="card-heading">
                    <span className="card-icon green" aria-hidden="true">M</span>
                    <div><h3>Enter a mark</h3><p>Existing marks are updated with an audit record.</p></div>
                  </div>
                  <label htmlFor="mark-assessment">Assessment</label>
                  <select id="mark-assessment" value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} required>
                    {overview.assessments.length === 0 && <option value="">Create an assessment first</option>}
                    {overview.assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title} · /{assessment.max_score}</option>)}
                  </select>
                  <label htmlFor="mark-student">Student</label>
                  <select id="mark-student" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
                    {overview.risk.map((student) => <option key={student.student_id} value={student.student_id}>{student.roll_number} · {student.student_name}</option>)}
                  </select>
                  <label htmlFor="mark-score">Score{activeAssessment ? ` (max ${activeAssessment.max_score})` : ""}</label>
                  <input id="mark-score" type="number" min="0" max={activeAssessment?.max_score} step="any" value={score} onChange={(event) => setScore(event.target.value)} required />
                  {existingMark && (
                  <p className="field-hint">
                    Current result: {existingMark.score} / {existingMark.max_score}. Updating it requires confirmation and notifies the student.
                  </p>
                  )}
                  <button type="submit" disabled={busy || !activeAssessment || !studentId}>{busy ? "Saving…" : existingMark ? "Update mark" : "Save mark"}</button>
                  {existingMark && (
                  <button className="secondary" type="button" onClick={loadMarkAudit} disabled={auditLoading}>
                    {auditLoading ? "Loading history…" : "View mark history"}
                  </button>
                  )}
                  {existingMark && auditRecordId === existingMark.id && (
                  <div className="audit-history" aria-live="polite">
                    <strong>Change history</strong>
                    {auditHistory.length === 0 ? (
                      <p>No edits have been recorded for this mark.</p>
                    ) : (
                      <ul>
                        {auditHistory.map((event) => (
                          <li key={event.id}>
                            {event.actor_username} changed {event.before_score} to {event.after_score}
                            <time>{new Date(event.created_at).toLocaleString()}</time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  )}
                </form>
                <VoiceMarkEntry
                  assessment={activeAssessment}
                  roster={overview.risk}
                  saving={busy}
                  onConfirmSave={({ assessmentId: selectedAssessmentId, studentId: selectedStudentId, score: selectedScore }) =>
                    submitAcademicAction(
                      () => requestApi("/academic/marks", {
                        token,
                        method: "POST",
                        body: JSON.stringify({
                          assessment_id: selectedAssessmentId,
                          student_id: selectedStudentId,
                          score: selectedScore,
                        }),
                      }),
                      "Voice-assisted mark saved; student notified.",
                    )
                  }
                />
              </div>
            )}

            {(isStudent || isProfessor || role === "administrator") && (
              <div className="risk-summary-grid">
                {overview.risk.map((student) => (
                  <article className="risk-summary-card" key={student.student_id}>
                    {!isStudent && <div className="risk-student-name">{student.student_name}<span>{student.roll_number}</span></div>}
                    <div className="risk-card-top">
                      <h3>Subject risk estimate</h3>
                      <RiskBadge level={student.risk_level} />
                    </div>
                    <div className="risk-stats">
                      <div><span>Attendance</span><strong>{formatPercent(student.attendance_percent)}</strong></div>
                      <div><span>Assessment avg.</span><strong>{formatPercent(student.marks_percent)}</strong></div>
                      <div><span>Risk score</span><strong>{student.risk_score === null ? "—" : `${student.risk_score}/100`}</strong></div>
                    </div>
                    <h4 className="risk-factor-heading">Contributing factors</h4>
                    <ul className="risk-factors">
                      {student.factors.map((factor) => <li key={factor}>{factor}</li>)}
                    </ul>
                    <p className="risk-recommendation">
                      <strong>Recommended action:</strong> {student.recommendation}
                    </p>
                  </article>
                ))}
                {overview.risk.length === 0 && (
                  <div className="empty-state compact-empty">
                    <h3>No enrolled students</h3><p>Student insights appear when the subject has enrollments.</p>
                  </div>
                )}
              </div>
            )}

            <div className="section-heading compact academic-table-heading">
              <div><h3>{isStudent ? "Assessment results" : "Recorded marks"}</h3><p className="section-description">Scores shown against each assessment’s maximum.</p></div>
              <span className="section-count">{overview.marks.length} marks</span>
            </div>
            {overview.marks.length === 0 ? (
              <div className="empty-state compact-empty"><h3>No marks recorded</h3><p>Assessment results will appear here after they are entered.</p></div>
            ) : (
              <div className="table-wrap academic-table-wrap">
                <table>
                  <thead><tr>{!isStudent && <th>Student</th>}<th>Assessment</th><th>Score</th><th>Percentage</th><th>Updated</th></tr></thead>
                  <tbody>
                    {overview.marks.map((mark) => (
                      <tr key={mark.id}>
                        {!isStudent && <td className="person-cell"><span>{mark.student_name}</span><span className="table-secondary">{mark.roll_number}</span></td>}
                        <td>{mark.assessment_title}</td>
                        <td><strong>{mark.score} / {mark.max_score}</strong></td>
                        <td><span className="mark-percent">{((mark.score / mark.max_score) * 100).toFixed(1)}%</span></td>
                        <td>{new Date(mark.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {isStudent && (
        <section className="dashboard-section notifications-section" id="notifications">
          <div className="section-heading">
            <div><p className="section-kicker">UPDATES</p><h2>Notifications</h2><p className="section-description">Mark updates and academic notices linked to your account.</p></div>
            <span className="section-count">{unreadCount} unread</span>
          </div>
          {notifications.length === 0 ? (
            <div className="empty-state compact-empty"><h3>You’re all caught up</h3><p>New marks updates will appear here.</p></div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => (
                <article key={item.id} className={`notification-card ${item.read_at ? "is-read" : "is-unread"}`}>
                  <span className="notification-mark" aria-hidden="true">{item.read_at ? "✓" : "•"}</span>
                  <div className="notification-copy"><strong>{item.title}</strong><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>
                  {!item.read_at && <button className="secondary" type="button" onClick={() => markNotificationRead(item.id)}>Mark as read</button>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
