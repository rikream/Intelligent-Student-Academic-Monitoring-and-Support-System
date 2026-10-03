import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { requestApi } from "./apiClient.js";
import AcademicWorkspace from "./AcademicWorkspace.jsx";

vi.mock("./apiClient.js", () => ({ requestApi: vi.fn() }));

const subjects = [{ id: 1, code: "CS301", name: "Algorithms" }];
const overview = {
  subject_id: 1,
  subject_code: "CS301",
  subject_name: "Algorithms",
  assessments: [{ id: 2, title: "Midterm", max_score: 40 }],
  marks: [{
    id: 3,
    assessment_id: 2,
    student_id: 1,
    roll_number: "DEMO001",
    student_name: "Alex Morgan",
    subject_id: 1,
    subject_code: "CS301",
    subject_name: "Algorithms",
    assessment_title: "Midterm",
    score: 32,
    max_score: 40,
    updated_at: "2026-10-02T10:00:00Z",
  }],
  risk: [{
    student_id: 1,
    roll_number: "DEMO001",
    student_name: "Alex Morgan",
    attendance_percent: 82,
    marks_percent: 80,
    risk_score: 0,
    risk_level: "low",
    factors: ["Attendance is above the warning range.", "Recorded assessment average is 80%."],
    recommendation: "Continue the current study and attendance habits.",
  }],
};

describe("academic workspace", () => {
  beforeEach(() => {
    requestApi.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  it("shows a student's marks, explainable risk and private notifications", async () => {
    requestApi.mockImplementation(async (path) => {
      if (path.endsWith("/overview")) return overview;
      if (path === "/notifications") {
        return [{
          id: 9,
          title: "New assessment mark",
          message: "CS301 · Midterm: 32 / 40",
          read_at: null,
          created_at: "2026-10-02T10:00:00Z",
        }];
      }
      if (path.endsWith("/read")) return { id: 9, read_at: "2026-10-02T11:00:00Z" };
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <AcademicWorkspace
        token="student-token"
        role="student"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    expect(await screen.findByText("32 / 40")).toBeInTheDocument();
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("Low risk")).toBeInTheDocument();
    expect(screen.getByText("CS301 · Midterm: 32 / 40")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => {
      expect(requestApi).toHaveBeenCalledWith("/notifications/9/read", {
        token: "student-token",
        method: "PUT",
      });
    });
  });

  it("lets a professor save an entered mark through the API", async () => {
    const professorOverview = { ...overview, marks: [] };
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/overview")) return professorOverview;
      if (path === "/academic/marks" && options.method === "POST") return overview.marks[0];
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    const riskSummary = await screen.findByRole("region", {
      name: "Subject risk distribution",
    });
    expect(riskSummary).toHaveTextContent("Low1");
    expect(riskSummary).toHaveTextContent("Medium0");
    expect(screen.queryByRole("img", { name: /Risk distribution:/ }))
      .not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Score (max 40)"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save mark" }));

    await waitFor(() => {
      expect(requestApi).toHaveBeenCalledWith("/academic/marks", expect.objectContaining({
        token: "professor-token",
        method: "POST",
        body: JSON.stringify({
          assessment_id: 2,
          student_id: 1,
          score: 35,
        }),
      }));
    });
    expect(await screen.findByText("Student mark saved.")).toBeInTheDocument();
  });

  it("requires a reviewed voice mark proposal before saving", async () => {
    const professorOverview = { ...overview, marks: [] };
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/overview")) return professorOverview;
      if (path === "/academic/marks" && options.method === "POST") return overview.marks[0];
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    const transcript = await screen.findByLabelText("Editable speech transcript / typed fallback");
    fireEvent.change(transcript, { target: { value: "Alex Morgan got 18 marks" } });
    fireEvent.click(screen.getByRole("button", { name: "Review mark" }));
    expect(await screen.findByRole("region", { name: "Voice mark confirmation" }))
      .toHaveTextContent("18 / 40");
    expect(requestApi).not.toHaveBeenCalledWith(
      "/academic/marks",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm & Save" }));
    await waitFor(() => expect(requestApi).toHaveBeenCalledWith(
      "/academic/marks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ assessment_id: 2, student_id: 1, score: 18 }),
      }),
    ));
    expect(await screen.findByText("Confirmed spoken mark saved; the student notification was created."))
      .toBeInTheDocument();
  });

  it("converts a browser speech result into a proposal without saving it", async () => {
    let recognition;
    class FakeSpeechRecognition {
      start() {
        recognition = this;
      }

      abort() {}
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/overview")) return { ...overview, marks: [] };
      if (path === "/academic/marks" && options.method === "POST") return overview.marks[0];
      throw new Error(`Unexpected request: ${path}`);
    });
    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start microphone" }));
    recognition.onresult({ results: [[{ transcript: "Alex Morgan got 18 marks" }]] });
    expect(await screen.findByRole("region", { name: "Voice mark confirmation" }))
      .toHaveTextContent("18 / 40");
    expect(screen.getByLabelText("Editable speech transcript / typed fallback"))
      .toHaveValue("Alex Morgan got 18 marks");
    expect(requestApi).not.toHaveBeenCalledWith(
      "/academic/marks",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("cancels a voice proposal without saving and reports an unknown student", async () => {
    requestApi.mockImplementation(async (path) => {
      if (path.endsWith("/overview")) return { ...overview, marks: [] };
      throw new Error(`Unexpected request: ${path}`);
    });
    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    const transcript = await screen.findByLabelText("Editable speech transcript / typed fallback");
    fireEvent.click(screen.getByRole("button", { name: "Start microphone" }));
    expect(await screen.findByText(/Speech recognition is unsupported/))
      .toBeInTheDocument();
    fireEvent.change(transcript, { target: { value: "Alex Morgan 18" } });
    fireEvent.click(screen.getByRole("button", { name: "Review mark" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Proposal cancelled. No mark was saved."))
      .toBeInTheDocument();
    expect(requestApi).not.toHaveBeenCalledWith(
      "/academic/marks",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.change(transcript, { target: { value: "Unknown Person got 18" } });
    fireEvent.click(screen.getByRole("button", { name: "Review mark" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No enrolled student matched/);
  });

  it("surfaces mark API failures instead of reporting a successful save", async () => {
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/overview")) return { ...overview, marks: [] };
      if (path === "/academic/marks" && options.method === "POST") {
        throw new Error("The API is unavailable.");
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    fireEvent.change(
      await screen.findByLabelText("Editable speech transcript / typed fallback"),
      { target: { value: "Alex Morgan got 18 marks" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Review mark" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm & Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The API is unavailable.");
    expect(await screen.findByText(/could not be saved/)).toBeInTheDocument();
    expect(screen.queryByText("Confirmed spoken mark saved; the student notification was created."))
      .not.toBeInTheDocument();
  });

  it("confirms mark updates and lets professors inspect audit history", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/overview")) return overview;
      if (path === "/academic/marks" && options.method === "POST") return overview.marks[0];
      if (path === "/academic/marks/3/audit") return [];
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <AcademicWorkspace
        token="professor-token"
        role="professor"
        subjects={subjects}
        selectedSubjectId="1"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Score (max 40)"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update mark" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("student will be notified"));
    await waitFor(() => expect(requestApi).toHaveBeenCalledWith(
      "/academic/marks",
      expect.objectContaining({ method: "POST" }),
    ));
    fireEvent.click(screen.getByRole("button", { name: "View mark history" }));
    expect(await screen.findByText("No edits have been recorded for this mark."))
      .toBeInTheDocument();
  });
});
