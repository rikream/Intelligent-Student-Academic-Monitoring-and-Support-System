import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { requestApi, getFaceDescriptor, loadFaceModels } = vi.hoisted(() => ({
  requestApi: vi.fn(),
  getFaceDescriptor: vi.fn(),
  loadFaceModels: vi.fn(),
}));

vi.mock("./apiClient.js", () => ({ requestApi }));
vi.mock("./faceRecognition.js", () => ({ getFaceDescriptor, loadFaceModels }));

import FaceAttendancePanel from "./FaceAttendancePanel.jsx";

const roster = [
  {
    student_id: 1,
    roll_number: "DEMO001",
    student_name: "Aarav Rao",
    status: null,
  },
];
const descriptor = Array(128).fill(0.01);
const stream = { getTracks: () => [{ stop: vi.fn() }] };

beforeEach(() => {
  requestApi.mockReset();
  getFaceDescriptor.mockReset().mockResolvedValue(descriptor);
  loadFaceModels.mockReset().mockResolvedValue();
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

describe("FaceAttendancePanel", () => {
  it("requires consent to enroll and review to confirm a proposed face match", async () => {
    requestApi.mockImplementation(async (path, options = {}) => {
      if (path.endsWith("/face-templates")) {
        return [{ student_id: 1, registered: false }];
      }
      if (path.endsWith("/face-match")) {
        return {
          status: "proposed",
          candidates: [{
            student_id: 1,
            roll_number: "DEMO001",
            student_name: "Aarav Rao",
            distance: 0.12,
          }],
        };
      }
      if (options.method === "PUT") {
        return { student_id: 1, registered: true };
      }
      return {};
    });
    const onConfirmPresent = vi.fn().mockResolvedValue(true);
    render(
      <FaceAttendancePanel
        token="test-token"
        subjectId={1}
        sessionId={5}
        roster={roster}
        onConfirmPresent={onConfirmPresent}
      />,
    );

    const register = await screen.findByRole("button", { name: "Register consented face" });
    expect(register).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/people in the camera view/));
    fireEvent.click(screen.getByRole("button", { name: "Start face camera" }));
    await screen.findByText("Camera is active. Frames are not uploaded or stored.");
    fireEvent.click(await screen.findByLabelText(/explicitly consented/));
    await waitFor(() => expect(register).toBeEnabled());
    fireEvent.click(register);

    await screen.findByText("Encrypted face template registered for DEMO001.");
    expect(requestApi).toHaveBeenCalledWith(
      "/attendance/subjects/1/students/1/face-template",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ descriptor, consent_confirmed: true }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Propose face match" }));
    expect(await screen.findByLabelText("Face match proposal")).toBeInTheDocument();
    expect(onConfirmPresent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm present" }));
    await waitFor(() => expect(onConfirmPresent).toHaveBeenCalledWith(roster[0]));
  });

  it("loads face models without opening the camera and displays a failed recognition attempt", async () => {
    requestApi.mockResolvedValue([{ student_id: 1, registered: true }]);
    getFaceDescriptor.mockRejectedValue(new Error("No face was detected."));
    render(
      <FaceAttendancePanel
        token="test-token"
        subjectId={1}
        sessionId={5}
        roster={roster}
        onConfirmPresent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check recognition models" }));
    expect(await screen.findByText("Local detector, landmark and recognition models loaded."))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Propose face match" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Start the camera/);
  });

  it("reports denied camera permission and leaves manual attendance available", async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error("permission denied"));
    requestApi.mockResolvedValue([{ student_id: 1, registered: false }]);
    render(
      <FaceAttendancePanel
        token="test-token"
        subjectId={1}
        sessionId={5}
        roster={roster}
        onConfirmPresent={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/people in the camera view/));
    fireEvent.click(screen.getByRole("button", { name: "Start face camera" }));
    expect(await screen.findByText("Camera unavailable: permission denied"))
      .toBeInTheDocument();
    expect(screen.getByText(/use manual attendance/)).toBeInTheDocument();
  });

  it("does not request camera access before camera-use consent", () => {
    requestApi.mockResolvedValue([{ student_id: 1, registered: false }]);
    render(
      <FaceAttendancePanel
        token="test-token"
        subjectId={1}
        sessionId={5}
        roster={roster}
        onConfirmPresent={vi.fn()}
      />,
    );
    const startButton = screen.getByRole("button", { name: "Start face camera" });
    expect(startButton).toBeDisabled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
