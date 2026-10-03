function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ignoredCommandWords = new Set([
  "attendance",
  "as",
  "for",
  "mark",
  "please",
  "record",
  "set",
]);

export function parseAttendanceCommand(transcript, roster) {
  const normalized = normalize(transcript);
  const statusWords = normalized.match(/\b(present|absent)\b/g) ?? [];
  if (statusWords.length !== 1) {
    return { status: "unclear", candidates: [] };
  }
  const attendanceStatus = statusWords[0];
  const subjectWords = normalized
    .split(" ")
    .filter((word) => word !== attendanceStatus && !ignoredCommandWords.has(word))
    .join(" ");
  if (!subjectWords) {
    return { status: "unmatched", candidates: [] };
  }

  const matches = roster.filter(
    (entry) =>
      normalize(entry.roll_number) === subjectWords ||
      normalize(entry.student_name) === subjectWords,
  );
  if (matches.length === 0) {
    return { status: "unmatched", candidates: [] };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      attendanceStatus,
      candidates: matches,
    };
  }
  return {
    status: "proposed",
    attendanceStatus,
    candidates: matches,
  };
}
