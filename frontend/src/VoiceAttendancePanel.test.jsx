import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import VoiceAttendancePanel from "./VoiceAttendancePanel.jsx";

afterEach(() => {
  cleanup();
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

const roster = [
  {
    student_id: 1,
    roll_number: "DEMO001",
    student_name: "Aarav Rao",
    status: null,
  },
];

describe("VoiceAttendancePanel", () => {
  it("requires professor confirmation before submitting a recognized command", async () => {
    let recognition;
    class FakeSpeechRecognition {
      start() {
        recognition = this;
      }

      abort() {}
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    const onConfirm = vi.fn().mockResolvedValue(true);
    render(<VoiceAttendancePanel roster={roster} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice command" }));
    expect(recognition.lang).toBe("en-US");
    expect(recognition.interimResults).toBe(false);
    expect(recognition.maxAlternatives).toBe(1);
    recognition.onresult({
      results: [[{ transcript: "mark DEMO001 present" }]],
    });

    expect(await screen.findByText(/Proposed: Aarav Rao \(DEMO001\) marked present/))
      .toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(roster[0], "present");
  });

  it("uses typed fallback and rejects unmatched names without submitting", () => {
    const onConfirm = vi.fn();
    render(<VoiceAttendancePanel roster={roster} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText("Typed command fallback"), {
      target: { value: "mark UNKNOWN present" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review typed command" }));

    expect(screen.getByText(/No enrolled student matched/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each([
    ["network", "VOICE RECOGNITION UNAVAILABLE", /does not provide offline transcription/],
    ["not-allowed", "MICROPHONE PERMISSION PROBLEM", /Allow microphone access/],
    ["audio-capture", "MICROPHONE UNAVAILABLE", /audio input/],
    ["no-speech", "NO SPEECH DETECTED", /No speech was detected/],
  ])("explains the %s recognition failure and keeps typing available", (error, title, message) => {
    let recognition;
    class FakeSpeechRecognition {
      start() {
        recognition = this;
      }

      abort() {}
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    render(<VoiceAttendancePanel roster={roster} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice command" }));
    act(() => recognition.onerror({ error }));

    const fallback = screen.getByRole("alert");
    expect(fallback).toHaveTextContent(title);
    expect(fallback).toHaveTextContent(message);
    expect(fallback).toHaveTextContent("Type the same command instead.");
    fireEvent.click(screen.getByRole("button", { name: "Type command" }));
    expect(screen.getByLabelText("Typed command fallback")).toHaveFocus();
  });

  it("clearly offers typed commands when the browser does not support recognition", () => {
    render(<VoiceAttendancePanel roster={roster} onConfirm={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("VOICE RECOGNITION UNAVAILABLE");
    expect(screen.getByRole("alert")).toHaveTextContent("does not support speech recognition");
    expect(screen.getByRole("button", { name: "Start voice command" })).toBeDisabled();
  });
});
