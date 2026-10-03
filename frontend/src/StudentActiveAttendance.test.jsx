import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { requestApi, getFaceDescriptor } = vi.hoisted(() => ({
  requestApi: vi.fn(),
  getFaceDescriptor: vi.fn(),
}));

vi.mock("./apiClient.js", () => ({ requestApi }));
vi.mock("./faceRecognition.js", () => ({
  getFaceDescriptor,
  loadFaceModels: vi.fn(),
}));

import StudentActiveAttendance from "./StudentActiveAttendance.jsx";

const session = {
  id: 7,
  subject_id: 1,
  subject_code: "CS301",
  subject_name: "Data Structures",
  held_at: "2026-10-02T10:00:00Z",
  is_active: true,
  professor_name: "professor.cs",
  student_status: null,
};
const stream = { getTracks: () => [{ stop: vi.fn() }] };
const faceCandidate = {
  student_id: 1,
  roll_number: "DEMO001",
  student_name: "Fictional Student",
  distance: 0.1,
};

beforeEach(() => {
  requestApi.mockReset();
  getFaceDescriptor.mockReset().mockResolvedValue(Array(128).fill(0.01));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete navigator.mediaDevices;
});

describe("StudentActiveAttendance", () => {
  it("shows a clear empty state and does not open the camera", () => {
    render(
      <StudentActiveAttendance
        token="student-token"
        sessions={[]}
        onRefresh={vi.fn()}
        onSubmitAttendance={vi.fn()}
      />,
    );

    expect(screen.getByText("No active attendance sessions")).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("opens camera only on action, verifies own face, then submits and refreshes", async () => {
    requestApi.mockResolvedValue({
      status: "proposed",
      candidates: [faceCandidate],
    });
    const onSubmitAttendance = vi.fn().mockResolvedValue("saved");
    render(
      <StudentActiveAttendance
        token="student-token"
        sessions={[session]}
        onRefresh={vi.fn()}
        onSubmitAttendance={onSubmitAttendance}
      />,
    );

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText("professor.cs")).toBeInTheDocument();
    expect(screen.getByText("Data Structures")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join & Mark Attendance" }));

    await waitFor(() => {
      expect(requestApi).toHaveBeenCalledWith(
        "/attendance/sessions/7/face-match",
        expect.objectContaining({
          token: "student-token",
          method: "POST",
          body: JSON.stringify({ descriptor: Array(128).fill(0.01) }),
        }),
      );
    });
    expect(await screen.findByText(/Face verified: Fictional Student \(DEMO001\)/))
      .toBeInTheDocument();
    expect(onSubmitAttendance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and mark present" }));
    await waitFor(() => {
      expect(onSubmitAttendance).toHaveBeenCalledWith(7, 1);
    });
    expect(await screen.findByText("Attendance marked successfully.")).toBeInTheDocument();
  });

  it("handles camera denial and unrecognized faces without submitting", async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error("permission denied"));
    const onSubmitAttendance = vi.fn();
    const { rerender } = render(
      <StudentActiveAttendance
        token="student-token"
        sessions={[session]}
        onRefresh={vi.fn()}
        onSubmitAttendance={onSubmitAttendance}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Join & Mark Attendance" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission denied/);
    expect(onSubmitAttendance).not.toHaveBeenCalled();

    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
    requestApi.mockResolvedValue({ status: "unknown", candidates: [] });
    rerender(
      <StudentActiveAttendance
        token="student-token"
        sessions={[session]}
        onRefresh={vi.fn()}
        onSubmitAttendance={onSubmitAttendance}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Join & Mark Attendance" }));
    expect(await screen.findByText(/Face not recognized/)).toBeInTheDocument();
    expect(onSubmitAttendance).not.toHaveBeenCalled();
  });

  it("does not offer another attendance write when this student is already recorded", () => {
    render(
      <StudentActiveAttendance
        token="student-token"
        sessions={[{ ...session, student_status: "present" }]}
        onRefresh={vi.fn()}
        onSubmitAttendance={vi.fn()}
      />,
    );

    expect(screen.getByText("Attendance recorded: present")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join & Mark Attendance" }))
      .not.toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
