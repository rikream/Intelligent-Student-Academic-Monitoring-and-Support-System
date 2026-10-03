import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { requestApi } = vi.hoisted(() => ({ requestApi: vi.fn() }));
vi.mock("./apiClient.js", () => ({ requestApi }));

import FaceTemplatePrivacy from "./FaceTemplatePrivacy.jsx";

afterEach(() => {
  cleanup();
  requestApi.mockReset();
});

describe("FaceTemplatePrivacy", () => {
  it("lets a student remove their own stored template", async () => {
    requestApi
      .mockResolvedValueOnce({ student_id: 1, registered: true })
      .mockResolvedValueOnce(null);
    render(<FaceTemplatePrivacy token="student-token" />);

    expect(await screen.findByText(/An encrypted face descriptor is stored/))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove my face template" }));

    expect(await screen.findByText(/No face descriptor is stored/))
      .toBeInTheDocument();
    expect(requestApi).toHaveBeenNthCalledWith(
      2,
      "/attendance/face-template",
      { token: "student-token", method: "DELETE" },
    );
  });
});
