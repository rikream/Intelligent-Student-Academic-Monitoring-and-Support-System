import { afterEach, describe, expect, it, vi } from "vitest";
import { requestApi } from "./apiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestApi", () => {
  it("accepts successful no-content responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await expect(requestApi("/attendance/face-template", { method: "DELETE" }))
      .resolves.toBeNull();
  });
});
