import { useEffect, useRef, useState } from "react";
import { requestApi } from "./apiClient.js";
import { getFaceDescriptor, loadFaceModels } from "./faceRecognition.js";

export default function FaceAttendancePanel({
  token,
  subjectId,
  sessionId,
  roster,
  onConfirmPresent,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const cameraPendingRef = useRef(false);
  const [templateStatuses, setTemplateStatuses] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [cameraConsent, setCameraConsent] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("Camera is off.");
  const [cameraPending, setCameraPending] = useState(false);
  const [modelMessage, setModelMessage] = useState("Face recognition models have not been checked.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [match, setMatch] = useState(null);

  const selectedEntry = roster.find(
    (entry) => String(entry.student_id) === selectedStudentId,
  );

  useEffect(() => {
    let active = true;
    setTemplateStatuses([]);
    setMatch(null);
    requestApi(`/attendance/sessions/${sessionId}/face-templates`, { token })
      .then((statuses) => {
        if (active) {
          setTemplateStatuses(statuses);
          setSelectedStudentId((current) =>
            roster.some((entry) => String(entry.student_id) === current)
              ? current
              : String(roster[0]?.student_id ?? ""),
          );
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [roster, sessionId, token]);

  useEffect(
    () => () => {
      cameraRequestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [sessionId],
  );

  async function startCamera() {
    if (!cameraConsent) {
      setCameraMessage("Confirm that people in view consent before starting the camera.");
      return;
    }
    if (cameraPendingRef.current) {
      setCameraMessage("Camera permission is still pending.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera is not supported here. Use manual attendance.");
      return;
    }
    if (streamRef.current) {
      setCameraMessage("Camera is already active.");
      return;
    }
    const requestId = ++cameraRequestRef.current;
    cameraPendingRef.current = true;
    setCameraPending(true);
    setCameraMessage("Requesting camera permission...");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraMessage("Camera is active. Frames are not uploaded or stored.");
    } catch (cameraError) {
      if (cameraRequestRef.current === requestId) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraMessage(`Camera unavailable: ${cameraError.message}`);
      }
    } finally {
      if (cameraRequestRef.current === requestId) {
        cameraPendingRef.current = false;
        setCameraPending(false);
      }
    }
  }

  async function checkModels() {
    setModelMessage("Loading local face recognition models...");
    try {
      await loadFaceModels();
      setModelMessage("Local detector, landmark and recognition models loaded.");
    } catch (modelError) {
      setModelMessage(`Recognition models unavailable: ${modelError.message}`);
    }
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    cameraPendingRef.current = false;
    setCameraPending(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraMessage("Camera is off.");
    setCameraConsent(false);
  }

  async function captureDescriptor() {
    if (!videoRef.current || !streamRef.current) {
      throw new Error("Start the camera before using face attendance.");
    }
    return getFaceDescriptor(videoRef.current);
  }

  async function registerTemplate() {
    if (!selectedEntry || !consentConfirmed) {
      setError("Select a student and confirm their consent before registration.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const descriptor = await captureDescriptor();
      await requestApi(
        `/attendance/subjects/${subjectId}/students/${selectedEntry.student_id}/face-template`,
        {
          token,
          method: "PUT",
          body: JSON.stringify({ descriptor, consent_confirmed: true }),
        },
      );
      setTemplateStatuses((statuses) =>
        statuses.map((item) =>
          item.student_id === selectedEntry.student_id
            ? { ...item, registered: true }
            : item,
        ),
      );
      setNotice(`Encrypted face template registered for ${selectedEntry.roll_number}.`);
      setConsentConfirmed(false);
    } catch (registrationError) {
      setError(registrationError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate() {
    if (!selectedEntry) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestApi(
        `/attendance/subjects/${subjectId}/students/${selectedEntry.student_id}/face-template`,
        { token, method: "DELETE" },
      );
      setTemplateStatuses((statuses) =>
        statuses.map((item) =>
          item.student_id === selectedEntry.student_id
            ? { ...item, registered: false }
            : item,
        ),
      );
      setMatch(null);
      setNotice(`Face template removed for ${selectedEntry.roll_number}.`);
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusy(false);
    }
  }

  async function proposeMatch() {
    setBusy(true);
    setError("");
    setNotice("");
    setMatch(null);
    try {
      const descriptor = await captureDescriptor();
      const response = await requestApi(
        `/attendance/sessions/${sessionId}/face-match`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ descriptor }),
        },
      );
      setMatch(response);
    } catch (matchError) {
      setError(matchError.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmMatch(candidate) {
    const entry = roster.find((item) => item.student_id === candidate.student_id);
    if (entry) {
      const saved = await onConfirmPresent(entry);
      if (saved) {
        setMatch(null);
      }
    }
  }

  const selectedTemplate = templateStatuses.find(
    (item) => String(item.student_id) === selectedStudentId,
  );

  return (
    <section className="panel face-attendance-panel" aria-labelledby="face-attendance-heading">
      <h3 id="face-attendance-heading">Face-assisted attendance</h3>
      <p className="note">
        Face matching proposes an identity; it is not proof of identity.
        Review every proposal and use manual attendance if anything is unclear.
        Only encrypted descriptors are stored; camera frames are not saved.
      </p>
      <p role="status">{cameraMessage}</p>
      <p role="status">{modelMessage}</p>
      <button type="button" className="secondary" onClick={checkModels}>
        Check recognition models
      </button>
      <video
        ref={videoRef}
        className="camera-preview"
        autoPlay
        muted
        playsInline
        aria-label="Face attendance camera preview"
      />
      <label className="consent-choice camera-consent-choice">
        <input
          type="checkbox"
          checked={cameraConsent}
          onChange={(event) => {
            const accepted = event.target.checked;
            setCameraConsent(accepted);
            if (!accepted) {
              stopCamera();
              setMatch(null);
            }
          }}
        />
        I have informed people in the camera view, and they consent to camera-based face processing for this attendance session.
      </label>
      <div className="actions">
        <button type="button" disabled={cameraPending || !cameraConsent} onClick={startCamera}>Start face camera</button>
        <button type="button" className="secondary" onClick={stopCamera}>Stop camera</button>
      </div>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      <label htmlFor="face-template-student">Student face template</label>
      <select
        id="face-template-student"
        value={selectedStudentId}
        onChange={(event) => {
          setSelectedStudentId(event.target.value);
          setConsentConfirmed(false);
        }}
      >
        {roster.length === 0 && (
          <option value="">No students enrolled in the selected session</option>
        )}
        {roster.map((entry) => (
          <option key={entry.student_id} value={entry.student_id}>
            {entry.roll_number} · {entry.student_name}
          </option>
        ))}
      </select>
      {selectedEntry && (
        <>
          <p role="status">
            {selectedTemplate?.registered
              ? "An encrypted template is registered."
              : "No face template is registered."}
          </p>
          {!selectedTemplate?.registered && (
            <label className="consent-choice">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
              />
              The student has explicitly consented to registering an encrypted
              face descriptor.
            </label>
          )}
          <div className="actions">
            {selectedTemplate?.registered ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={removeTemplate}
              >
                Remove face template
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !consentConfirmed}
                onClick={registerTemplate}
              >
                Register consented face
              </button>
            )}
            <button
              type="button"
              disabled={busy || !templateStatuses.some((item) => item.registered)}
              onClick={proposeMatch}
            >
              Propose face match
            </button>
          </div>
        </>
      )}
      {match?.status === "unknown" && (
        <p role="status">No registered face matched. Nothing was recorded.</p>
      )}
      {match?.status === "ambiguous" && (
        <div className="feedback error" role="status">
          <p>Ambiguous match. Nothing was recorded; use the manual roster.</p>
          {match.candidates.map((candidate) => (
            <p key={candidate.student_id}>
              {candidate.student_name} ({candidate.roll_number}), distance {candidate.distance}
            </p>
          ))}
        </div>
      )}
      {match?.status === "proposed" && match.candidates[0] && (
        <div className="proposal" aria-label="Face match proposal">
          <p>
            Proposed: {match.candidates[0].student_name} ({match.candidates[0].roll_number}).
            Descriptor distance: {match.candidates[0].distance} (lower is closer).
          </p>
          <p className="note">Verify the person and roster entry before confirming present.</p>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => confirmMatch(match.candidates[0])}
            >
              Review and confirm present
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setMatch(null)}
            >
              Reject proposal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
