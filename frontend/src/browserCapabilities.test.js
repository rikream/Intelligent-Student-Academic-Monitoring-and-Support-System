import { describe, expect, it } from "vitest";
import { getSpeechRecognitionConstructor, hasCameraSupport } from "./browserCapabilities.js";

describe("browser capability fallbacks", () => {
  it("recognizes standard and prefixed speech recognition APIs", () => {
    const standard = function StandardRecognition() {};
    const prefixed = function PrefixedRecognition() {};

    expect(getSpeechRecognitionConstructor({ SpeechRecognition: standard })).toBe(standard);
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition: prefixed })).toBe(prefixed);
  });

  it("reports speech recognition as unavailable without either API", () => {
    expect(getSpeechRecognitionConstructor({})).toBeNull();
  });

  it("only enables camera support when getUserMedia exists", () => {
    expect(hasCameraSupport({ mediaDevices: { getUserMedia() {} } })).toBe(true);
    expect(hasCameraSupport({ mediaDevices: {} })).toBe(false);
    expect(hasCameraSupport({})).toBe(false);
  });
});
