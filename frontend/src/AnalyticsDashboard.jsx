import { useEffect, useMemo, useState } from "react";
import { requestApi } from "./apiClient.js";
import {
  buildAdminActivity,
  buildAssessmentPerformance,
  buildAttendanceDistribution,
  buildCourseAttendance,
  buildProfessorTrend,
  buildStudentTrend,
  prioritizeRiskFactor,
} from "./analyticsData.js";

const palette = {
  accent: "#205067",
  blue: "#7eb3d8",
  green: "#397a5c",
  amber: "#9a6b14",
  red: "#b5474d",
  grid: "#e3e9ee",
  muted: "#687887",
};

function NoData() {
  return <p className="analytics-no-data">No data available for this view.</p>;
}

function BarChart({
  rows,
  maxValue = 100,
  onSelect,
  selectedId,
  valueLabel,
}) {
  const availableRows = rows.filter((row) => row.value !== null && row.value !== undefined);
  if (availableRows.length === 0) return <NoData />;
  const scale = maxValue ?? Math.max(...availableRows.map((row) => row.value), 1);

  return (
    <div className="analytics-bar-list">
      {rows.map((row, rowIndex) => {
        const isInteractive = Boolean(onSelect && row.value !== null && row.value !== undefined);
        const content = (
          <>
            <span className="analytics-bar-label">
              <strong>{row.label}</strong>
              {row.detail && <small>{row.detail}</small>}
            </span>
            <span className={`analytics-bar-track ${row.tone ? `is-${row.tone}` : ""}`}>
              <span
                className="analytics-bar-fill"
                style={{ width: `${row.value === null || row.value === undefined ? 0 : Math.max(0, Math.min((row.value / scale) * 100, 100))}%` }}
              />
            </span>
            <span className="analytics-bar-value">{valueLabel ? valueLabel(row) : row.valueLabel}</span>
          </>
        );

        const rowKey = `${row.id ?? row.label}-${row.assessment_id ?? ""}-${row.key ?? ""}-${row.label}-${rowIndex}`;
        return isInteractive ? (
          <button
            className={`analytics-bar-row is-interactive ${String(selectedId) === String(row.id) ? "is-selected" : ""}`}
            key={rowKey}
            type="button"
            title={row.title}
            aria-label={row.title ?? `${row.label}: ${row.valueLabel}`}
            onClick={() => onSelect(row)}
          >
            {content}
          </button>
        ) : (
          <div className="analytics-bar-row" key={rowKey} title={row.title}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function LineChart({
  series,
  domainMax = 100,
  formatValue = (value) => `${Math.round(value)}%`,
  label,
  referenceLines = [],
}) {
  const [activePoint, setActivePoint] = useState(null);
  const allPoints = series.flatMap((item) => item.data);
  const hasValues = allPoints.some((point) => Number.isFinite(point.value));
  if (!hasValues) return <NoData />;

  const width = 720;
  const height = 245;
  const left = 42;
  const right = 16;
  const top = 14;
  const bottom = 35;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = allPoints
    .map((point) => point.value)
    .filter((value) => Number.isFinite(value));
  const max = domainMax ?? Math.max(...values, 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  const getX = (index, length) =>
    left + (length <= 1 ? plotWidth / 2 : (index / (length - 1)) * plotWidth);
  const getY = (value) => top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="analytics-line-wrap">
      <svg
        className="analytics-line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={getY(tick)} y2={getY(tick)} />
            <text x={left - 8} y={getY(tick) + 4} textAnchor="end">{formatValue(tick)}</text>
          </g>
        ))}
        {referenceLines.map((reference) => (
          <g key={reference.label}>
            <line
              className="analytics-reference-line"
              x1={left}
              x2={width - right}
              y1={getY(reference.value)}
              y2={getY(reference.value)}
              stroke={reference.color ?? palette.amber}
            />
            <text
              className="analytics-reference-label"
              x={width - right - 2}
              y={getY(reference.value) - 4}
              textAnchor="end"
            >
              {reference.label} {formatValue(reference.value)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          const points = item.data
            .map((point, index) => Number.isFinite(point.value)
              ? `${getX(index, item.data.length)},${getY(point.value)}`
              : null)
            .filter(Boolean);
          return (
            <g key={item.name}>
              {points.length > 1 && (
                <polyline
                  className="analytics-line"
                  points={points.join(" ")}
                  stroke={item.color}
                />
              )}
              {item.data.map((point, index) => Number.isFinite(point.value) && (
                <circle
                  className="analytics-line-point"
                  cx={getX(index, item.data.length)}
                  cy={getY(point.value)}
                  fill={item.color}
                  key={`${item.name}-${point.label}-${index}`}
                  r="4"
                  tabIndex="0"
                  onFocus={() => setActivePoint({ ...point, series: item.name })}
                  onClick={() => setActivePoint({ ...point, series: item.name })}
                >
                  <title>{`${point.label}: ${formatValue(point.value)}${point.details ? ` · ${point.details}` : ""}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {series[0]?.data.map((point, index) => (
          index % Math.max(1, Math.ceil(series[0].data.length / 6)) === 0
            || index === series[0].data.length - 1
        ) && (
          <text
            className="analytics-x-label"
            key={`x-${point.label}-${index}`}
            textAnchor="middle"
            x={getX(index, series[0].data.length)}
            y={height - 8}
          >
            {point.label}
          </text>
        ))}
      </svg>
      {(series.length > 1 || referenceLines.length > 0) && (
        <div className="analytics-legend">
          {series.map((item) => (
            <span key={item.name}><i style={{ backgroundColor: item.color }} />{item.name}</span>
          ))}
          {referenceLines.map((reference) => (
            <span key={reference.label}><i style={{ backgroundColor: reference.color ?? palette.amber }} />{reference.label}</span>
          ))}
        </div>
      )}
      {activePoint && (
        <div className="analytics-chart-tooltip" role="status">
          <strong>{activePoint.series} · {activePoint.label}</strong>
          <span>{formatValue(activePoint.value)}</span>
          {activePoint.details && <small>{activePoint.details}</small>}
          <button
            type="button"
            className="analytics-tooltip-close"
            aria-label="Close chart detail"
            onClick={() => setActivePoint(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function ChartPanel({ title, description, children, className = "" }) {
  return (
    <section className={`analytics-panel ${className}`}>
      <div className="analytics-panel-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function filterRecent(points, range) {
  if (range === "all") return points;
  return points.slice(-Number(range));
}

function StudentAnalytics({
  selectedSubject,
  selectedSubjectId,
  onSubjectSelect,
  summaryRows,
  sessions,
  overview,
  notifications,
  token,
  summaryVersion,
}) {
  const [range, setRange] = useState("10");
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const studentRow = summaryRows.find((row) => row.subject_id === selectedSubject?.id);
  const studentId = studentRow?.student_id;
  const subjectSessions = useMemo(
    () => sessions.filter((session) => session.subject_id === selectedSubject?.id),
    [sessions, selectedSubject?.id],
  );
  const sessionKey = subjectSessions.map((session) => session.id).join(",");

  useEffect(() => {
    if (!studentId || !sessionKey) {
      setRecords({});
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    setRecords({});
    Promise.all(subjectSessions.map(async (session) => [
      session.id,
      await requestApi(`/attendance/sessions/${session.id}/records`, { token }),
    ]))
      .then((entries) => {
        if (active) setRecords(Object.fromEntries(entries));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionKey, summaryVersion, studentId, token]);

  const trend = useMemo(
    () => buildStudentTrend(subjectSessions, records, studentId),
    [subjectSessions, records, studentId],
  );
  const risk = overview?.risk.find((item) => item.student_id === studentId);
  const strongestFactor = prioritizeRiskFactor(risk);
  const recommendation = risk?.recommendation?.split(/(?<=[.!?])\s+/)[0];
  const assessmentRows = buildAssessmentPerformance(overview, "student", studentId);
  const currentRange = filterRecent(trend, range);

  return (
    <section className="analytics-dashboard student-analytics" aria-labelledby="analytics-title">
      <div className="analytics-dashboard-heading">
        <div>
          <p className="section-kicker">YOUR ACADEMIC PICTURE</p>
          <h2 id="analytics-title">How are you doing?</h2>
          <p className="section-description">Follow attendance, compare subjects, and review the factors behind your academic estimate.</p>
        </div>
        <label className="analytics-filter">
          Subject
          <select aria-label="Analytics subject" value={selectedSubjectId} onChange={(event) => onSubjectSelect(event.target.value)}>
            {selectedSubjectId === "" && <option value="">No subjects available</option>}
            {summaryRows.map((row) => (
              <option key={row.subject_id} value={row.subject_id}>{row.subject_code} · {row.subject_name}</option>
            ))}
          </select>
        </label>
      </div>
      <ChartPanel
        className="analytics-primary"
        title={`${selectedSubject?.code ?? "Subject"} attendance trend`}
        description="Cumulative attendance by class session. Missing attendance records count as absent."
      >
        <div className="analytics-chart-toolbar">
          {error && <span className="analytics-chart-error" role="alert">{error}</span>}
          {loading && <span role="status">Loading session history…</span>}
          <label className="analytics-filter compact-filter">
            Sessions
            <select aria-label="Attendance trend range" value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="5">Latest 5</option>
              <option value="10">Latest 10</option>
              <option value="all">All sessions</option>
            </select>
          </label>
        </div>
        <LineChart
          label="Cumulative student attendance by session"
          series={[{ name: "Attendance", color: palette.accent, data: currentRange }]}
          referenceLines={studentRow?.requirement_percent === undefined
            ? []
            : [{ label: "Requirement", value: studentRow.requirement_percent }]}
        />
      </ChartPanel>
      <div className="analytics-support-grid">
        <ChartPanel title="Subject attendance" description="Select a subject to update your trend, marks, and risk details.">
          <BarChart
            rows={summaryRows.map((row) => ({
              id: row.subject_id,
              label: row.subject_code,
              detail: `${row.subject_name} · ${row.present_sessions} of ${row.total_sessions} sessions`,
              value: row.attendance_percent,
              valueLabel: row.attendance_percent === null ? "—" : `${row.attendance_percent}%`,
              title: `${row.subject_code}: ${row.present_sessions} of ${row.total_sessions} sessions, ${row.attendance_percent ?? "no"}% attendance`,
            }))}
            onSelect={(row) => onSubjectSelect(String(row.id))}
            selectedId={selectedSubjectId}
          />
        </ChartPanel>
        <ChartPanel
          title="Assessment performance"
          description="Your recorded score for each assessment in the selected subject."
        >
          <BarChart
            rows={assessmentRows}
            onSelect={() => { window.location.hash = "academic-progress"; }}
          />
        </ChartPanel>
      </div>
      <ChartPanel
        className="analytics-risk-panel"
        title="Academic risk estimate"
        description="Rule-based estimate from the selected subject's recorded attendance and marks."
      >
        {risk ? (
          <div className="analytics-risk-content">
            <div className={`analytics-risk-level risk-${risk.risk_level}`}>
              <span>Risk status</span>
              <strong>{risk.risk_level === "insufficient_data" ? "Awaiting data" : `${risk.risk_level[0].toUpperCase()}${risk.risk_level.slice(1)} risk`}</strong>
              {risk.risk_score !== null && <small>Score {risk.risk_score}/100</small>}
            </div>
            <div className="analytics-risk-explanation">
              <h4>Primary contributing factor</h4>
              <p className="analytics-strong-factor">{strongestFactor ?? "No contributing factor is recorded."}</p>
              {recommendation && <p><strong>Recommended next step:</strong> {recommendation}</p>}
            </div>
          </div>
        ) : <NoData />}
        <a className="analytics-detail-link" href="#academic-progress">Review academic details</a>
      </ChartPanel>
      <p className="analytics-data-note">
        {notifications.length} student notification{notifications.length === 1 ? "" : "s"} currently available in your account.
      </p>
    </section>
  );
}

function ProfessorAnalytics({
  subjects,
  selectedSubject,
  selectedSubjectId,
  onSubjectSelect,
  summaryRows,
  sessions,
  overview,
  token,
  summaryVersion,
}) {
  const [range, setRange] = useState("10");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rows = summaryRows.filter((row) => row.subject_id === selectedSubject?.id);
  const subjectSessions = useMemo(
    () => sessions.filter((session) => session.subject_id === selectedSubject?.id),
    [sessions, selectedSubject?.id],
  );
  const sessionKey = subjectSessions.map((session) => session.id).join(",");
  const studentOptions = rows;

  useEffect(() => {
    if (selectedStudentId && !rows.some((row) => String(row.student_id) === selectedStudentId)) {
      setSelectedStudentId("");
    }
  }, [selectedSubjectId, selectedStudentId, rows]);

  useEffect(() => {
    if (!sessionKey) {
      setRecords({});
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    setRecords({});
    Promise.all(subjectSessions.map(async (session) => [
      session.id,
      await requestApi(`/attendance/sessions/${session.id}/records`, { token }),
    ]))
      .then((entries) => {
        if (active) setRecords(Object.fromEntries(entries));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionKey, summaryVersion, token]);

  const trend = buildProfessorTrend(subjectSessions, records);
  const distribution = buildAttendanceDistribution(rows);
  const studentBars = rows.map((row) => ({
    id: row.student_id,
    label: row.roll_number,
    detail: `${row.student_name} · ${row.present_sessions} of ${row.total_sessions} sessions`,
    value: row.attendance_percent,
    valueLabel: row.attendance_percent === null ? "—" : `${row.attendance_percent}%`,
    tone: row.alert === "below_requirement" ? "critical" : row.alert === "warning" ? "warning" : "",
    title: `${row.student_name} (${row.roll_number}): ${row.present_sessions} of ${row.total_sessions} sessions, ${row.attendance_percent ?? "no"}% attendance, ${row.alert.replaceAll("_", " ")}`,
  }));
  const attentionRows = (overview?.risk ?? [])
    .filter((risk) =>
      risk.risk_level === "high"
      || risk.risk_level === "medium"
      || (
        risk.attendance_percent !== null
        && risk.attendance_percent <= (rows[0]?.warning_percent ?? 80)
      ),
    )
    .filter((risk) => !selectedStudentId || String(risk.student_id) === selectedStudentId)
    .sort((left, right) =>
      (left.attendance_percent ?? 101) - (right.attendance_percent ?? 101),
    );
  const assessmentRows = buildAssessmentPerformance(overview, "professor");
  const currentRange = filterRecent(trend, range);

  return (
    <section className="analytics-dashboard professor-analytics" aria-labelledby="analytics-title">
      <div className="analytics-dashboard-heading">
        <div>
          <p className="section-kicker">CLASS MONITORING</p>
          <h2 id="analytics-title">Course attendance &amp; performance</h2>
          <p className="section-description">Select an assigned course to review attendance patterns and find students who may need support.</p>
        </div>
        <label className="analytics-filter">
          Assigned course
          <select aria-label="Analytics course" value={selectedSubjectId} onChange={(event) => onSubjectSelect(event.target.value)}>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}
            {subjects.length === 0 && <option value="">No assigned courses</option>}
          </select>
        </label>
      </div>
      <ChartPanel
        className="analytics-primary"
        title={`${selectedSubject?.code ?? "Course"} student attendance`}
        description="Attendance percentage for each enrolled student. Select a student to focus the attention list."
      >
        <BarChart
          rows={studentBars}
          onSelect={(row) => setSelectedStudentId(String(row.id))}
          selectedId={selectedStudentId}
        />
      </ChartPanel>
      <div className="analytics-support-grid">
        <ChartPanel title="Attendance distribution" description="Student-course records grouped by the configured requirement and warning thresholds.">
          <BarChart
            rows={distribution.map((item) => ({
              ...item,
              id: item.key,
              value: item.count,
              valueLabel: String(item.count),
            }))}
            maxValue={Math.max(...distribution.map((item) => item.count), 1)}
          />
        </ChartPanel>
        <ChartPanel title="Session attendance trend" description="Present students divided by the enrolled roster for each class session.">
          <div className="analytics-chart-toolbar">
            {error && <span className="analytics-chart-error" role="alert">{error}</span>}
            {loading && <span role="status">Loading session history…</span>}
            <label className="analytics-filter compact-filter">
              Sessions
              <select aria-label="Session trend range" value={range} onChange={(event) => setRange(event.target.value)}>
                <option value="5">Latest 5</option>
                <option value="10">Latest 10</option>
                <option value="all">All sessions</option>
              </select>
            </label>
          </div>
          <LineChart
            label="Course attendance rate by session"
            series={[{ name: "Attendance rate", color: palette.accent, data: currentRange }]}
            referenceLines={rows[0]?.requirement_percent === undefined
              ? []
              : [{ label: "Requirement", value: rows[0].requirement_percent }]}
          />
        </ChartPanel>
      </div>
      <ChartPanel title="Assessment performance" description="Average score percentage across recorded marks for each assessment.">
        <BarChart
          rows={assessmentRows}
          onSelect={() => { window.location.hash = "academic-progress"; }}
        />
      </ChartPanel>
      <ChartPanel title="Students requiring attention" description="Actual subject-level rule-based risk and recorded attendance; assessment average shown when available.">
        <div className="analytics-attention-toolbar">
          <label className="analytics-filter">
            Student focus
            <select aria-label="Student focus" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              <option value="">All students</option>
              {studentOptions.map((row) => (
                <option key={row.student_id} value={row.student_id}>{row.roll_number} · {row.student_name}</option>
              ))}
            </select>
          </label>
        </div>
        {attentionRows.length === 0 ? (
          <NoData />
        ) : (
          <div className="academic-table-wrap analytics-table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Attendance</th><th>Risk</th><th>Assessment average</th><th>Next step</th></tr></thead>
              <tbody>
                {attentionRows.map((risk) => (
                  <tr key={risk.student_id}>
                    <td><strong>{risk.student_name}</strong><span className="table-secondary">{risk.roll_number}</span></td>
                    <td>{risk.attendance_percent === null ? "—" : `${risk.attendance_percent}%`}</td>
                    <td><span className={`risk-badge ${risk.risk_level}`}>{risk.risk_level === "insufficient_data" ? "Awaiting data" : risk.risk_level}</span></td>
                    <td>{risk.marks_percent === null ? "—" : `${risk.marks_percent}%`}</td>
                    <td>{risk.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <a className="analytics-detail-link" href="#academic-progress">Open course risk details</a>
      </ChartPanel>
    </section>
  );
}

function AdministratorAnalytics({
  subjects,
  selectedSubjectId,
  onSubjectSelect,
  summaryRows,
  sessions,
  academicOverviews,
}) {
  const [range, setRange] = useState("all");
  const activity = useMemo(
    () => buildAdminActivity(sessions, academicOverviews),
    [sessions, academicOverviews],
  );
  const activityMaxTimestamp = Date.now();
  const activityPoints = activity.points.filter((point) => {
    if (range === "all" || !activityMaxTimestamp) return true;
    const days = Number(range);
    return point.timestamp >= activityMaxTimestamp - days * 86400000
      && point.timestamp <= activityMaxTimestamp;
  });
  const riskRows = Object.values(academicOverviews)
    .flatMap((overview) => overview.risk);
  const riskCounts = ["low", "medium", "high"].map((level) => ({
    id: level,
    label: `${level[0].toUpperCase()}${level.slice(1)} risk`,
    value: riskRows.filter((item) => item.risk_level === level).length,
    valueLabel: String(riskRows.filter((item) => item.risk_level === level).length),
    tone: level === "high" ? "critical" : level === "medium" ? "warning" : "positive",
  }));
  const distribution = buildAttendanceDistribution(summaryRows);
  const courseRows = buildCourseAttendance(subjects, summaryRows);

  return (
    <section className="analytics-dashboard administrator-analytics" aria-labelledby="analytics-title">
      <div className="analytics-dashboard-heading">
        <div>
          <p className="section-kicker">INSTITUTIONAL MONITORING</p>
          <h2 id="analytics-title">Academic activity overview</h2>
          <p className="section-description">Institution-wide attendance and rule-based risk summaries from currently available course records.</p>
        </div>
      </div>
      <ChartPanel title="Academic activity trend" description="Daily class sessions started and current mark records last updated, grouped by the recorded dates.">
        <div className="analytics-chart-toolbar">
          <span className="analytics-chart-note">Trend includes session start times and the latest update time on each current mark record.</span>
          <label className="analytics-filter compact-filter">
            Date range
            <select aria-label="Activity date range" value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7">Latest 7 days</option>
              <option value="30">Latest 30 days</option>
              <option value="all">All recorded dates</option>
            </select>
          </label>
        </div>
        <LineChart
          label="Academic activity by date"
          domainMax={null}
          formatValue={(value) => `${Math.round(value)}`}
          series={[
            { name: "Class sessions", color: palette.accent, data: activityPoints.map((point) => ({ label: point.label, value: point.sessions })) },
            { name: "Mark records updated", color: palette.blue, data: activityPoints.map((point) => ({ label: point.label, value: point.marks })) },
          ]}
        />
      </ChartPanel>
      <div className="analytics-support-grid">
        <ChartPanel title="Risk distribution" description="Subject-student risk assessments returned by the academic overview API.">
          <BarChart
            rows={riskCounts}
            maxValue={Math.max(...riskCounts.map((item) => item.value), 1)}
          />
        </ChartPanel>
        <ChartPanel title="Course attendance" description="Weighted present student-session records for each course. Select a course to open its academic details.">
          <BarChart
            rows={courseRows}
            onSelect={(row) => onSubjectSelect(String(row.id))}
            selectedId={selectedSubjectId}
          />
        </ChartPanel>
      </div>
      <div className="analytics-support-grid">
        <ChartPanel title="Attendance status" description="Enrollment-level attendance grouped by requirement and warning thresholds.">
          <BarChart
            rows={distribution.map((item) => ({
              ...item,
              id: item.key,
              value: item.count,
              valueLabel: String(item.count),
            }))}
            maxValue={Math.max(...distribution.map((item) => item.count), 1)}
          />
        </ChartPanel>
        <ChartPanel title="Recent academic activity" description="Most recently held sessions and latest updates to current mark records.">
          {activity.activities.length ? (
            <ol className="analytics-activity-feed">
              {activity.activities.map((item) => (
                <li key={item.id}>
                  <span className="analytics-activity-marker" aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                    <time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : <NoData />}
          <p className="analytics-data-note">
            Institution-wide notifications and attendance-record audit history are not exposed by the current administrator APIs.
          </p>
        </ChartPanel>
      </div>
      <a className="analytics-detail-link" href="#academic-progress">Review selected course details</a>
    </section>
  );
}

export default function AnalyticsDashboard({
  role,
  subjects,
  selectedSubjectId,
  onSubjectSelect,
  summaryRows,
  sessions,
  academicOverviews,
  notifications,
  token,
}) {
  const selectedSubject = subjects.find(
    (subject) => String(subject.id) === String(selectedSubjectId),
  );
  const summaryVersion = summaryRows
    .map((row) => `${row.subject_id}:${row.student_id}:${row.present_sessions}:${row.total_sessions}:${row.attendance_percent}`)
    .join("|");

  if (role === "student") {
    return (
      <StudentAnalytics
        selectedSubject={selectedSubject}
        selectedSubjectId={selectedSubjectId}
        onSubjectSelect={onSubjectSelect}
        summaryRows={summaryRows}
        sessions={sessions}
        overview={academicOverviews[selectedSubjectId]}
        notifications={notifications}
        token={token}
        summaryVersion={summaryVersion}
      />
    );
  }

  if (role === "professor") {
    return (
      <ProfessorAnalytics
        subjects={subjects}
        selectedSubject={selectedSubject}
        selectedSubjectId={selectedSubjectId}
        onSubjectSelect={onSubjectSelect}
        summaryRows={summaryRows}
        sessions={sessions}
        overview={academicOverviews[selectedSubjectId]}
        token={token}
        summaryVersion={summaryVersion}
      />
    );
  }

  return (
    <AdministratorAnalytics
      subjects={subjects}
      selectedSubjectId={selectedSubjectId}
      onSubjectSelect={onSubjectSelect}
      summaryRows={summaryRows}
      sessions={sessions}
      academicOverviews={academicOverviews}
    />
  );
}
