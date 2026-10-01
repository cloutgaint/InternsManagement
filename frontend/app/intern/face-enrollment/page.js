"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
export default function Page() {
  const video = useRef(null),
    canvas = useRef(null),
    stream = useRef(null);
  const [status, setStatus] = useState(null),
    [shot, setShot] = useState(""),
    [consent, setConsent] = useState(false),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/intern/dashboard")
      .then((x) => setStatus(x.face))
      .catch((e) => setErr(e.message));
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, []);
  async function camera() {
    try {
      setErr("");
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.current.srcObject = stream.current;
      await video.current.play();
    } catch (e) {
      setErr(
        "Camera permission is required. Allow camera access in your browser and try again.",
      );
    }
  }
  function capture() {
    const v = video.current,
      c = canvas.current;
    if (!v?.videoWidth) return setErr("Start the camera first.");
    const size = Math.min(v.videoWidth, v.videoHeight),
      sx = (v.videoWidth - size) / 2,
      sy = (v.videoHeight - size) / 2;
    c.width = 640;
    c.height = 640;
    c.getContext("2d").drawImage(v, sx, sy, size, size, 0, 0, 640, 640);
    setShot(c.toDataURL("image/jpeg", 0.9));
  }
  async function submit() {
    if (!shot || !consent) return;
    try {
      setBusy(true);
      const x = await api("/intern/face-enrollment", {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          imageData: shot,
          qualityScore: 1,
        }),
      });
      setStatus(x);
      setMsg("Face registration submitted for Admin approval.");
      stream.current?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const locked =
    status && ["PENDING_ADMIN_APPROVAL", "APPROVED"].includes(status.status);
  return (
    <main className="wrap face-page">
      <div className="intern-head">
        <div>
          <h1>Face Registration</h1>
          <p className="muted">
            Register your face once for camera-based internship attendance.
            Admin approval is required before attendance can use it.
          </p>
        </div>
        {status && <span className="status-pill">{status.status}</span>}
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {locked ? (
        <section className="card face-status">
          <h2>
            {status.status === "APPROVED"
              ? "Face registration approved"
              : "Waiting for Admin approval"}
          </h2>
          <p className="muted">
            {status.status === "APPROVED"
              ? "Your approved face registration is ready for attendance verification."
              : "Your capture has been submitted. You cannot replace it while review is pending."}
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="face-guide">
              <b>Before capturing</b>
              <span>
                Use good front lighting · Remove mask/sunglasses · Keep only one
                face visible · Look directly at the camera.
              </span>
            </div>
            <div className="face-capture-grid">
              <div>
                <video ref={video} className="face-video" playsInline muted />
                <canvas ref={canvas} hidden />
                <div className="action-row">
                  <button className="btn secondary" onClick={camera}>
                    Start Camera
                  </button>
                  <button className="btn" onClick={capture}>
                    Capture Face
                  </button>
                </div>
              </div>
              <div className="face-preview">
                {shot ? (
                  <img src={shot} alt="Captured face preview" />
                ) : (
                  <span>Captured photo preview</span>
                )}
              </div>
            </div>
          </section>
          <section className="card">
            <label className="face-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I consent to the use of this face capture for internship
                attendance verification and understand that it requires Admin
                approval.
              </span>
            </label>
            <div className="form-actions">
              <button
                className="btn"
                disabled={!shot || !consent || busy}
                onClick={submit}
              >
                {busy ? "Submitting…" : "Submit Face Registration"}
              </button>
              {shot && (
                <button className="btn secondary" onClick={() => setShot("")}>
                  Retake
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
