import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { requestApi } from "./apiClient.js";
import AnalyticsDashboard from "./AnalyticsDashboard.jsx";

vi.mock("./apiClient.js", () => ({ requestApi: vi.fn() }));

const subjects = [
  { id: 1, code: "CS301", name: "Algorithms" },
  { id: 2, code: "CS302", name: "Networks" },
];
const summaryRows = [
  {
    subject_id: 1, subject_code: "CS301", subject_name: "Algorithms",
    student_id: 8, student_name: "Alex Morgan", roll_number: "STU008",
    total_sessions: 2, present_sessions: 1, attendance_percent: 50,
    requirement_percent: 75, warning_percent: 80, alert: "below_requirement",
  },
  {
    subject_id: 1, subject_code: "CS301", subject_name: "Algorithms",
    student_id: 9, student_name: "Jordan Lee", roll_number: "STU009",
    total_sessions: 2, present_sessions: 2, attendance_percent: 100,
    requirement_percent: 75, warning_percent: 80, alert: "ok",
  },
  {
    subject_id: 2, subject_code: "CS302", subject_name: "Networks",
    student_id: 8, student_name: "Alex Morgan", roll_number: "STU008",
    total_sessions: 0, present_sessions: 0, attendance_percent: null,
    requirement_percent: 75, warning_percent: 80, alert: "no_sessions",
  },
];
const sessions = [
  { id: 11, subject_id: 1, subject_code: "CS301", held_at: "2026-10-01T09:00:00Z", professor_name: "professor.cs" },
  { id: 12, subject_id: 1, subject_code: "CS301", held_at: "2026-10-02T09:00:00Z", professor_name: "professor.cs" },
];
const risk = [
  {
    student_id: 8, student_name: "Alex Morgan", roll_number: "STU008",
    attendance_percent: 50, marks_percent: 42, risk_score: 100, risk_level: "high",
    factors: [
      "Attendance is below the 75% requirement (50.0%).",
      "Recorded assessment average is below 50% (42.0%).",
    ],
    recommendation: "Meet with the professor to plan attendance recovery. Review recent assessment feedback.",
  },
  {
    student_id: 9, student_name: "Jordan Lee", roll_number: "STU009",
    attendance_percent: 100, marks_percent: 80, risk_score: 0, risk_level: "low",
    factors: ["Attendance is above the warning range (100.0%)."],
    recommendation: "Continue current attendance and study habits.",
  },
];
const overview = {
  subject_id: 1,
  assessments: [
    { id: 21, title: "Midterm", max_score: 40 },
    { id: 22, title: "Quiz", max_score: 20 },
  ],
  marks: [
    { id: 31, assessment_id: 21, student_id: 8, student_name: "Alex Morgan", score: 16, max_score: 40, updated_at: "2026-10-02T12:00:00Z", subject_code: "CS301", assessment_title: "Midterm" },
    { id: 32, assessment_id: 21, student_id: 9, student_name: "Jordan Lee", score: 32, max_score: 40, updated_at: "2026-10-02T12:00:00Z", subject_code: "CS301", assessment_title: "Midterm" },
  ],
  risk,
};
const academicOverviews = { "1": overview, "2": { subject_id: 2, assessments: [], marks: [], risk: [] } };

afterEach(() => {
  cleanup();
  requestApi.mockReset();
});

function renderDashboard(role, props = {}) {
  const selectedSessions = props.sessions ?? sessions;
  requestApi.mockImplementation(async (path) => {
    const sessionId = Number(path.match(/sessions\/(\d+)\/records/)?.[1]);
    return sessionId === 11
      ? [{ student_id: 8, student_name: "Alex Morgan", status: "present" }, { student_id: 9, student_name: "Jordan Lee", status: "present" }]
      : [{ student_id: 8, student_name: "Alex Morgan", status: "absent" }, { student_id: 9, student_name: "Jordan Lee", status: "present" }];
  });
  return render(
    <AnalyticsDashboard
      role={role}
      subjects={subjects}
      selectedSubjectId="1"
      onSubjectSelect={props.onSubjectSelect ?? vi.fn()}
      summaryRows={summaryRows}
      sessions={selectedSessions}
      academicOverviews={academicOverviews}
      notifications={props.notifications ?? []}
      token="demo-token"
    />,
  );
}

