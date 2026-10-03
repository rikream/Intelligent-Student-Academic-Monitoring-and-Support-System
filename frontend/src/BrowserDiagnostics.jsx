import { useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  hasCameraSupport,
} from "./browserCapabilities.js";

export default function BrowserDiagnostics() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const recognitionRef = useRef(null);
  const speechStoppingRef = useRef(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera preview is off.");
  const [modelStatus, setModelStatus] = useState("Local face model has not been checked.");
  const [speechStatus, setSpeechStatus] = useState("Speech recognition has not been checked.");
  const [speechListening, setSpeechListening] = useState(false);
  const [manualText, setManualText] = useState("");

  async function startCamera() {
    if (cameraPending) {
      setCameraStatus("Camera permission is still pending.");
      return;
    }
    if (streamRef.current) {
      setCameraStatus("Camera preview is already active.");
      return;
    }
    if (!hasCameraSupport()) {
      setCameraStatus("Camera is not supported in this browser. Use the manual fallback.");
      return;
    }

    const requestId = ++cameraRequestRef.current;
    setCameraPending(true);
    setCameraStatus("Requesting camera permission...");
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
      setCameraStatus("Camera preview is active. No image is being saved.");
    } catch (error) {
      if (cameraRequestRef.current !== requestId) {
        return;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraStatus(`Camera unavailable: ${error.message} Use the manual fallback.`);
    } finally {
      if (cameraRequestRef.current === requestId) {
        setCameraPending(false);
      }
    }
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraPending(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("Camera preview is off.");
  }

  async function checkFaceModel() {
    setModelStatus("Loading local face-detection model...");
    try {
      const faceapi = await import("@vladmandic/face-api");
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      setModelStatus("Local face-detection model loaded.");
    } catch (error) {
      setModelStatus(`Model unavailable: ${error.message}`);
    }
  }

  function startSpeechCheck() {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSpeechStatus("Speech recognition is not supported here. Type into the manual fallback.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    speechStoppingRef.current = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setManualText(transcript);
      setSpeechStatus(transcript ? "Speech converted to editable text. Review it before use." : "No speech was recognized. Type into the manual fallback.");
      setSpeechListening(false);
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" && speechStoppingRef.current) {
        return;
      }
      setSpeechStatus(`Speech recognition failed (${event.error}). Type into the manual fallback.`);
      setSpeechListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setSpeechListening(false);
      speechStoppingRef.current = false;
    };

    try {
      recognition.start();
      setSpeechListening(true);
      setSpeechStatus("Listening for a speech capability check...");
    } catch (error) {
      recognitionRef.current = null;
      setSpeechListening(false);
      setSpeechStatus(`Speech recognition could not start: ${error.message} Type into the manual fallback.`);
    }
  }

  function stopSpeechCheck() {
    speechStoppingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setSpeechListening(false);
    setSpeechStatus("Speech check stopped. Use the manual fallback if needed.");
  }

  return (
    <details className="diagnostics">
      <summary>Browser capability diagnostics (P0)</summary>
      <section className="panel" aria-labelledby="camera-heading">
        <h2 id="camera-heading">Camera and face-model setup</h2>
        <p role="status">{cameraStatus}</p>
        <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label="Live camera preview" />
        <div className="actions">
          <button type="button" onClick={startCamera} disabled={cameraPending}>Start camera preview</button>
          <button type="button" className="secondary" onClick={stopCamera}>Stop camera</button>
        </div>
        <p role="status">{modelStatus}</p>
        <button type="button" className="secondary" onClick={checkFaceModel}>Check face-model loading</button>
        <p className="note">
          This check detects a face only; it does not recognize identity or
          record attendance. No camera frame is saved.
        </p>
      </section>

      <section className="panel" aria-labelledby="speech-heading">
        <h2 id="speech-heading">Speech support and manual fallback</h2>
        <p role="status">{speechStatus}</p>
        <div className="actions">
          <button type="button" onClick={startSpeechCheck}>Start speech check</button>
          <button type="button" className="secondary" onClick={stopSpeechCheck} disabled={!speechListening}>Stop speech check</button>
        </div>
        <label htmlFor="manual-text">Editable manual fallback</label>
        <textarea
          id="manual-text"
          value={manualText}
          onChange={(event) => setManualText(event.target.value)}
          placeholder="Type a test phrase if speech recognition is unavailable."
          rows="3"
        />
        <p className="note">
          Speech is only transcribed for this capability check. It does not
          create or save attendance records.
        </p>
      </section>
    </details>
  );
}
