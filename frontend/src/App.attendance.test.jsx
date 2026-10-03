import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("P2 demo login", () => {
  it("signs in with the server-assigned role and opens attendance workspace", async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      const path = new URL(url, "http://localhost").pathname;
      const method = options.method ?? "GET";
      const response = (body) => ({
        ok: true,
        status: 200,
        json: async () => body,
      });
      if (path === "/api/health") {
        return response({ status: "ok" });
      }
      if (path === "/api/auth/demo-login" && method === "POST") {
        return response({ access_token: "signed-test-token", demo_only: true });
      }
      if (path === "/api/auth/me") {
        expect(options.headers.get("Authorization")).toBe("Bearer signed-test-token");
        return response({ id: 2, username: "professor.cs", role: "professor" });
      }
      if (path === "/api/subjects" || path === "/api/enrollments" ||
          path === "/api/attendance/sessions") {
        return response([]);
      }
      return response({ detail: `Unhandled request: ${method} ${path}` });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Professor/ }));
    fireEvent.change(screen.getByLabelText("Demo account"), {
      target: { value: "professor.cs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Teaching overview" }))
      .toBeInTheDocument();
    expect(screen.getByText("Review your classes and keep attendance records up to date."))
      .toBeInTheDocument();
  });
});
