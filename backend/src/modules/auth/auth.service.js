import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { tx, q } from "../../common/database/index.js";
import * as repository from "./auth.repository.js";
import { passwordSchema } from "./auth.schema.js";
import { sendMail } from "../../common/notifications/mail.service.js";
import { detectFileType } from "../../common/storage/secureFiles.js";
import { findCoveringOrder, linkInternToOrder, storeProofFiles, validateProofDetails, latestProof } from "../../services/proofService.js";

// Accept the adjacent 30-second steps so typing delay or phone clock drift does not reject a valid code.
authenticator.options = { window: 1 };

const privileged = (role) => ["ADMIN", "SUPER_ADMIN", "MENTOR", "COLLEGE_COORDINATOR"].includes(role);
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const sign = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, mfa: true },
  process.env.JWT_SECRET,
  { expiresIn: "8h" },
);

function challengeUser(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== "MFA_CHALLENGE") throw new Error("Invalid MFA challenge");
  return payload;
}

export const getColleges = () => repository.findActiveColleges();

export async function registerIntern(input, files) {
  const submittedLink=String(input.resumePortfolioUrl||"").trim();
  if(submittedLink){
    let validLink=false;
    try{const url=new URL(submittedLink);validLink=url.protocol==="https:"&&!!url.hostname;}catch{}
    if(!validLink)throw badRequest("Resume or portfolio link must be a valid HTTPS URL");
  }
  const proofs = files?.proofFiles || [];
  const photoFile = files?.photo?.[0];
  if (photoFile && !["image/jpeg","image/png"].includes(detectFileType(fs.readFileSync(photoFile.path))?.mime))
    throw badRequest("Student photo must be a JPG or PNG image");
  if (input.program === "Other" && !input.programOther?.trim())
    throw badRequest("Program name is required when Other is selected");
  if (input.branch === "Other" && !input.branchOther?.trim())
    throw badRequest("Branch / department is required when Other is selected");

  let preferredDomains = [];
  try { preferredDomains = JSON.parse(input.preferredDomains); } catch {}
  if (!Array.isArray(preferredDomains) || preferredDomains.length > 3)
    throw badRequest("Preferred domains must contain up to 3 choices");

  const program = input.program === "Other" ? input.programOther.trim() : input.program;
  const branch = input.branch === "Other" ? input.branchOther.trim() : input.branch;
  if (!input.collegeId && !input.collegeOther?.trim())
    throw badRequest("Select a college or enter the college name under Other");

  const stored = proofs.length ? await storeProofFiles(proofs) : null;
  if (stored) validateProofDetails(input);

  return tx(async (client) => {
    const run = client.query.bind(client);
    let college;
    if (input.collegeId) {
      college = await repository.findActiveCollegeById(client, input.collegeId);
      if (!college) throw badRequest("Selected college is not available");
    } else {
      const name = input.collegeOther.trim();
      college = await repository.findCollegeByName(client, name);
      if (!college)
        college = await repository.createInactiveCollege(client, name, input.university);
    }
    const email=String(input.email).trim().toLowerCase();
    const rollNumber=String(input.rollNumber).trim();
    // Serialize registrations for this college and roll number to avoid racing duplicates.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`student-roll:${college.id}:${rollNumber.toLowerCase()}`]);
    const existingRoll=await client.query(
      "SELECT 1 FROM intern_profiles ip JOIN users u ON u.id=ip.user_id WHERE ip.college_id=$1 AND lower(btrim(ip.roll_number))=lower($2) AND u.status<>'DELETED' LIMIT 1",
      [college.id,rollNumber],
    );
    if(existingRoll.rowCount)throw Object.assign(new Error("This roll number is already registered for the selected college."),{status:409,field:"rollNumber"});
    const passwordHash=await bcrypt.hash(input.password,12);
    const user=await repository.createInternUser(client,email,passwordHash);
    const profile = await repository.createInternProfile(client, {
      userId: user.id, fullName: input.fullName, mobile: input.mobile,
      dob: input.dob, address: input.address, photo: photoFile?.path || null,
      collegeId: college.id, university: input.university, program, branch,
      yearSemester: input.yearSemester, rollNumber,
      preferredDomains: JSON.stringify(preferredDomains),
      preferredBatch: input.preferredBatch || null,
      modePreference: input.modePreference || null,
      skillsTools: input.skillsTools || null,
      resumePortfolioUrl: input.resumePortfolioUrl || null,
    });
    const order = await findCoveringOrder(run, college.id, rollNumber);
    if (!stored && !order)
      throw badRequest("College permission proof is required unless your roll number is on a verified batch allotment order");
    let proof;
    if (stored) {
      const coordinator = await repository.createCollegeCoordinator(client, {
        collegeId: college.id, name: input.coordinatorName,
        designation: input.coordinatorDesignation, email: input.coordinatorEmail,
        phone: input.coordinatorPhone,
      });
      proof = await repository.createCollegeProof(client, {
        internId: profile.id, proofType: input.proofType,
        issuingAuthority: input.issuingAuthority, referenceNumber: input.referenceNumber,
        issueDate: input.issueDate, approvedFrom: input.approvedFrom,
        approvedTo: input.approvedTo, coordinatorId: coordinator.id, ...stored,
      });
    } else {
      proof = await linkInternToOrder(run, order, profile.id);
      await client.query("UPDATE users SET status='PENDING_APPROVAL' WHERE id=$1", [user.id]);
    }
    return { ...user, internId: profile.id, proof, coveredByBatchOrder: !stored };
  });
}

