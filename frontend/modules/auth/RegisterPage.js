"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import { useRouter } from "next/router";
import { BRANCHES, PROGRAMS, PROOFS, initialRegistrationForm, validateRegistration } from "./registrationForm";
export default function RegisterPage() {
  const router=useRouter();
  const [f, setF] = useState(initialRegistrationForm),
    [files, setFiles] = useState([]),
    [photo, setPhoto] = useState(null),
    [covered, setCovered] = useState(false),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [resumeError,setResumeError] = useState(""),
    [fieldError,setFieldError] = useState(null),
    resumeRef=useRef(null),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [colleges, setColleges] = useState([]),
    [collegeLoad, setCollegeLoad] = useState(true),
    [collegeChoice, setCollegeChoice] = useState("");
  useEffect(() => {
    api("/auth/colleges")
      .then(setColleges)
      .catch((e) => setErr(e.message))
      .finally(() => setCollegeLoad(false));
  }, []);
  const set = (k, v) => {setF((x) => ({ ...x, [k]: v }));if(fieldError===k){setFieldError(null);setErr("");}};
  async function submit(e) {
    e.preventDefault();
    // React clears currentTarget once the handler awaits.
    const form = e.currentTarget;
    setErr("");
    setFieldError(null);
    setResumeError("");
    setMsg("");
    try {
      const { preferredDomains } = validateRegistration({
        form: f,
        files,
        photo,
        covered,
        collegeChoice,
      });
      setBusy(true);
      const body = new FormData();
      Object.entries(f).forEach(([k, v]) => body.append(k, String(v)));
      body.set("preferredDomains", JSON.stringify(preferredDomains));
      if (!covered) files.forEach((x) => body.append("proofFiles", x));
      if (photo) body.append("photo", photo);
      await api("/auth/register", { method: "POST", body });
      form.reset();
      setF(initialRegistrationForm);
      setFiles([]);setPhoto(null);setCollegeChoice("");setShowPassword(false);
      await router.replace("/login?registered=1");
    } catch (x) {
      if (x.field === "resumePortfolioUrl") {
        setResumeError(x.message);
        resumeRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
        resumeRef.current?.focus({preventScroll:true});
      } else {setErr(x.message);setFieldError(x.field||null);if(x.field){requestAnimationFrame(()=>{const el=form.querySelector(`[name="${x.field}"]`);el?.scrollIntoView({behavior:"smooth",block:"center"});el?.focus({preventScroll:true});});}}
    } finally {
      setBusy(false);
    }
  }
  const EyeIcon=({visible})=><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="M3 3l18 18" strokeWidth="2.2"/>}</svg>;
  return (
    <main className="wrap">
      <div className="card registration-card">
        <div className="registration-head">
          <div>
            <h1>Intern Application</h1>
            <p className="muted">
              Complete your profile and college permission details.
            </p>
          </div>
          <span className="badge">Student Registration</span>
        </div>
        <form onSubmit={submit} className="registration-form" autoComplete="off">
          <h3 className="form-section-title">Personal Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Full Name (as in college records)</label>
              <input
                className="input"
                value={f.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                autoComplete="off"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Mobile</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength="10"
                value={f.mobile}
                onChange={(e) =>
                  set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                required
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="form-field">
              <label>Date of Birth</label>
              <input
                className="input"
                type="date"
                value={f.dob}
                onChange={(e) => set("dob", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Address</label>
              <textarea
                className="input"
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Student Photo (optional)</label>
              <input
                className="input"
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              />
              <span className="muted">JPG or PNG, maximum 5 MB.</span>
            </div>
          </div>
          <h3 className="form-section-title">Academic Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="student-college">Select Your College</label>
              <select
                id="student-college"
                className="input"
                value={collegeChoice}
                onChange={(e) => {
                  setCollegeChoice(e.target.value);
                  const id = e.target.value === "OTHER" ? "" : e.target.value;
                  const c = colleges.find((x) => x.id === id);
                  setF((x) => ({
                    ...x,
                    collegeId: id,
                    collegeOther: "",
                    university: c?.university || "",
                  }));
                }}
                required
                disabled={collegeLoad}
              >
                <option value="" disabled>
                  {collegeLoad ? "Loading colleges…" : "Select college"}
                </option>
                {colleges.map((c) => (
                  <option value={c.id} key={c.id}>
                    {[c.name, [c.city,c.state].filter(Boolean).join(", ")].filter(Boolean).join(" — ")}
                  </option>
                ))}
                <option value="OTHER">Other / College not listed</option>
              </select>
              <span className="field-help">
                Select a college added by GAINT Admin. If yours is missing, choose Other.
              </span>
            </div>
            {collegeChoice === "OTHER" && (
              <div className="form-field">
                <label>College Name (Other)</label>
                <input
                  className="input"
                  value={f.collegeOther}
                  onChange={(e) => set("collegeOther", e.target.value)}
                  required
                  placeholder="Enter official college name"
                />
              </div>
            )}
            <div className="form-field">
              <label>University</label>
              <input
                className="input"
                value={f.university}
                onChange={(e) => set("university", e.target.value)}
                required
                readOnly={!!f.collegeId}
              />
            </div>
            <div className="form-field">
              <label>Program</label>
              <select
                className="input"
                value={f.program}
                onChange={(e) => {
                  set("program", e.target.value);
                  if (e.target.value !== "Other") set("programOther", "");
                }}
                required
              >
                <option value="">Select program</option>
                {PROGRAMS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            {f.program === "Other" && (
              <div className="form-field">
                <label>Enter Program Name</label>
                <input
                  className="input"
                  value={f.programOther}
                  onChange={(e) => set("programOther", e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-field">
              <label>Branch / Department</label>
              <select
                className="input"
                value={f.branch}
                onChange={(e) => {
                  set("branch", e.target.value);
                  if (e.target.value !== "Other") set("branchOther", "");
                }}
                required
              >
                <option value="">Select branch / department</option>
                {BRANCHES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            {f.branch === "Other" && (
              <div className="form-field">
                <label>Enter Branch / Department</label>
                <input
                  className="input"
                  value={f.branchOther}
                  onChange={(e) => set("branchOther", e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-field">
              <label>Year / Semester</label>
              <input
                className="input"
                value={f.yearSemester}
                onChange={(e) => set("yearSemester", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Roll / Registration Number</label>
              <input
                className="input"
                value={f.rollNumber}
                onChange={(e) => set("rollNumber", e.target.value)}
                required
              />
            </div>
          </div>
          <h3 className="form-section-title">Internship Preference</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Preferred Domains (up to 3, in preference order)</label>
              <input
                className="input"
                value={f.preferredDomains}
                onChange={(e) => set("preferredDomains", e.target.value)}
                placeholder="Example: Data Analytics, AI/ML, Full Stack"
              />
            </div>
            <div className="form-field">
              <label>Preferred Batch / Start Month</label>
              <input
                className="input"
                value={f.preferredBatch}
                onChange={(e) => set("preferredBatch", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Skills & Tools Known</label>
              <textarea
                className="input"
                value={f.skillsTools}
                onChange={(e) => set("skillsTools", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="resume-drive-link">Resume or Portfolio Link (optional)</label>
              <input
                className="input"
                type="url"
                id="resume-drive-link"
                ref={resumeRef}
                aria-invalid={!!resumeError}
                aria-describedby={resumeError?"resume-drive-error":undefined}
                placeholder="https://drive.google.com/... or https://yourportfolio.com"
                value={f.resumePortfolioUrl}
                onChange={(e) => {set("resumePortfolioUrl",e.target.value);if(resumeError)setResumeError("");}}
              />
              {resumeError&&<span id="resume-drive-error" className="error" role="alert">{resumeError}</span>}
            </div>
          </div>
          <h3 className="form-section-title">College Permission Proof</h3>
          <div className="consent-box">
            <label>
              <input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} />{" "}
              My college issued one allotment order for our batch and GAINT has my roll number on it. I do not need to upload an individual proof.
            </label>
          </div>
          {!covered && <>
          <div className="form-grid">
            <div className="form-field">
              <label>Proof Type</label>
              <select
                className="input"
                value={f.proofType}
                onChange={(e) => set("proofType", e.target.value)}
                required
              >
                <option value="">Select proof type</option>
                {PROOFS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Issuing Authority / Signatory Designation</label>
              <input
                className="input"
                value={f.issuingAuthority}
                onChange={(e) => set("issuingAuthority", e.target.value)}
                required
                placeholder="Principal / HoD / TPO / Dean"
              />
            </div>
            <div className="form-field">
              <label>Letter / Reference Number</label>
              <input
                className="input"
                value={f.referenceNumber}
                onChange={(e) => set("referenceNumber", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Issue Date</label>
              <input
                className="input"
                type="date"
                value={f.issueDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("issueDate", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>College-approved Internship From</label>
              <input
                className="input"
                type="date"
                value={f.approvedFrom}
                onChange={(e) => set("approvedFrom", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>College-approved Internship To</label>
              <input
                className="input"
                type="date"
                value={f.approvedTo}
                min={f.approvedFrom || undefined}
                onChange={(e) => set("approvedTo", e.target.value)}
                required
              />
            </div>
          </div>
          <h4 className="form-subtitle">Faculty Coordinator</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                className="input"
                value={f.coordinatorName}
                onChange={(e) => set("coordinatorName", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Designation</label>
              <input
                className="input"
                value={f.coordinatorDesignation}
                onChange={(e) => set("coordinatorDesignation", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Official Email</label>
              <input
                className="input"
                type="email"
                value={f.coordinatorEmail}
                onChange={(e) => set("coordinatorEmail", e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength="10"
                value={f.coordinatorPhone}
                onChange={(e) =>
                  set(
                    "coordinatorPhone",
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                required
              />
            </div>
            <div className="form-field">
              <label>
                Upload Proof (PDF/JPG/PNG, max 5 MB each, up to 2 files)
              </label>
              <input
                className="input"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(e) =>
                  setFiles(Array.from(e.target.files || []))
                }
                required
              />
            </div>
          </div>
          </>}
          <div className="form-grid form-grid-final">
            <div className="form-field">
              <label>Password</label>
              <div className="password-wrap">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength="10"
                  value={f.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                  placeholder="Create a strong password"
                />
                <button
                  className="eye-btn"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
              <span className="field-help">
                10+ characters with uppercase, lowercase, number and special
                character.
              </span>
            </div>
          </div>
          <div className="consent-box">
            <label>
              <input
                type="checkbox"
                checked={f.consentGenuine}
                onChange={(e) => set("consentGenuine", e.target.checked)}
                required
              />{" "}
              I confirm the uploaded document is genuine and issued by my
              college.
            </label>
            <br />
            <label>
              <input
                type="checkbox"
                checked={f.consentStorage}
                onChange={(e) => set("consentStorage", e.target.checked)}
                required
              />{" "}
              I consent to GAINT storing and verifying the document for
              internship administration.
            </label>
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              {busy ? "Submitting…" : "Submit Application"}
            </button>
          </div>
          {msg&&<p className="success" role="status" aria-live="polite">{msg}</p>}
          {err&&<p className="error" role="alert">{err}</p>}
        </form>
      </div>
      <style jsx global>{`
      .registration-form .eye-btn{display:grid;place-items:center;width:35px;height:35px;border:0;border-radius:9px;background:#e8f4ed;color:#075f40;cursor:pointer}.registration-form .eye-btn:hover{background:#d7ebdf}.registration-form .eye-btn:focus-visible{outline:2px solid #08744b;outline-offset:2px}
      .registration-form .form-actions+.error{margin-top:12px}

.registration-card{max-width:1120px;margin:16px auto 40px;padding:32px 36px;background:#fff;border:1px solid #e0e9e4;border-radius:20px;box-shadow:0 18px 55px rgba(18,52,35,.07)}
.registration-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 0 24px;margin:0 0 8px;border-bottom:1px solid #e7eeea}
.registration-head h1{font-size:clamp(24px,3vw,32px);font-weight:800;letter-spacing:-.8px;line-height:1.2;color:#14291f;margin:0 0 8px}
.registration-head .muted{font-size:13px;line-height:1.6;color:#6a7c72}
.registration-head .badge{padding:9px 14px;border:1px solid #cfe8db;background:#e9f7ef;color:#09633d;font-size:11px;font-weight:800;white-space:nowrap}
.registration-form{display:block}
.registration-form .form-section-title{position:relative;display:flex;align-items:center;min-height:42px;margin:25px 0 16px;padding:10px 15px;border:1px solid #e0ebe5;border-radius:10px;background:linear-gradient(90deg,#e8f5ef,#f3f8ff);color:#174b35;font-size:14px;font-weight:800;letter-spacing:-.15px}
.registration-form .form-section-title:nth-of-type(3n){background:linear-gradient(90deg,#eef0ff,#f7f8ff);border-color:#e4e7f8;color:#343c78}
.registration-form .form-section-title:nth-of-type(4n){background:linear-gradient(90deg,#fff3e2,#fffaf1);border-color:#f4e5ce;color:#81501e}
.registration-form .form-subtitle{margin:21px 0 12px;padding-left:10px;border-left:3px solid #0d7850;color:#244b38;font-size:13px;font-weight:800}
.registration-form .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:22px;row-gap:12px}
.registration-form .form-field{min-width:0;display:flex;flex-direction:column}
.registration-form .form-field>label{font-size:12px;font-weight:750;color:#253b2e;line-height:1.5;margin-bottom:6px}
.registration-form .form-field .input{width:100%;min-height:44px;margin:0;padding:10px 13px;background:#fff;border:1px solid #cddbd2;border-radius:9px;font:inherit;font-size:13px;color:#172e22;transition:border-color .16s,box-shadow .16s}
.registration-form .form-field .input:hover{border-color:#9db8a7}
.registration-form .form-field .input:focus-visible{outline:0;border-color:#18825b;box-shadow:0 0 0 3px rgba(24,130,91,.12)}
.registration-form .form-field .input:disabled,.registration-form .form-field .input:read-only{background:#f3f7f5;color:#52675a}
.registration-form .form-field textarea.input{min-height:82px;resize:vertical}
.registration-form .form-field input[type=file].input{padding:9px 11px;min-height:46px}
.registration-form .form-field input[type=file]::file-selector-button{border:0;border-radius:6px;background:#e7f3ec;color:#135b3d;font-weight:700;padding:7px 10px;margin-right:12px;cursor:pointer}
.registration-form .form-field .muted,.registration-form .field-help{font-size:11px;line-height:1.5;color:#718176;margin:5px 0 0}
.registration-form .form-grid-final{margin-top:18px}
.registration-form .password-wrap{position:relative}
.registration-form .password-wrap .input{padding-right:50px}
.registration-form .password-wrap .eye-btn{right:6px;top:50%;transform:translateY(-50%);color:#315845;background:#eff6f1}
.registration-form .consent-box{margin-top:22px;padding:16px 18px;border:1px solid #cce7d8;border-radius:12px;background:#f0f9f4}
.registration-form .consent-box label{display:flex;align-items:flex-start;gap:9px;font-size:12px;line-height:1.6;font-weight:500;color:#2d4636;margin:7px 0}
.registration-form .consent-box input[type=checkbox]{accent-color:#087448;width:15px;height:15px;flex:none;margin:2px 0 0}
.registration-form .form-actions{margin-top:18px;display:flex;justify-content:flex-end}
.registration-form .form-actions .btn{min-height:44px;min-width:190px;padding:11px 22px;border-radius:10px;background:#08643e;color:white;font-size:13px;font-weight:800;box-shadow:0 5px 14px rgba(8,100,62,.14)}
.registration-form .form-actions .btn:hover{background:#074e32}
.registration-form .error,.registration-form .success{margin-top:12px;padding:12px 14px;border-radius:9px;font-size:12px}
@media(max-width:760px){.registration-card{padding:22px 18px;border-radius:16px;margin:10px auto 24px}.registration-form .form-grid{grid-template-columns:1fr;gap:13px}.registration-head{align-items:flex-start;flex-wrap:wrap;gap:10px}.registration-head .badge{margin:0}.registration-form .form-actions .btn{width:100%}}
@media(prefers-reduced-motion:reduce){.registration-form .form-field .input,.registration-form .form-actions .btn{transition:none}}
`}</style>
    </main>
  );
}
