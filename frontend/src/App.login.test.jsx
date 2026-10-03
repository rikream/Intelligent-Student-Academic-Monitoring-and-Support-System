import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockDemoApi() {
  let demoUsername = "";
  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = new URL(url, "http://localhost").pathname;
    const method = options.method ?? "GET";
    const json = options.body ? JSON.parse(options.body) : undefined;
    const response = (body) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });

    if (path === "/api/health") return response({ status: "ok" });
    if (path === "/api/auth/demo-login" && method === "POST") {
      demoUsername = json.username;
      return response({ access_token: "signed-test-token", demo_only: true });
    }
    if (path === "/api/auth/me") {
      const role = demoUsername === "admin.demo"
        ? "administrator"
        : demoUsername.startsWith("professor.")
          ? "professor"
          : "student";
      return response({ id: 1, username: demoUsername, role });
    }
    return response([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("role-aware demo login", () => {
  it("defaults to the student role and signs in as student.001", async () => {
    const fetchMock = mockDemoApi();
    render(<App />);

    expect(screen.getByRole("button", { name: /Student/ }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Demo account")).toHaveValue("student.001");
    expect(screen.getByLabelText("Demo account").options).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Welcome back, student.001" }))
      .toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/demo-login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "student.001" }),
      }),
    );
  });

  it("selects a professor account and lets the server assign the workspace role", async () => {
    const fetchMock = mockDemoApi();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Professor/ }));
    expect(screen.getByRole("button", { name: /Professor/ }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Demo account")).toHaveValue("professor.cs");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Teaching overview" }))
      .toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/demo-login",
      expect.objectContaining({
        body: JSON.stringify({ username: "professor.cs" }),
      }),
    );
  });

  it("selects the administrator account and opens the administrator workspace", async () => {
    mockDemoApi();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Administrator/ }));
    expect(screen.getByLabelText("Demo account")).toHaveValue("admin.demo");
    expect(screen.getByLabelText("Demo account").options).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Academic overview" }))
      .toBeInTheDocument();
    expect(screen.getByText("admin.demo")).toBeInTheDocument();
  });
});
