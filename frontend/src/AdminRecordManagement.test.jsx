import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { requestApi } = vi.hoisted(() => ({ requestApi: vi.fn() }));
vi.mock("./apiClient.js", () => ({ requestApi }));

import AdminRecordManagement from "./AdminRecordManagement.jsx";

afterEach(() => {
  cleanup();
  requestApi.mockReset();
});

describe("AdminRecordManagement", () => {
  it("creates a student through the existing administrator API", async () => {
    requestApi.mockResolvedValue({});
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminRecordManagement
        token="admin-token"
        students={[]}
        subjects={[]}
        enrollments={[]}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "student.new" } });
    fireEvent.change(screen.getByLabelText("Roll number"), { target: { value: "DEMO010" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Fictional Student" } });
    fireEvent.change(document.getElementById("student-department"), { target: { value: "Computer Science" } });
    fireEvent.click(screen.getByRole("button", { name: "Create student" }));

    await screen.findByText("Student profile created.");
    expect(requestApi).toHaveBeenCalledWith("/students", {
      token: "admin-token",
      method: "POST",
      body: JSON.stringify({
        username: "student.new",
        roll_number: "DEMO010",
        name: "Fictional Student",
        department: "Computer Science",
        semester: 1,
      }),
    });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("surfaces backend validation errors without pretending enrollment succeeded", async () => {
    requestApi.mockRejectedValue(new Error("Student department and semester must match the subject."));
    render(
      <AdminRecordManagement
        token="admin-token"
        students={[{ id: 1, name: "Aarav Rao", roll_number: "DEMO001" }]}
        subjects={[{ id: 1, code: "CS301", name: "Data Structures" }]}
        enrollments={[]}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create enrollment" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Student department and semester must match the subject.");
    await waitFor(() => expect(screen.queryByText("Student enrolled in the subject."))
      .not.toBeInTheDocument());
  });
});
