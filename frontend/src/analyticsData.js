function chronological(sessions) {
  return [...sessions].sort(
    (left, right) =>
      new Date(left.held_at).getTime() - new Date(right.held_at).getTime()
      || left.id - right.id,
  );
}

function sessionLabel(session) {
  const date = new Date(session.held_at);
  return `${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)} · session ${session.id}`;
}

export function buildAttendanceDistribution(rows) {
  const distribution = [
    { key: "above", label: "Above requirement", count: 0, tone: "positive" },
    { key: "near", label: "Near requirement", count: 0, tone: "warning" },
    { key: "below", label: "Below requirement", count: 0, tone: "critical" },
  ];

  rows.forEach((row) => {
    if (row.attendance_percent === null || row.attendance_percent === undefined) {
      return;
    }
    if (row.attendance_percent < row.requirement_percent) {
      distribution[2].count += 1;
    } else if (row.attendance_percent <= row.warning_percent) {
      distribution[1].count += 1;
    } else {
      distribution[0].count += 1;
    }
  });

  return distribution;
}

export function buildCourseAttendance(subjects, summaryRows) {
  return subjects.map((subject) => {
    const rows = summaryRows.filter((row) => row.subject_id === subject.id);
    const total = rows.reduce((sum, row) => sum + row.total_sessions, 0);
    const present = rows.reduce((sum, row) => sum + row.present_sessions, 0);
    return {
      id: subject.id,
      label: subject.code,
      detail: subject.name,
      value: total ? (present / total) * 100 : null,
      valueLabel: total ? `${Math.round((present / total) * 100)}%` : "—",
      title: total
        ? `${subject.code}: ${present} of ${total} student-session records present`
        : `${subject.code}: no session data`,
    };
  });
}

export function buildAssessmentPerformance(overview, role, studentId) {
  if (!overview) return [];
  return overview.assessments.map((assessment) => {
    const marks = overview.marks.filter((mark) =>
      mark.assessment_id === assessment.id
      && (role !== "student" || mark.student_id === studentId),
    );
    if (marks.length === 0) {
      return {
        id: assessment.id,
        label: assessment.title,
        value: null,
        valueLabel: "No marks",
        title: `${assessment.title}: no marks recorded`,
      };
    }
    const scoreTotal = marks.reduce((total, mark) => total + mark.score, 0);
    const maxTotal = marks.reduce((total, mark) => total + mark.max_score, 0);
    const percent = maxTotal ? (scoreTotal / maxTotal) * 100 : null;
    const averageScore = scoreTotal / marks.length;
    const maximum = marks[0].max_score;
    return {
      id: assessment.id,
      label: assessment.title,
      value: percent,
      valueLabel: role === "student"
        ? `${averageScore}/${maximum}`
        : `${Math.round(percent)}%`,
      title: role === "student"
        ? `${assessment.title}: ${averageScore} of ${maximum}`
        : `${assessment.title}: ${scoreTotal} of ${maxTotal} points across ${marks.length} recorded marks`,
      detail: role === "student"
        ? "Your result"
        : `${marks.length} recorded ${marks.length === 1 ? "mark" : "marks"}`,
    };
  });
}

export function buildStudentTrend(sessions, recordsBySession, studentId) {
  let presentCount = 0;
  return chronological(sessions).map((session, index) => {
    const record = (recordsBySession[session.id] ?? []).find(
      (item) => item.student_id === studentId,
    );
    const status = record?.status === "present" ? "present" : "absent";
    if (status === "present") presentCount += 1;
    const percent = (presentCount / (index + 1)) * 100;
    return {
      label: sessionLabel(session),
      value: percent,
      details: `${status === "present" ? "Present" : "Absent"} · ${presentCount} of ${index + 1} sessions · ${percent.toFixed(1)}% cumulative attendance`,
      title: `${sessionLabel(session)}: ${status}; cumulative attendance ${percent.toFixed(1)}%`,
    };
  });
}

export function buildProfessorTrend(sessions, recordsBySession) {
  return chronological(sessions).map((session) => {
    const records = recordsBySession[session.id] ?? [];
    const eligible = records.length;
    const present = records.filter((record) => record.status === "present").length;
    const percent = eligible ? (present / eligible) * 100 : null;
    return {
      label: sessionLabel(session),
      value: percent,
      details: `${present} present · ${eligible} enrolled · ${percent === null ? "no attendance records" : `${percent.toFixed(1)}% attendance`}`,
      title: `${sessionLabel(session)}: ${present} present of ${eligible} eligible students`,
    };
  });
}

export function prioritizeRiskFactor(risk) {
  if (!risk?.factors?.length) return null;
  const critical = risk.factors.find((factor) =>
    /below the 75% requirement|below 50%/i.test(factor),
  );
  if (critical) return critical;
  const attention = risk.factors.find((factor) =>
    /close to the 75% requirement|needs attention/i.test(factor),
  );
  return attention ?? risk.factors[0];
}

export function buildAdminActivity(sessions, academicOverviews) {
  const daily = new Map();
  const activities = [];
  const addDay = (timestamp, field) => {
    const date = new Date(timestamp);
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const existing = daily.get(key) ?? {
      label: new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date),
      sessions: 0,
      marks: 0,
      timestamp: date.getTime(),
    };
    existing[field] += 1;
    daily.set(key, existing);
  };

  sessions.forEach((session) => {
    addDay(session.held_at, "sessions");
    activities.push({
      timestamp: session.held_at,
      label: "Class session",
      detail: `${session.subject_code} · session started by ${session.professor_name}`,
      id: `session-${session.id}`,
    });
  });
  Object.values(academicOverviews).forEach((overview) => {
    overview.marks.forEach((mark) => {
      addDay(mark.updated_at, "marks");
      activities.push({
        timestamp: mark.updated_at,
        label: "Mark record updated",
        detail: `${mark.student_name} · ${mark.subject_code} · ${mark.assessment_title}`,
        id: `mark-${mark.id}`,
      });
    });
  });

  const points = [...daily.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-30);
  activities.sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
  return { points, activities: activities.slice(0, 8) };
}
