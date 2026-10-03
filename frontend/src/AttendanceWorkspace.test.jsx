import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AttendanceWorkspace from "./AttendanceWorkspace.jsx";

function createApiServer(initialSessions = []) {
  const sessions = [...initialSessions];
  const attendance = new Map();
  let nextSessionId = 1;
  let nextRecordId = 1;

  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = new URL(url, "http://localhost").pathname;
    const method = options.method ?? "GET";
    const json = options.body ? JSON.parse(options.body) : undefined;
    const response = (body, status = 200) => ({
      ok: status < 400,
      status,
      json: async () => body,
    });

    if (path === "/api/subjects") {
      return response([{ id: 1, code: "CS301", name: "Data Structures" }]);
    }
    if (path === "/api/enrollments") {
      return response([{
        id: 1,
        subject_id: 1,
        student_id: 1,
        roll_number: "DEMO001",
        student_name: "Fictional Student",
      }]);
    }
    if (path === "/api/attendance/sessions" && method === "GET") {
      return response(sessions);
    }
    if (path === "/api/attendance/sessions" && method === "POST") {
      const created = {
        id: nextSessionId++,
        subject_id: json.subject_id,
        subject_code: "CS301",
        subject_name: "Data Structures",
        held_at: "2026-10-02T10:00:00Z",
        ended_at: null,
        is_active: true,
        professor_name: "professor.cs",
        student_status: null,
      };
      sessions.push(created);
      return response(created, 201);
    }
    const academicOverviewMatch = path.match(
      /^\/api\/academic\/subjects\/(\d+)\/overview$/,
    );
    if (academicOverviewMatch) {
      const totalSessions = sessions.filter(
        (session) => session.subject_id === Number(academicOverviewMatch[1]),
      ).length;
      const presentSessions = [...attendance.values()].filter(
        (record) => record.status === "present",
      ).length;
      const attendancePercent = totalSessions
        ? Math.round((presentSessions * 10000) / totalSessions) / 100
        : null;
      return response({
        subject_id: Number(academicOverviewMatch[1]),
        subject_code: "CS301",
        subject_name: "Data Structures",
        assessments: [],
        marks: [],
        risk: [{
          student_id: 1,
          roll_number: "DEMO001",
          student_name: "Fictional Student",
          attendance_percent: attendancePercent,
          marks_percent: null,
          risk_score: attendancePercent === null ? null : attendancePercent < 75 ? 50 : 0,
          risk_level: attendancePercent === null ? "insufficient_data" : attendancePercent < 75 ? "high" : "low",
          factors: ["Test fixture risk summary."],
          recommendation: "Test fixture recommendation.",
        }],
      });
    }
    const endSessionMatch = path.match(/^\/api\/attendance\/sessions\/(\d+)\/end$/);
    if (endSessionMatch && method === "POST") {
      const current = sessions.find((item) => item.id === Number(endSessionMatch[1]));
      current.ended_at = "2026-10-02T11:00:00Z";
      current.is_active = false;
      return response(current);
    }
    if (path === "/api/attendance/subjects/1/summary") {
      const presentSessions = [...attendance.values()].filter(
        (record) => record.status === "present",
      ).length;
      const totalSessions = sessions.length;
      const percentage = totalSessions
        ? Math.round((presentSessions * 10000) / totalSessions) / 100
        : null;
      return response([{
        student_id: 1,
        roll_number: "DEMO001",
        student_name: "Fictional Student",
        subject_id: 1,
        subject_code: "CS301",
        subject_name: "Data Structures",
        total_sessions: totalSessions,
        present_sessions: presentSessions,
        attendance_percent: percentage,
        requirement_percent: 75,
        warning_percent: 80,
        alert: percentage === null
          ? "no_sessions"
          : percentage < 75
            ? "below_requirement"
            : percentage <= 80
              ? "warning"
              : "ok",
      }]);
    }
    const recordsMatch = path.match(/^\/api\/attendance\/sessions\/(\d+)\/records$/);
    if (recordsMatch && method === "GET") {
      const record = attendance.get(Number(recordsMatch[1]));
      return response([{
        student_id: 1,
        roll_number: "DEMO001",
        student_name: "Fictional Student",
        status: record?.status ?? null,
      }]);
    }
    if (path === "/api/attendance/sessions/1/face-templates") {
      return response([{ student_id: 1, registered: false }]);
    }
    if (recordsMatch && method === "POST") {
      const sessionId = Number(recordsMatch[1]);
      if (attendance.has(sessionId)) {
        return response({ detail: "Attendance already exists." }, 409);
      }
      attendance.set(sessionId, { id: nextRecordId++, status: json.status });
      return response({ status: json.status }, 201);
    }
    const correctionMatch = path.match(
      /^\/api\/attendance\/sessions\/(\d+)\/records\/(\d+)$/,
    );
    if (correctionMatch && method === "PUT") {
      const record = attendance.get(Number(correctionMatch[1]));
      if (!record) {
        return response({ detail: "Attendance record was not found." }, 404);
      }
      record.status = json.status;
      return response({ status: record.status });
    }
    return response({ detail: `Unhandled test request: ${method} ${path}` }, 404);
  });

  return { fetchMock };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("attendance workspace", () => {
  it("records professor manual attendance and refreshes the subject percentage", async () => {
    const { fetchMock } = createApiServer();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="test-token"
        user={{ username: "professor.cs", role: "professor" }}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start class session" }));
    await waitFor(() => expect(screen.getByLabelText("Existing session")).toHaveValue("1"));
    fireEvent.click(await screen.findByRole("button", { name: "Mark present" }));

    await waitFor(() => {
      expect(within(document.querySelector("#attendance")).getByText("100%", { exact: true }))
        .toBeInTheDocument();
      expect(screen.getByText("On track")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attendance/sessions/1/records",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps the selected attendance session and workspace mounted after marking present", async () => {
    const { fetchMock } = createApiServer();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="test-token"
        user={{ username: "professor.cs", role: "professor" }}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start class session" }));
    const sessionSelect = screen.getByLabelText("Existing session");
    await waitFor(() => expect(sessionSelect).toHaveValue("1"));
    fireEvent.click(await screen.findByRole("button", { name: "Mark present" }));

    await screen.findByText("DEMO001 marked present.");
    expect(sessionSelect).toHaveValue("1");
    expect(screen.getByText("present")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Take attendance" })).toBeInTheDocument();
    expect(screen.queryByText("Loading your academic workspace..."))
      .not.toBeInTheDocument();
  });

  it("allows correcting attendance and reflects the threshold warning", async () => {
    const { fetchMock } = createApiServer();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="test-token"
        user={{ username: "professor.cs", role: "professor" }}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start class session" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark present" }));
    fireEvent.click(await screen.findByRole("button", { name: "Correct to absent" }));

    await waitFor(() => {
      expect(within(document.querySelector("#attendance")).getByText("0%", { exact: true }))
        .toBeInTheDocument();
      expect(screen.getByText("Below 75%")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attendance/sessions/1/records/1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("lets professors explicitly end a session and shows its ended state", async () => {
    const { fetchMock } = createApiServer();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="test-token"
        user={{ username: "professor.cs", role: "professor" }}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start class session" }));
    fireEvent.click(await screen.findByRole("button", { name: "End class session" }));

    await waitFor(() => {
      expect(screen.getByText(/Session 1: CS301/)).toHaveTextContent("Ended");
      expect(screen.queryByRole("button", { name: "End class session" }))
        .not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attendance/sessions/1/end",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("selects the latest active session and includes students without templates", async () => {
    const activeSession = {
      id: 1,
      subject_id: 1,
      subject_code: "CS301",
      subject_name: "Data Structures",
      held_at: "2026-10-02T10:00:00Z",
      ended_at: null,
      is_active: true,
      professor_name: "professor.cs",
      student_status: null,
    };
    const { fetchMock } = createApiServer([activeSession]);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="test-token"
        user={{ username: "professor.cs", role: "professor" }}
        onLogout={() => {}}
      />,
    );

    const studentDropdown = await screen.findByRole("combobox", {
      name: "Student face template",
    });
    expect(await within(studentDropdown).findByRole("option", { name: "DEMO001 · Fictional Student" }))
      .toBeInTheDocument();
    await waitFor(() => expect(studentDropdown).toHaveValue("1"));
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === "/api/attendance/sessions/1/face-templates",
      ),
    ).toBe(true);
  });

  it("fetches enrolled student sessions and displays active sessions without opening a camera", async () => {
    const activeSession = {
      id: 8,
      subject_id: 1,
      subject_code: "CS301",
      subject_name: "Data Structures",
      held_at: "2026-10-02T10:00:00Z",
      ended_at: null,
      is_active: true,
      professor_name: "professor.cs",
      student_status: null,
    };
    const { fetchMock } = createApiServer([activeSession]);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AttendanceWorkspace
        token="student-token"
        user={{ username: "student.001", role: "student" }}
        onLogout={() => {}}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Active Attendance Session" }))
      .toBeInTheDocument();
    expect(screen.getByText("professor.cs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join & Mark Attendance" }))
      .toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attendance/sessions",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
