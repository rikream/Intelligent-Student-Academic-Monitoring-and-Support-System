import { useEffect, useState } from "react";
import { requestApi } from "./apiClient.js";

export default function FaceTemplatePrivacy({ token }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    requestApi("/attendance/face-template", { token })
      .then((result) => {
        if (active) {
          setStatus(result);
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
  }, [token]);

  async function removeTemplate() {
    setBusy(true);
    setError("");
    try {
      await requestApi("/attendance/face-template", { token, method: "DELETE" });
      setStatus((current) => ({ ...current, registered: false }));
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="privacy" className="dashboard-section privacy-section" aria-labelledby="face-privacy-heading">
      <h3 id="face-privacy-heading">Face-template privacy</h3>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {status === null ? (
        <p role="status">Checking face-template status...</p>
      ) : (
        <>
          <p role="status">
            {status.registered
              ? "An encrypted face descriptor is stored for your account."
              : "No face descriptor is stored for your account."}
          </p>
          {status.registered && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={removeTemplate}
            >
              Remove my face template
            </button>
          )}
        </>
      )}
    </section>
  );
}