async function credentialedApplicant({ email, password }) {
  const normalized = String(email || "").trim().toLowerCase();
  const user = (await q(
    "SELECT * FROM users WHERE lower(btrim(email))=$1 AND status<>'DELETED' AND role='INTERN' ORDER BY created_at DESC LIMIT 1",
    [normalized],
  )).rows[0];
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash)))
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  const profile = (await q("SELECT * FROM intern_profiles WHERE user_id=$1", [user.id])).rows[0];
  return { user, profile };
}

// Applicants cannot log in before approval, so they authenticate each request with their credentials.
export async function applicationStatus(input) {
  const { user, profile } = await credentialedApplicant(input);
  const proof = profile && await latestProof(profile.id);
  return {
    status: user.status, reason: user.status_reason, active: user.is_active,
    canReupload: user.status === "PROOF_REUPLOAD_REQUIRED",
    canCorrect: user.status === "CORRECTION_REQUESTED",
    profile: profile && { fullName: profile.full_name, mobile: profile.mobile, address: profile.address, university: profile.university, program: profile.program, branch: profile.branch, yearSemester: profile.year_semester, rollNumber: profile.roll_number },
    proof: proof && { status: proof.status, reason: proof.reason, referenceNumber: proof.reference_number, version: proof.version, coveredByBatchOrder: !!proof.batch_order_id },
  };
}

export async function reuploadProof(input, files) {
  const { user, profile } = await credentialedApplicant(input);
  if (user.status !== "PROOF_REUPLOAD_REQUIRED")
    throw Object.assign(new Error("A re-upload has not been requested for this application"), { status: 409 });
  validateProofDetails(input);
  const stored = await storeProofFiles(files || []);
  const previous = await latestProof(profile.id);
  return tx(async (client) => {
    const proof = await repository.createCollegeProof(client, {
      internId: profile.id, proofType: input.proofType, issuingAuthority: input.issuingAuthority,
      referenceNumber: input.referenceNumber, issueDate: input.issueDate, approvedFrom: input.approvedFrom,
      approvedTo: input.approvedTo, coordinatorId: previous?.coordinator_id || null, ...stored,
      version: Number(previous?.version || 0) + 1,
    });
    await client.query("UPDATE users SET status='PROOF_UNDER_REVIEW',status_reason=NULL,updated_at=now() WHERE id=$1", [user.id]);
    return proof;
  });
}

export async function submitCorrection(input) {
  const { user, profile } = await credentialedApplicant(input);
  if (user.status !== "CORRECTION_REQUESTED")
    throw Object.assign(new Error("A correction has not been requested for this application"), { status: 409 });
  const fullName = String(input.fullName ?? profile.full_name).trim();
  if (fullName.length < 2) throw badRequest("Full name is required");
  const proof = await latestProof(profile.id);
  const next = proof && ["VERIFIED", "OVERRIDE"].includes(proof.status) ? "PENDING_APPROVAL" : "PROOF_UNDER_REVIEW";
  await tx(async (client) => {
    await client.query(
      "UPDATE intern_profiles SET full_name=$1,mobile=$2,address=$3,university=$4,program=$5,branch=$6,year_semester=$7,roll_number=$8 WHERE id=$9",
      [fullName, input.mobile ?? profile.mobile, input.address ?? profile.address, input.university ?? profile.university, input.program ?? profile.program, input.branch ?? profile.branch, input.yearSemester ?? profile.year_semester, input.rollNumber ?? profile.roll_number, profile.id],
    );
    await client.query("UPDATE users SET status=$1,status_reason=NULL,updated_at=now() WHERE id=$2", [next, user.id]);
  });
  return { status: next };
}

