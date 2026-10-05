import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { tx } from "../../common/database/index.js";
import * as repository from "./auth.repository.js";

const privileged = (role) => ["ADMIN", "SUPER_ADMIN", "MENTOR"].includes(role);
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
  const proofs = files?.proofFiles || [];
  const photoFile = files?.photo?.[0];
  if (new Date(input.issueDate) > new Date()) throw badRequest("Issue date cannot be future");
  if (new Date(input.approvedTo) < new Date(input.approvedFrom))
    throw badRequest("College-approved To date cannot be before From date");
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
  const hashes = proofs.map((file) => crypto
    .createHash("sha256")
    .update(fs.readFileSync(file.path))
    .digest("hex"));
  const combinedHash = crypto
    .createHash("sha256")
    .update(hashes.join(":"))
    .digest("hex");
  const filePaths = JSON.stringify(proofs.map((file) => file.path));
  if (!input.collegeId && !input.collegeOther?.trim())
    throw badRequest("Select a college or enter the college name under Other");

  return tx(async (client) => {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await repository.createInternUser(client, input.email, passwordHash);
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
    const profile = await repository.createInternProfile(client, {
      userId: user.id, fullName: input.fullName, mobile: input.mobile,
      dob: input.dob, address: input.address, photo: photoFile.path || null,
      collegeId: college.id, university: input.university, program, branch,
      yearSemester: input.yearSemester, rollNumber: input.rollNumber,
      preferredDomains: JSON.stringify(preferredDomains),
      preferredBatch: input.preferredBatch || null,
      modePreference: input.modePreference || null,
      skillsTools: input.skillsTools || null,
      resumePortfolioUrl: input.resumePortfolioUrl || null,
    });
    const coordinator = await repository.createCollegeCoordinator(client, {
      collegeId: college.id, name: input.coordinatorName,
      designation: input.coordinatorDesignation, email: input.coordinatorEmail,
      phone: input.coordinatorPhone,
    });
    const proof = await repository.createCollegeProof(client, {
      internId: profile.id, proofType: input.proofType,
      issuingAuthority: input.issuingAuthority, referenceNumber: input.referenceNumber,
      issueDate: input.issueDate, approvedFrom: input.approvedFrom,
      approvedTo: input.approvedTo, coordinatorId: coordinator.id,
      filePaths, fileHash: combinedHash,
    });
    return { ...user, internId: profile.id, proof };
  });
}

export async function login({ email, password }) {
  const user = await repository.findUserByEmail(String(email || "").trim().toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash)))
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  if (!user.is_active)
    throw Object.assign(new Error("Account not approved/active"), { status: 403 });
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
    user: { id: user.id, email: user.email, role: user.role },
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
  if (!user?.mfa_secret || !authenticator.check(String(code || ""), user.mfa_secret))
    throw new Error("Invalid authentication code");
  if (!user.mfa_enabled) await repository.enableMfa(user.id);
  return {
    token: sign(user),
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export const getCurrentUser = (userId) => repository.findPublicUserById(userId);
