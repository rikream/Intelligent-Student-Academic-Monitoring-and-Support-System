import { describe, expect, it } from "vitest";
import { parseAttendanceCommand } from "./voiceCommands.js";

const roster = [
  { student_id: 1, roll_number: "DEMO001", student_name: "Aarav Rao" },
  { student_id: 2, roll_number: "DEMO002", student_name: "Mira Shah" },
];

describe("parseAttendanceCommand", () => {
  it("resolves exact roll numbers and full student names", () => {
    expect(parseAttendanceCommand("mark DEMO001 present", roster)).toMatchObject({
      status: "proposed",
      attendanceStatus: "present",
      candidates: [{ student_id: 1 }],
    });
    expect(parseAttendanceCommand("please mark Aarav Rao absent", roster)).toMatchObject({
      status: "proposed",
      attendanceStatus: "absent",
      candidates: [{ student_id: 1 }],
    });
  });

  it("does not resolve unmatched or ambiguous names", () => {
    expect(parseAttendanceCommand("mark nobody present", roster).status).toBe("unmatched");
    expect(parseAttendanceCommand("mark Aarav Rao present absent", roster).status)
      .toBe("unclear");
    const duplicateNames = [
      roster[0],
      { student_id: 3, roll_number: "DEMO003", student_name: "Aarav Rao" },
    ];
    expect(parseAttendanceCommand("mark Aarav Rao present", duplicateNames).status)
      .toBe("ambiguous");
  });
});
