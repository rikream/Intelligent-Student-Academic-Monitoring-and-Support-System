import { useEffect, useRef, useState } from "react";
import { requestApi } from "./apiClient.js";
import { getFaceDescriptor } from "./faceRecognition.js";

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function StudentActiveSessionCard({ token, session, onSubmitAttendance }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [candidate, setCandidate] = useState(null);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function joinAndVerify() {
    setError("");
    setMessage("");
    setCandidate(null);
    setBusy(true);
    try {
      if (session.student_status) {
        setMessage(`Attendance is already recorded as ${session.student_status}.`);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported here. Contact your professor to record attendance.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (!videoRef.current) {
        throw new Error("Camera preview is unavailable. Try again or contact your professor.");
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setMessage("Camera is ready. Keep only your face in view while verification runs.");

      const descriptor = await getFaceDescriptor(videoRef.current);
      const result = await requestApi(
        `/attendance/sessions/${session.id}/face-match`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ descriptor }),
        },
      );
      if (result.status !== "proposed" || result.candidates.length !== 1) {
        setMessage(
          result.status === "ambiguous"
            ? "Face verification was ambiguous. Attendance was not marked; ask your professor for help."
            : "Face not recognized. Check your face template or ask your professor for manual attendance.",
        );
        return;
      }
      setCandidate(result.candidates[0]);
      setMessage(
        `Face verified: ${result.candidates[0].student_name} (${result.candidates[0].roll_number}) matches your registered template. Confirm to mark attendance.`,
      );
    } catch (verificationError) {
      setError(verificationError.message);
      if (streamRef.current) {
        setCameraActive(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmAttendance() {
    if (!candidate || session.student_status) return;
    setBusy(true);
    setError("");
    try {
      const result = await onSubmitAttendance(session.id, candidate.student_id);
      stopCamera();
      setCandidate(null);
      setMessage(
        result === "saved"
          ? "Attendance marked successfully."
          : result === "already"
            ? "Attendance was already recorded for this session. Your attendance history has been refreshed."
            : "Attendance could not be marked. See the message above for details.",
      );
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const alreadyRecorded = Boolean(session.student_status);

  return (
    <article className="active-attendance-card">
      <div className="active-attendance-heading">
        <div>
          <span className="subject-code">{session.subject_code}</span>
          <h3>{session.subject_name}</h3>
        </div>
        <span className="alert-badge ok">Active</span>
      </div>
      <dl className="active-attendance-details">
        <div><dt>Professor</dt><dd>{session.professor_name}</dd></div>
        <div><dt>Started</dt><dd>{formatDate(session.held_at)}</dd></div>
        <div>
          <dt>Session status</dt>
          <dd>{alreadyRecorded ? `Attendance recorded: ${session.student_status}` : "Active"}</dd>
        </div>
      </dl>
      {message && <p className="active-attendance-message" role="status">{message}</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      {!alreadyRecorded && (
        <>
          <video
            ref={videoRef}
            className="camera-preview student-attendance-camera"
            autoPlay
            muted
            playsInline
            aria-label={`Camera preview for ${session.subject_name} attendance`}
            hidden={!cameraActive}
          />
          <p className="field-hint">
            Your camera opens only after you choose the button. Frames are processed in the browser and are not uploaded.
          </p>
          <div className="actions">
            {!candidate ? (
              <button type="button" disabled={busy} onClick={joinAndVerify}>
                {busy ? "Verifying…" : "Join & Mark Attendance"}
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={confirmAttendance}>
                {busy ? "Marking…" : "Confirm and mark present"}
              </button>
            )}
            {cameraActive && (
              <button type="button" className="secondary" disabled={busy} onClick={stopCamera}>
                Stop camera
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

export default function StudentActiveAttendance({
  token,
  sessions,
  onRefresh,
  onSubmitAttendance,
}) {
  const activeSessions = sessions.filter((session) => session.is_active);

  return (
    <section
      className="dashboard-section active-attendance-section"
      aria-labelledby="active-attendance-heading"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">LIVE CLASS CHECK-IN</p>
          <h2 id="active-attendance-heading">Active Attendance Session</h2>
          <p className="section-description">
            Join a class started by your professor and verify your own attendance.
          </p>
        </div>
        <button type="button" className="secondary" onClick={onRefresh}>
          Refresh sessions
        </button>
      </div>
      {activeSessions.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>No active attendance sessions</h3>
          <p>When a professor starts a session for one of your subjects, it will appear here.</p>
        </div>
      ) : (
        <div className="active-attendance-grid">
          {activeSessions.map((session) => (
            <StudentActiveSessionCard
              key={session.id}
              token={token}
              session={session}
              onSubmitAttendance={onSubmitAttendance}
            />
          ))}
        </div>
      )}
    </section>
  );
}
