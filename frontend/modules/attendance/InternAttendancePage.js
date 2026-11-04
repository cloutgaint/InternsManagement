"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import Link from "next/link";
const challenges = ["TURN_LEFT", "TURN_RIGHT"];
export default function InternAttendancePage() {
  const [correction, setCorrection] = useState({ day: "", requestedStatus: "PRESENT", reason: "" });
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
    setMsg("");
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
  async function requestCorrection(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api("/intern/attendance/correction", { method: "POST", body: JSON.stringify(correction) });
      setMsg("Correction request sent for approval.");
      setCorrection({ day: "", requestedStatus: "PRESENT", reason: "" });
      load();
    } catch (x) {
      setErr(x.message);
    }
  }
  const instruction = {
    TURN_LEFT: "Turn your head to the left",
    TURN_RIGHT: "Turn your head to the right",
  }[challenge];
  const approved = st?.face?.status === "APPROVED";
  const dayComplete = Boolean(st?.today?.check_in && st?.today?.check_out);
  const cameraOn = ["STARTING", "CHALLENGE", "VERIFYING"].includes(phase);
  const step = phase === "STARTING" ? 1 : phase === "CHALLENGE" ? 2 : phase === "VERIFYING" ? 3 : 0;
  const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
  const minutes = st?.today?.working_minutes || 0;
  return (
    <main className="wrap att-page">
      <div className="intern-head">
        <div>
          <h1>Camera Attendance</h1>
          <p className="muted">
            {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <span className={"status-pill " + (approved ? "status-verified" : "")}>
          {approved ? "FACE APPROVED" : (st?.face?.status || "NO FACE ENROLLMENT").replaceAll("_", " ")}
        </span>
      </div>
      {st && !approved && (
        <section className="card att-register">
          <div>
            <h2>Face registration required</h2>
            <p className="muted">
              {st?.face?.status === "PENDING_ADMIN_APPROVAL"
                ? "Your face registration is awaiting Admin approval. Attendance will be available after approval."
                : st?.face?.status === "REENROLLMENT_REQUIRED" || st?.face?.status === "REJECTED"
                  ? "Please register again" + (st.face.decision_reason ? ". Admin note: " + st.face.decision_reason : ".")
                  : "Register your face before using camera attendance. Admin approval is required."}
            </p>
          </div>
          <Link href="/intern/face-enrollment" className="btn secondary">
            {st?.face?.status === "PENDING_ADMIN_APPROVAL" ? "View Face Registration" : "Register Face"}
          </Link>
        </section>
      )}
      <div className="att-stats">
        <div className="card">
          <small>Check in</small>
          <strong>{time(st?.today?.check_in)}</strong>
        </div>
        <div className="card">
          <small>Check out</small>
          <strong>{time(st?.today?.check_out)}</strong>
        </div>
        <div className="card">
          <small>Working time</small>
          <strong>{Math.floor(minutes / 60)}h {minutes % 60}m</strong>
        </div>
      </div>
      <section className="card attendance-camera">
        <div className={"camera-stage" + (cameraOn ? " live" : "")}>
          <video ref={video} className="face-video att-video" playsInline muted />
          <canvas ref={canvas} hidden />
          {!cameraOn && (
            <div className="att-placeholder">
              <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
              </svg>
              <span>{phase === "DONE" ? "Attendance recorded" : dayComplete ? "You're done for today" : "Camera is off"}</span>
            </div>
          )}
          {cameraOn && <div className="att-oval" aria-hidden="true" />}
          {phase === "STARTING" && <div className="att-banner">Looking for your face…</div>}
          {phase === "VERIFYING" && <div className="att-banner">Verifying your face…</div>}
          {phase === "CHALLENGE" && (
            <div className="liveness-challenge">
              <small>LIVE CHALLENGE</small>
              <strong>{instruction}</strong>
              <span>Hold the turned position, then press Verify.</span>
            </div>
          )}
        </div>
        <div className="attendance-side">
          <h2>{dayComplete ? "Attendance complete" : eventType === "CHECK_IN" ? "Check in" : "Check out"}</h2>
          <ol className="att-steps">
            {["Start the camera and face it directly", "Follow the on-screen head turn", "Press Verify to record attendance"].map((label, i) => (
              <li key={label} className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""}>
                <span>{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          {msg && <p className="success">{msg}</p>}
          {err && <p className="error">{err}</p>}
          <div className="att-actions">
            {(phase === "READY" || phase === "DONE") && !dayComplete && (
              <button className="btn" disabled={!approved || st?.dayState?.blocked} onClick={start}>
                {eventType === "CHECK_IN" ? "Start check-in" : "Start check-out"}
              </button>
            )}
            {phase === "STARTING" && <button className="btn" disabled>Detecting face…</button>}
            {phase === "CHALLENGE" && <button className="btn" onClick={verify}>Verify face</button>}
            {phase === "VERIFYING" && <button className="btn" disabled>Verifying…</button>}
            {cameraOn && (
              <button type="button" className="btn secondary" onClick={stopCamera}>
                Stop camera
              </button>
            )}
          </div>
          <ul className="att-tips muted">
            <li>Use good, even lighting and keep your face inside the oval.</li>
            <li>Only you should be in the frame. Remove masks or dark glasses.</li>
          </ul>
        </div>
      </section>
      {st?.dayState?.blocked && <p className="proof-alert" role="status">{st.dayState.message}</p>}
      {st?.summary && (
        <section className="card">
          <h2>Attendance Summary{st.allocation?.batch_name ? " · " + st.allocation.batch_name : ""}</h2>
          <div className="att-stats">
            <div className="card"><small>Attendance</small><strong>{st.summary.attendance_percent}%</strong></div>
            <div className="card"><small>Present / Late</small><strong>{st.summary.present_days} / {st.summary.late_days}</strong></div>
            <div className="card"><small>Absent</small><strong>{st.summary.absent_days}</strong></div>
            <div className="card"><small>On leave / Holiday</small><strong>{st.summary.leave_days} / {st.summary.holiday_days}</strong></div>
          </div>
          <p className="muted">Minimum required for completion: {st.allocation?.min_attendance ?? "—"}%. Holidays and approved leave are not counted.</p>
          <div>
            {(st.history || []).slice(0, 14).map((x) => (
              <div className="status-row" key={x.day}>
                <span>{x.day}{x.holiday_name ? " · " + x.holiday_name : ""}{x.source === "MANUAL" ? " · corrected" : ""}</span>
                <span className="status-pill">{String(x.status).replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="card">
        <h2>Request a Correction</h2>
        <p className="muted">If a camera or matching problem cost you attendance, ask for it to be reviewed. Corrections need approval and are recorded.</p>
        <form className="form-grid" onSubmit={requestCorrection}>
          <div className="form-field"><label htmlFor="correction-day">Date</label><input id="correction-day" className="input" type="date" required value={correction.day} onChange={(e) => setCorrection((x) => ({ ...x, day: e.target.value }))} /></div>
          <div className="form-field"><label htmlFor="correction-status">Mark as</label><select id="correction-status" className="input" value={correction.requestedStatus} onChange={(e) => setCorrection((x) => ({ ...x, requestedStatus: e.target.value }))}><option value="PRESENT">Present</option><option value="LATE">Late</option></select></div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="correction-reason">Reason</label><textarea id="correction-reason" className="input" required value={correction.reason} onChange={(e) => setCorrection((x) => ({ ...x, reason: e.target.value }))} /></div>
          <div className="form-actions"><button className="btn secondary">Send Request</button></div>
        </form>
        {(st?.exceptions || []).map((x) => (
          <div className="status-row" key={x.id}>
            <span><b>{x.day}</b> · {x.kind === "FAILED_MATCH" ? "Failed face match" : "Correction request"}<br /><small>{x.decision_reason || x.reason}</small></span>
            <span className="status-pill">{x.status}</span>
          </div>
        ))}
      </section>
      <p className="att-privacy muted">
        Your captures are compared with your approved face registration and kept as attendance evidence. If
        verification fails you can retry; repeated failures create an exception for an Admin to review.
      </p>
    </main>
  );
}