describe("role analytics dashboards", () => {
  it("shows student attendance, subject comparison, assessment results, and risk from returned data", async () => {
    const trendSessions = Array.from({ length: 12 }, (_, index) => ({
      id: 101 + index,
      subject_id: 1,
      subject_code: "CS301",
      held_at: `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
      professor_name: "professor.cs",
    }));
    renderDashboard("student", {
      notifications: [{ id: 1 }, { id: 2 }],
      sessions: trendSessions,
    });

    expect(screen.getByRole("heading", { name: "CS301 attendance trend" })).toBeInTheDocument();
    await waitFor(() => expect(requestApi).toHaveBeenCalledTimes(12));
    expect(document.querySelectorAll(".analytics-line-point")).toHaveLength(10);
    expect(document.querySelector(".analytics-reference-line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CS301: 1 of 2 sessions/ })).toBeInTheDocument();
    expect(screen.getByText("16/40")).toBeInTheDocument();
    expect(screen.getByText(/Attendance is below the 75% requirement/)).toBeInTheDocument();
    expect(screen.getByText("Meet with the professor to plan attendance recovery."))
      .toBeInTheDocument();
    expect(screen.getByText(/2 student notifications/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Attendance trend range"), { target: { value: "5" } });
    expect(screen.getByLabelText("Attendance trend range")).toHaveValue("5");
    expect(document.querySelectorAll(".analytics-line-point")).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("Attendance trend range"), { target: { value: "all" } });
    expect(document.querySelectorAll(".analytics-line-point")).toHaveLength(12);
    fireEvent.click(screen.getByLabelText("Cumulative student attendance by session").querySelector("circle"));
    expect(await screen.findByRole("status")).toHaveTextContent(/Attendance · Oct 1 · session 101/);
  });

  it("filters professor course data, allows student focus, and shows actual roster records", async () => {
    const onSubjectSelect = vi.fn();
    renderDashboard("professor", { onSubjectSelect });

    expect(await screen.findByText("Students requiring attention")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alex Morgan \(STU008\): 1 of 2 sessions/ }))
      .toBeInTheDocument();
    expect(screen.getByText("Above requirement")).toBeInTheDocument();
    expect(screen.getByText("Near requirement")).toBeInTheDocument();
    expect(screen.getByText("Below requirement")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Analytics course"), { target: { value: "2" } });
    expect(onSubjectSelect).toHaveBeenCalledWith("2");
    fireEvent.change(screen.getByLabelText("Student focus"), { target: { value: "8" } });
    expect(screen.getByLabelText("Student focus")).toHaveValue("8");
    expect(requestApi).toHaveBeenCalledWith("/attendance/sessions/11/records", { token: "demo-token" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Assessment performance" })).toBeInTheDocument());
  });

  it("shows administrator activity derived from sessions and marks and supports course drill-down", async () => {
    const onSubjectSelect = vi.fn();
    renderDashboard("administrator", { onSubjectSelect });

    expect(screen.getByRole("heading", { name: "Academic activity trend" })).toBeInTheDocument();
    expect(screen.getByText("Risk distribution")).toBeInTheDocument();
    expect(screen.getByText("Course attendance")).toBeInTheDocument();
    expect(screen.getByText("Recent academic activity")).toBeInTheDocument();
    expect(screen.getAllByText(/CS301 · session started by professor.cs/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /CS301: 3 of 4 student-session records present/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Activity date range"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /CS301: 3 of 4 student-session records present/ }));
    expect(onSubjectSelect).toHaveBeenCalledWith("1");
    expect(screen.getByText(/Institution-wide notifications and attendance-record audit history are not exposed/))
      .toBeInTheDocument();
  });
});
