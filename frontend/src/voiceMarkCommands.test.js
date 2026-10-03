import { describe, expect, it } from "vitest";
import { parseVoiceMark } from "./voiceMarkCommands.js";

const roster = [
  { student_id: 1, roll_number: "DEMO001", student_name: "Rahul Sharma" },
  { student_id: 2, roll_number: "DEMO002", student_name: "Riya Sharma" },
];

describe("parseVoiceMark", () => {
  it.each([
    ["Rahul Sharma got 18 marks", 18],
    ["DEMO001 18.5", 18.5],
    ["Rahul Sharma scored eighteen", 18],
    ["Rahul Sharma got twenty five marks", 25],
  ])("extracts a single score from %s", (transcript, score) => {
    expect(parseVoiceMark(transcript, roster, 40)).toMatchObject({
      status: "proposed",
      student: roster[0],
      score,
    });
  });

  it("rejects unknown, ambiguous, multiple-score, and out-of-range phrases", () => {
    expect(parseVoiceMark("Unknown Student got 18", roster, 40).status).toBe("unknown");
    expect(parseVoiceMark("Rahul Sharma and Riya Sharma got 18", roster, 40).status)
      .toBe("ambiguous");
    expect(parseVoiceMark("Rahul Sharma got 18 and 20", roster, 40).status).toBe("invalid");
    expect(parseVoiceMark("Rahul Sharma got 41", roster, 40).status).toBe("invalid");
    expect(parseVoiceMark("Rahul Sharma got -1", roster, 40).message)
      .toBe("Marks cannot be negative.");
  });

  it("matches hyphenated roll numbers without mistaking them for a negative score", () => {
    const student = {
      student_id: 3,
      roll_number: "CS-2026-01",
      student_name: "Sam Lee",
    };
    expect(parseVoiceMark("CS-2026-01 got 18", [student], 40)).toMatchObject({
      status: "proposed",
      student,
      score: 18,
    });
  });
});
