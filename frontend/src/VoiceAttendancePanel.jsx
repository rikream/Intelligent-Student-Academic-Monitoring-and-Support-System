import { useEffect, useRef, useState } from "react";
import { getSpeechRecognitionConstructor } from "./browserCapabilities.js";
import { parseAttendanceCommand } from "./voiceCommands.js";

function getRecognitionFailure(error) {
  switch (error) {
    case "not-allowed":
      return {
        title: "MICROPHONE PERMISSION PROBLEM",
        message: "Allow microphone access for this site in browser settings, then try again.",
      };
    case "service-not-allowed":
      return {
        title: "SPEECH SERVICE NOT ALLOWED",
        message: "The browser is blocking its speech service. Check browser privacy and site settings.",
      };
    case "audio-capture":
      return {
        title: "MICROPHONE UNAVAILABLE",
        message: "The browser could not access an audio input. Check the selected microphone and its permissions.",
      };
    case "network":
      return {
        title: "VOICE RECOGNITION UNAVAILABLE",
        message: "The browser speech service reported a network failure. This application does not provide offline transcription.",
      };
    case "no-speech":
      return {
        title: "NO SPEECH DETECTED",
        message: "No speech was detected. Check the microphone input or speak clearly and try again.",
      };
    case "language-not-supported":
      return {
        title: "SPEECH LANGUAGE UNAVAILABLE",
        message: "The browser speech service does not support the configured English (United States) language.",
      };
    default:
      return {
        title: "VOICE RECOGNITION UNAVAILABLE",
        message: `The browser could not complete speech recognition (${error}).`,
      };
  }
}

export default function VoiceAttendancePanel({ roster, onConfirm }) {
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(null);
  const [transcript, setTranscript] = useState("");
  const [recognitionSupported] = useState(
    () => getSpeechRecognitionConstructor() !== null,
  );
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("No voice command has been proposed.");
  const [proposal, setProposal] = useState(null);
  const [recognitionIssue, setRecognitionIssue] = useState(() =>
    recognitionSupported
      ? null
      : {
          title: "VOICE RECOGNITION UNAVAILABLE",
          message: "This browser does not support speech recognition.",
        },
  );

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  function parseTranscript(value) {
    setProposal(null);
    const parsed = parseAttendanceCommand(value, roster);
    if (parsed.status === "proposed") {
      setProposal(parsed);
      setStatus("Review the proposed student and action before confirming.");
    } else if (parsed.status === "ambiguous") {
      setStatus("More than one enrolled student matches. Nothing was recorded.");
    } else if (parsed.status === "unmatched") {
      setStatus("No enrolled student matched that name or roll number. Nothing was recorded.");
    } else {
      setStatus("The command must include exactly one student and one present/absent action.");
    }
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setRecognitionIssue({
        title: "VOICE RECOGNITION UNAVAILABLE",
        message: "This browser does not support speech recognition.",
      });
      setStatus("Speech recognition is unsupported. Type a command below.");
      return;
    }
    const recognition = new SpeechRecognition();
    let receivedResult = false;
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      receivedResult = true;
      const result = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(result);
      if (result.trim()) {
        setRecognitionIssue(null);
        parseTranscript(result);
      } else {
        const issue = getRecognitionFailure("no-speech");
        setRecognitionIssue(issue);
        setStatus(issue.message);
      }
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "aborted") {
        recognitionRef.current = null;
        setListening(false);
        setStatus("Voice command stopped. Type the same command instead.");
        return;
      }
      const issue = getRecognitionFailure(event.error);
      recognitionRef.current = null;
      setListening(false);
      setRecognitionIssue(issue);
      setStatus(issue.message);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      if (!receivedResult) {
        const issue = getRecognitionFailure("no-speech");
        setRecognitionIssue(issue);
        setStatus(issue.message);
      }
    };
    try {
      setRecognitionIssue(null);
      setTranscript("");
      setProposal(null);
      recognition.start();
      setListening(true);
      setStatus("Listening for a professor attendance command...");
    } catch (error) {
      recognitionRef.current = null;
      setListening(false);
      const issue = getRecognitionFailure(error.message);
      setRecognitionIssue(issue);
      setStatus(issue.message);
    }
  }

  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    recognition?.abort();
    setStatus("Voice command stopped. Type the same command instead.");
  }

  async function confirmProposal() {
    const candidate = proposal?.candidates[0];
    if (!candidate) {
      return;
    }
    const saved = await onConfirm(candidate, proposal.attendanceStatus);
    if (saved) {
      setProposal(null);
      setStatus("Confirmed command submitted to attendance records.");
    } else {
      setStatus("The confirmed command could not be saved. Review the error and retry.");
    }
  }

  return (
    <section className="panel voice-attendance-panel" aria-labelledby="voice-attendance-heading">
      <h3 id="voice-attendance-heading">Professor voice attendance</h3>
      <p className="note">
        Say “mark [student name or roll number] present” or “mark [student
        name or roll number] absent”. The browser speech service may process
        audio; no audio is sent to this application. Nothing is recorded until
        you review and confirm.
      </p>
      <p role="status">{status}</p>
      {recognitionIssue && (
        <div className="voice-recognition-fallback" role="alert">
          <div>
            <strong>{recognitionIssue.title}</strong>
            <p>{recognitionIssue.message}</p>
            <p>Type the same command instead.</p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => transcriptRef.current?.focus()}
          >
            Type command
          </button>
        </div>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={!recognitionSupported || listening || roster.length === 0}
          onClick={startListening}
        >
          Start voice command
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!listening}
          onClick={stopListening}
        >
          Stop listening
        </button>
      </div>
      <label htmlFor="voice-attendance-command">Typed command fallback</label>
      <textarea
        id="voice-attendance-command"
        ref={transcriptRef}
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="For example: mark STU001 present"
        rows="2"
      />
      <button
        type="button"
        className="secondary"
        disabled={!transcript.trim() || roster.length === 0}
        onClick={() => {
          recognitionRef.current?.abort();
          recognitionRef.current = null;
          setListening(false);
          parseTranscript(transcript);
        }}
      >
        Review typed command
      </button>
      {proposal?.candidates[0] && (
        <div className="proposal" aria-label="Voice attendance proposal">
          <p>
            Proposed: {proposal.candidates[0].student_name} ({proposal.candidates[0].roll_number})
            {" "}marked {proposal.attendanceStatus}.
          </p>
          <div className="actions">
            <button type="button" onClick={confirmProposal}>Review and confirm</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setProposal(null)}
            >
              Reject proposal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
