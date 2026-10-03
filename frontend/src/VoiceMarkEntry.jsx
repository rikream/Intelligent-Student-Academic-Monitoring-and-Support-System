import { useEffect, useRef, useState } from "react";
import { getSpeechRecognitionConstructor } from "./browserCapabilities.js";
import { parseVoiceMark } from "./voiceMarkCommands.js";

export default function VoiceMarkEntry({
  assessment,
  roster,
  saving,
  onConfirmSave,
}) {
  const recognitionRef = useRef(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("No spoken mark has been reviewed.");
  const [proposal, setProposal] = useState(null);
  const [proposalError, setProposalError] = useState("");

  useEffect(
    () => () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
      recognitionRef.current = null;
    },
    [],
  );

  function reviewTranscript(value = transcript) {
    setProposal(null);
    setProposalError("");
    if (!assessment) {
      setProposalError("Create or select an assessment before entering a mark.");
      return;
    }
    const parsed = parseVoiceMark(value, roster, assessment.max_score);
    if (parsed.status === "proposed") {
      setProposal(parsed);
      setStatus("Review the matched student, assessment, and score before saving.");
      return;
    }
    setProposalError(parsed.message);
    setStatus("The spoken mark could not be safely matched. Nothing was saved.");
  }

  function startListening() {
    if (!assessment) {
      setProposalError("Create or select an assessment before entering a mark.");
      return;
    }
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setStatus("Speech recognition is unsupported. Type a sentence below to continue.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(result);
      reviewTranscript(result);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setStatus(`Speech recognition failed (${event.error}). Type the sentence instead.`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      recognition.start();
      setListening(true);
      setProposal(null);
      setProposalError("");
      setStatus("Listening for a student name and mark…");
    } catch (error) {
      recognitionRef.current = null;
      setListening(false);
      setStatus(`Speech recognition could not start: ${error.message}. Type the sentence instead.`);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
    }
    recognitionRef.current = null;
    setListening(false);
    setStatus("Voice capture stopped. Review typed text or enter the mark manually.");
  }

  async function confirmSave() {
    if (!proposal || !assessment) return;
    const saved = await onConfirmSave({
      assessmentId: assessment.id,
      studentId: proposal.student.student_id,
      score: proposal.score,
    });
    if (saved) {
      setProposal(null);
      setTranscript("");
      setStatus("Confirmed spoken mark saved; the student notification was created.");
    } else {
      setStatus("The confirmed mark could not be saved. Review the error and try again.");
    }
  }

  return (
    <section className="voice-mark-entry" aria-labelledby="voice-mark-heading">
      <div className="card-heading">
        <span className="card-icon indigo" aria-hidden="true">V</span>
        <div>
          <h3 id="voice-mark-heading">Voice-assisted mark entry</h3>
          <p>Use a student’s full name or roll number and a single score.</p>
        </div>
      </div>
      <p className="note">
        Example: “Rahul Sharma got 18 marks” or “Rahul Sharma 18”.
        Speech is transcribed in the browser; nothing is saved until you select Confirm &amp; Save.
      </p>
      <p role="status" aria-live="polite">{status}</p>
      {!assessment && (
        <p className="field-hint">Create or select an assessment to enable spoken mark entry.</p>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={!assessment || !roster.length || listening || saving}
          onClick={startListening}
        >
          {listening ? "Listening…" : "Start microphone"}
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
      <label htmlFor="voice-mark-transcript">Editable speech transcript / typed fallback</label>
      <textarea
        id="voice-mark-transcript"
        value={transcript}
        onChange={(event) => {
          setTranscript(event.target.value);
          setProposal(null);
          setProposalError("");
        }}
        placeholder="Rahul Sharma got 18 marks"
        rows="2"
      />
      <button
        type="button"
        className="secondary"
        disabled={!transcript.trim() || !assessment || saving}
        onClick={() => reviewTranscript()}
      >
        Review mark
      </button>
      {proposalError && <p className="feedback error" role="alert">{proposalError}</p>}
      {proposal && (
        <div
          className="proposal voice-mark-proposal"
          role="region"
          aria-label="Voice mark confirmation"
        >
          <h4>Review before saving</h4>
          <dl>
            <div><dt>Student</dt><dd>{proposal.student.student_name} ({proposal.student.roll_number})</dd></div>
            <div><dt>Assessment</dt><dd>{assessment.title}</dd></div>
            <div><dt>Mark</dt><dd>{proposal.score} / {assessment.max_score}</dd></div>
          </dl>
          <p role="note">Confirm only if the student and score are correct. The student will be notified.</p>
          <div className="actions">
            <button type="button" disabled={saving} onClick={confirmSave}>
              {saving ? "Saving…" : "Confirm & Save"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={() => {
                setProposal(null);
                setStatus("Proposal cancelled. No mark was saved.");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
