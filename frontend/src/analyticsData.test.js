import { describe, expect, it } from "vitest";
import {
  buildAdminActivity,
  buildAssessmentPerformance,
  buildAttendanceDistribution,
  buildCourseAttendance,
  buildProfessorTrend,
  buildStudentTrend,
  prioritizeRiskFactor,
} from "./analyticsData.js";

const sessions = [
  { id: 2, held_at: "2026-10-02T10:00:00Z" },
  { id: 1, held_at: "2026-10-01T10:00:00Z" },
];

describe("analytics data transformations", () => {
  it("uses backend requirement and warning thresholds for attendance distribution", () => {
    expect(buildAttendanceDistribution([
      { attendance_percent: 90, requirement_percent: 75, warning_percent: 80 },
      { attendance_percent: 80, requirement_percent: 75, warning_percent: 80 },
      { attendance_percent: 74, requirement_percent: 75, warning_percent: 80 },
      { attendance_percent: null, requirement_percent: 75, warning_percent: 80 },
    ])).toMatchObject([
      { key: "above", count: 1 },
      { key: "near", count: 1 },
      { key: "below", count: 1 },
    ]);
  });

  it("calculates weighted course attendance only from returned enrollment summaries", () => {
    expect(buildCourseAttendance(
      [{ id: 1, code: "CS301", name: "Algorithms" }],
      [
        { subject_id: 1, total_sessions: 4, present_sessions: 3 },
        { subject_id: 1, total_sessions: 4, present_sessions: 2 },
      ],
    )[0]).toMatchObject({
      value: 62.5,
      valueLabel: "63%",
      title: "CS301: 5 of 8 student-session records present",
    });
    expect(buildCourseAttendance(
      [{ id: 1, code: "CS301", name: "Algorithms" }],
      [],
    )[0].value).toBeNull();
  });

  it("builds cumulative student attendance in session order and treats missing rows as absent", () => {
    expect(buildStudentTrend(sessions, {
      1: [{ student_id: 8, status: "present" }],
      2: [],
    }, 8).map((point) => [point.value, point.details])).toEqual([
      [100, expect.stringContaining("Present · 1 of 1 sessions")],
      [50, expect.stringContaining("Absent · 1 of 2 sessions")],
    ]);
  });

  it("calculates professor session rates from present and eligible roster records", () => {
    expect(buildProfessorTrend(sessions, {
      1: [
        { status: "present" },
        { status: "absent" },
      ],
      2: [{ status: "present" }],
    }).map((point) => point.value)).toEqual([50, 100]);
  });

  it("uses actual assessment scores for student results and professor averages", () => {
    const overview = {
      assessments: [{ id: 1, title: "Midterm" }, { id: 2, title: "Quiz" }],
      marks: [
        { assessment_id: 1, student_id: 8, score: 30, max_score: 40 },
        { assessment_id: 1, student_id: 9, score: 20, max_score: 40 },
      ],
    };
    expect(buildAssessmentPerformance(overview, "student", 8)).toMatchObject([
      { value: 75, valueLabel: "30/40" },
      { value: null, valueLabel: "No marks" },
    ]);
    expect(buildAssessmentPerformance(overview, "professor")[0]).toMatchObject({
      value: 62.5,
      valueLabel: "63%",
      title: "Midterm: 50 of 80 points across 2 recorded marks",
    });
  });

  it("prioritizes a high-contribution risk factor and groups only actual activity dates", () => {
    expect(prioritizeRiskFactor({
      factors: [
        "Attendance is close to the 75% requirement (78.0%).",
        "Recorded assessment average is below 50% (42.0%).",
      ],
    })).toContain("below 50%");

    const activity = buildAdminActivity(
      [{ id: 3, subject_code: "CS301", professor_name: "professor.cs", held_at: "2026-10-03T10:00:00Z" }],
      {
        "1": {
          marks: [{
            id: 7,
            student_name: "Fictional Student",
            subject_code: "CS301",
            assessment_title: "Midterm",
            updated_at: "2026-10-03T12:00:00Z",
          }],
        },
      },
    );
    expect(activity.points).toHaveLength(1);
    expect(activity.points[0]).toMatchObject({ sessions: 1, marks: 1 });
    expect(activity.activities).toHaveLength(2);
  });
});