export async function requestPasswordReset(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const user = (await q("SELECT id,email FROM users WHERE lower(btrim(email))=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1", [normalized])).rows[0];
  if (!user) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await q("UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [user.id]);
  await q("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [user.id, crypto.createHash("sha256").update(token).digest("hex")]);
  const link = (process.env.FRONTEND_URL || "http://localhost:3000") + "/reset-password?token=" + token;
  await sendMail({ to: user.email, subject: "Reset your GAINT Intern Management password", text: "Use this link within 30 minutes to set a new password:\n\n" + link + "\n\nIf you did not request this, ignore this email." });
}

const applyPassword = async (run, userId, password) => {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || "Password does not meet the security policy");
  await run("UPDATE users SET password_hash=$1,password_changed_at=now(),must_change_password=false,updated_at=now() WHERE id=$2", [await bcrypt.hash(password, 12), userId]);
};

export async function resetPassword(token, password) {
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  await tx(async (client) => {
    const run = client.query.bind(client);
    const row = (await run("UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id", [hash])).rows[0];
    if (!row) throw badRequest("This password reset link is invalid or has expired");
    await applyPassword(run, row.user_id, password);
  });
}

export async function changePassword(userId, currentPassword, password) {
  const user = await repository.findUserById(userId);
  if (!user || !(await bcrypt.compare(String(currentPassword || ""), user.password_hash)))
    throw Object.assign(new Error("Current password is incorrect"), { status: 401 });
  await applyPassword(q, userId, password);
  return { token: jwt.sign({ id: user.id, email: user.email, role: user.role, mfa: true }, process.env.JWT_SECRET, { expiresIn: "8h" }) };
}

export async function adminResetPassword(userId, password) {
  await applyPassword(q, userId, password);
  await q("UPDATE users SET must_change_password=true WHERE id=$1", [userId]);
}

export async function login({ email, password }) {
  const normalizedEmail=String(email||"").trim().toLowerCase();
  const user=(await q("SELECT * FROM users WHERE lower(btrim(email))=$1 AND status<>$2 ORDER BY created_at DESC,id DESC LIMIT 1",[normalizedEmail,"DELETED"])).rows[0];
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash)))
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  if (!user.is_active)
    throw Object.assign(new Error(user.status === "PENDING_APPROVAL" ? "Your college permission proof is verified. Your account is awaiting Admin approval." : user.status === "PROOF_UNDER_REVIEW" ? "Your college permission proof is awaiting Admin verification." : user.status === "PROOF_REUPLOAD_REQUIRED" ? "Admin requested a new college permission proof. Open Check Application Status to upload it." : user.status === "CORRECTION_REQUESTED" ? "Admin requested a correction to your application. Open Check Application Status to fix it." : user.status === "PROOF_REJECTED" || user.status === "REJECTED" ? "Your application was rejected" + (user.status_reason ? ": " + user.status_reason : ".") : "Your account is not active. Please contact Admin."), { status: 403 });
  if (privileged(user.role)) {
    const challenge = jwt.sign(
      { id: user.id, purpose: "MFA_CHALLENGE" },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );
    return {
      mfaRequired: true, mfaSetupRequired: !user.mfa_enabled, challenge,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
  return {
    token: jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    ),
    user: { id: user.id, email: user.email, role: user.role, mustChangePassword: user.must_change_password },
  };
}

export async function setupMfa(challenge) {
  const payload = challengeUser(challenge);
  const user = await repository.findUserById(payload.id);
  if (!user || !privileged(user.role))
    throw Object.assign(new Error("MFA is only available for privileged roles"), { status: 403 });
  if (user.mfa_enabled)
    throw Object.assign(new Error("MFA is already enabled"), { status: 409 });
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(user.email, "GAINT Intern Management", secret);
  const qrDataUrl = await QRCode.toDataURL(uri);
  await repository.saveMfaSecret(user.id, secret);
  return { qrDataUrl, secret };
}

export async function verifyMfa(challenge, code) {
  const payload = challengeUser(challenge);
  const user = await repository.findUserById(payload.id);
  const normalizedCode = String(code || "").trim();
  const localTestCode = process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_MFA_CODE === "true" && normalizedCode === "000000" && ["ADMIN", "SUPER_ADMIN", "COLLEGE_COORDINATOR"].includes(user?.role);
  const isValidCode = localTestCode || (!!user?.mfa_secret && authenticator.check(normalizedCode, user.mfa_secret));

  if (!user || !isValidCode)
    throw Object.assign(new Error("Invalid authentication code"), { status: 401 });

  if (!user.mfa_enabled) await repository.enableMfa(user.id);
  return {
    token: sign(user),
    user: { id: user.id, email: user.email, role: user.role, mustChangePassword: user.must_change_password },
  };
}

export const getCurrentUser = (userId) => repository.findPublicUserById(userId);
