"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import Link from "next/link";
const challenges = ["TURN_LEFT", "TURN_RIGHT"];
export default function InternAttendancePage() {
  const video = useRef(null),
    canvas = useRef(null),
    stream = useRef(null),
    humanRef = useRef(null),
    baselineRef = useRef(null);
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
    } catch {
      return setErr("Allow camera permission to continue.");
    }
    setErr("");
    setPhase("STARTING");
    try {
      // The baseline must be a real frame showing the student facing forward,
      // otherwise the server cannot measure the head-turn challenge.
      await waitForFrame();
      await new Promise((r) => setTimeout(r, 700));
      await requireSingleFace();
      if (!stream.current) return;
      baselineRef.current = capture();
      if (!baselineRef.current) throw new Error("Camera is not ready.");
      setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
      setPhase("CHALLENGE");
    } catch (e) {
      if (!stream.current) return;
      stopCamera();
      setErr(e.message);
    }
  }
  async function waitForFrame() {
    const v = video.current;
    for (let i = 0; i < 50 && !v?.videoWidth; i++)
      await new Promise((r) => setTimeout(r, 100));
    if (!v?.videoWidth) throw new Error("Camera did not start. Try again.");
  }
  async function requireSingleFace() {
    if (!humanRef.current) {
      const { default: Human } = await import("@vladmandic/human");
      humanRef.current = new Human({
        backend: "webgl",
        modelBasePath: "https://vladmandic.github.io/human-models/models/",
        face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: false }, emotion: { enabled: false }, iris: { enabled: false } },
        body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false },
      });
      await humanRef.current.load();
    }
    const faces = (await humanRef.current.detect(video.current)).face || [];
    if (faces.length !== 1) throw new Error(faces.length ? "Multiple faces detected. Only one student should be visible." : "No face detected. Face the camera in good lighting and try again.");
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((track)=>track.stop());
    stream.current=null;
    if(video.current){video.current.pause();video.current.srcObject=null;}
    baselineRef.current=null;setChallenge("");setPhase("READY");setErr("");
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
    if (!baselineRef.current) return setErr("Initial face capture missing. Stop the camera and start again.");
    setPhase("VERIFYING");
    setErr("");
    try {
      await requireSingleFace();
      const x = await api("/intern/attendance/verify", {
        method: "POST",
        body: JSON.stringify({ eventType, imageData, baselineImageData: baselineRef.current, challengeType: challenge }),
      });
      setMsg(
        eventType === "CHECK_IN"
          ? "Check-in recorded successfully."
          : "Check-out recorded successfully. Working time: " +
              (x.daily?.working_minutes || 0) +
              " minutes.",
      );
      stopCamera();
      setPhase("DONE");
      load();
    } catch (e) {
      setErr(
        e.message === "Trusted biometric verification is not configured" ||
          e.message === "Biometric verifier unavailable"
          ? "Face captured, but attendance cannot be recorded because the biometric verification service is not running. Contact the Admin."
          : e.message === "Failed to fetch"
            ? "Cannot reach the attendance server. Check your connection and try again."
            : e.message,
      );
      setPhase("CHALLENGE");
      load();
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
      {st?.face?.status !== "APPROVED" && <section className="card" style={{marginBottom:16}}><h2>Face Registration Required</h2><p className="muted">{st?.face?.status==="PENDING_ADMIN_APPROVAL"?"Your face registration is awaiting Admin approval. Attendance will be available after approval.":"Register your face before using camera attendance. Admin approval is required."}</p><Link href="/intern/face-enrollment" className="btn secondary">{st?.face?.status==="PENDING_ADMIN_APPROVAL"?"View Face Registration":"Register Face"}</Link></section>}
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
            {phase === "STARTING" && (
              <button className="btn" disabled>
                Detecting face…
              </button>
            )}
            {(phase === "STARTING" || phase === "CHALLENGE" || phase === "VERIFYING") && <button type="button" className="btn secondary" onClick={stopCamera}>Stop Camera</button>}
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
