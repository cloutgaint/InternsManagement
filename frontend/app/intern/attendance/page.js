"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
const challenges = ["TURN_LEFT", "TURN_RIGHT", "BLINK", "SMILE"];
export default function Page() {
  const video = useRef(null),
    canvas = useRef(null),
    stream = useRef(null);
  const [st, setSt] = useState(null),
    [eventType, setEventType] = useState("CHECK_IN"),
    [challenge, setChallenge] = useState(""),
    [phase, setPhase] = useState("READY"),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api("/intern/attendance/status")
      .then((x) => {
        setSt(x);
        setEventType(
          x.today?.check_in && !x.today?.check_out ? "CHECK_OUT" : "CHECK_IN",
        );
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, []);
  async function start() {
    if (st?.face?.status !== "APPROVED")
      return setErr("Admin-approved face enrollment is required first.");
    try {
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
      setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
      setPhase("CHALLENGE");
      setErr("");
    } catch {
      setErr("Allow camera permission to continue.");
    }
  }
  function capture() {
    const v = video.current,
      c = canvas.current;
    if (!v?.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight),
      sx = (v.videoWidth - size) / 2,
      sy = (v.videoHeight - size) / 2;
    c.width = 640;
    c.height = 640;
    c.getContext("2d").drawImage(v, sx, sy, size, size, 0, 0, 640, 640);
    return c.toDataURL("image/jpeg", 0.9);
  }
  async function verify() {
    const imageData = capture();
    if (!imageData) return setErr("Camera is not ready.");
    setPhase("VERIFYING");
    try {
      /* Browser challenge confirms user interaction; production biometric matcher must supply the actual face similarity score. */ const matcher =
        window.GAINT_FACE_MATCHER;
      if (typeof matcher !== "function")
        throw new Error(
          "Face matching service is not configured. Connect GAINT_FACE_MATCHER before enabling attendance in production.",
        );
      const result = await matcher({ imageData, challengeType: challenge });
      const x = await api("/intern/attendance/verify", {
        method: "POST",
        body: JSON.stringify({
          eventType,
          imageData,
          challengeType: challenge,
          challengePass: result.challengePass === true,
          livenessScore: Number(result.livenessScore),
          matchScore: Number(result.matchScore),
        }),
      });
      setMsg(
        eventType === "CHECK_IN"
          ? "Check-in recorded successfully."
          : "Check-out recorded successfully. Working time: " +
              (x.daily?.working_minutes || 0) +
              " minutes.",
      );
      setPhase("DONE");
      stream.current?.getTracks().forEach((t) => t.stop());
      load();
    } catch (e) {
      setErr(e.message);
      setPhase("CHALLENGE");
    }
  }
  const instruction = {
    TURN_LEFT: "Turn your head to the LEFT",
    TURN_RIGHT: "Turn your head to the RIGHT",
    BLINK: "Blink your eyes",
    SMILE: "Smile naturally",
  }[challenge];
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Camera Attendance</h1>
          <p className="muted">
            Attendance is recorded only after approved enrollment, a live
            challenge and biometric face matching.
          </p>
        </div>
        <span className="status-pill">
          {st?.face?.status || "NO FACE ENROLLMENT"}
        </span>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card attendance-camera">
        <div className="camera-stage">
          <video ref={video} className="face-video" playsInline muted />
          <canvas ref={canvas} hidden />
          {phase === "CHALLENGE" && (
            <div className="liveness-challenge">
              <small>LIVE CHALLENGE</small>
              <strong>{instruction}</strong>
              <span>Complete the action naturally, then press Verify.</span>
            </div>
          )}
        </div>
        <div className="attendance-side">
          <h2>{eventType === "CHECK_IN" ? "Check In" : "Check Out"}</h2>
          {st?.today ? (
            <div className="detail-grid">
              <div>
                <b>Check in</b>
                <span>
                  {st.today.check_in
                    ? new Date(st.today.check_in).toLocaleTimeString()
                    : "—"}
                </span>
              </div>
              <div>
                <b>Check out</b>
                <span>
                  {st.today.check_out
                    ? new Date(st.today.check_out).toLocaleTimeString()
                    : "—"}
                </span>
              </div>
              <div>
                <b>Working time</b>
                <span>{st.today.working_minutes || 0} minutes</span>
              </div>
            </div>
          ) : (
            <p className="muted">No attendance recorded today.</p>
          )}
          <div className="form-actions">
            {phase === "READY" && (
              <button
                className="btn"
                disabled={st?.face?.status !== "APPROVED"}
                onClick={start}
              >
                Start Camera Verification
              </button>
            )}
            {phase === "CHALLENGE" && (
              <button className="btn" onClick={verify}>
                I Completed It — Verify Face
              </button>
            )}
            {phase === "VERIFYING" && (
              <button className="btn" disabled>
                Verifying…
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="proof-alert">
        <b>Anti-spoof protection</b>
        <span>
          A random action challenge is required, but the challenge and face
          similarity must be validated by the configured biometric/liveness
          engine. The application does not fabricate a successful biometric
          result.
        </span>
      </div>
    </main>
  );
}
