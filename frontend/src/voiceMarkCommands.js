const numberWords = new Map([
  ["zero", 0],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
  ["sixty", 60],
  ["seventy", 70],
  ["eighty", 80],
  ["ninety", 90],
]);

const numberConnectors = new Set([
  "a",
  "and",
  "earned",
  "get",
  "got",
  "is",
  "mark",
  "marks",
  "obtained",
  "of",
  "received",
  "scored",
  "score",
  "the",
]);

function normalizeWords(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US");
  return normalized.match(/\d+(?:\.\d+)?|[\p{L}]+|-/gu) ?? [];
}

function identityMatches(tokens, identity) {
  const identityTokens = normalizeWords(identity);
  const positions = [];
  if (!identityTokens.length) return positions;
  for (let start = 0; start <= tokens.length - identityTokens.length; start += 1) {
    if (identityTokens.every((token, offset) => tokens[start + offset] === token)) {
      positions.push({ start, end: start + identityTokens.length });
    }
  }
  return positions;
}

function parseNumber(tokens) {
  const value = tokens.join(" ");
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  const normalizedTokens = tokens.filter((token) => token !== "and");
  if (normalizedTokens.length === 0) return null;
  if (normalizedTokens.length === 1) {
    return numberWords.get(normalizedTokens[0]) ?? null;
  }

  if (
    normalizedTokens.length === 2 &&
    numberWords.has(normalizedTokens[0]) &&
    numberWords.has(normalizedTokens[1])
  ) {
    const tens = numberWords.get(normalizedTokens[0]);
    const ones = numberWords.get(normalizedTokens[1]);
    if (tens >= 20 && tens % 10 === 0 && ones > 0 && ones < 10) {
      return tens + ones;
    }
  }

  if (
    normalizedTokens.length >= 2 &&
    normalizedTokens[1] === "hundred" &&
    numberWords.has(normalizedTokens[0]) &&
    numberWords.get(normalizedTokens[0]) >= 1 &&
    numberWords.get(normalizedTokens[0]) <= 9
  ) {
    const remainder = normalizedTokens.slice(2);
    if (!remainder.length) return numberWords.get(normalizedTokens[0]) * 100;
    const restValue = parseNumber(remainder);
    if (restValue !== null && restValue < 100) {
      return numberWords.get(normalizedTokens[0]) * 100 + restValue;
    }
  }
  return null;
}

export function parseVoiceMark(transcript, roster, maximumScore) {
  if (!Number.isFinite(maximumScore) || maximumScore <= 0) {
    return { status: "invalid", message: "Select an assessment before reviewing a spoken mark." };
  }
  const tokens = normalizeWords(transcript);
  const matchedStudents = new Map();
  for (const student of roster) {
    const matches = [
      ...identityMatches(tokens, student.student_name),
      ...identityMatches(tokens, student.roll_number),
    ];
    if (matches.length) {
      matchedStudents.set(student.student_id, { student, matches });
    }
  }

  if (matchedStudents.size === 0) {
    return {
      status: "unknown",
      message: "No enrolled student matched that name or identifier. Nothing was saved.",
    };
  }
  if (matchedStudents.size > 1) {
    return {
      status: "ambiguous",
      message: "More than one enrolled student matched. Include one full name or roll number.",
    };
  }

  const [{ student, matches }] = matchedStudents.values();
  if (matches.length !== 1) {
    return {
      status: "invalid",
      message: "Mention the student once, then state one mark value.",
    };
  }
  const [identity] = matches;
  const remainingTokens = [
    ...tokens.slice(0, identity.start),
    ...tokens.slice(identity.end),
  ].filter((token) => !numberConnectors.has(token));
  if (remainingTokens[0] === "-" && remainingTokens.length === 2) {
    return { status: "invalid", message: "Marks cannot be negative." };
  }
  const mark = parseNumber(remainingTokens);
  if (mark === null || !Number.isFinite(mark)) {
    return {
      status: "invalid",
      message: "Could not extract exactly one mark. Try “Rahul Sharma got 18 marks”.",
    };
  }
  if (mark < 0 || mark > maximumScore) {
    return {
      status: "invalid",
      message: `Mark must be between 0 and ${maximumScore}. Nothing was saved.`,
    };
  }
  return { status: "proposed", student, score: mark };
}
