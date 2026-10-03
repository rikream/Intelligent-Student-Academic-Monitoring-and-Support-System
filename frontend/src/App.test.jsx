import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrowserDiagnostics from "./BrowserDiagnostics.jsx";

describe("P0 browser capability fallbacks", () => {
  beforeEach(() => {
    render(<BrowserDiagnostics />);
    fireEvent.click(screen.getByText("Browser capability diagnostics (P0)"));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps an editable fallback available when speech recognition is unsupported", () => {
    fireEvent.click(screen.getByRole("button", { name: "Start speech check" }));

    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
      "Speech recognition is not supported here. Type into the manual fallback.",
    );
    expect(screen.getByRole("button", { name: "Stop speech check" })).toBeDisabled();
    const manualInput = screen.getByLabelText("Editable manual fallback");
    fireEvent.change(manualInput, { target: { value: "typed test phrase" } });
    expect(manualInput).toHaveValue("typed test phrase");
  });

  it("explains that manual entry remains available when camera APIs are missing", () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Start camera preview" }));

    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
      "Camera is not supported in this browser. Use the manual fallback.",
    );
  });

  it("keeps the manual fallback available when camera permission is denied", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("permission denied")),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start camera preview" }));

    await waitFor(() => {
      expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
        "Camera unavailable: permission denied Use the manual fallback.",
      );
    });
  });

  it("allows a supported speech check to be stopped", () => {
    let aborted = false;
    class MockRecognition {
      start() {}
      abort() {
        aborted = true;
      }
    }
    vi.stubGlobal("SpeechRecognition", MockRecognition);

    fireEvent.click(screen.getByRole("button", { name: "Start speech check" }));
    const stopButton = screen.getByRole("button", { name: "Stop speech check" });
    expect(stopButton).toBeEnabled();
    fireEvent.click(stopButton);

    expect(aborted).toBe(true);
    expect(stopButton).toBeDisabled();
    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
      "Speech check stopped. Use the manual fallback if needed.",
    );
  });
});
