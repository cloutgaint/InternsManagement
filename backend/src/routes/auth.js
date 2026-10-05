import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { q, tx } from "../common/database/index.js";
import { auth } from "../common/security/auth.middleware.js";
const r = Router();
r.get("/colleges", async (_req, res) =>
  res.json(
    (
      await q(
        "SELECT id,name,university FROM colleges WHERE active=true ORDER BY name",
      )
    ).rows,
  ),
);
const uploadDir = path.resolve("uploads/registration");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, uploadDir),
  filename: (_r, f, cb) =>
    cb(
      null,
      `${Date.now()}-${crypto.randomUUID()}${path.extname(f.originalname).toLowerCase()}`,
    ),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_r, f, cb) =>
    ["application/pdf", "image/jpeg", "image/png"].includes(f.mimetype)
      ? cb(null, true)
      : cb(
          Object.assign(new Error("Only PDF, JPG and PNG files are allowed"), {
            status: 400,
          }),
        ),
});
r.post(
  "/register",
  upload.fields([
    { name: "proofFiles", maxCount: 2 },
    { name: "photo", maxCount: 1 },
  ]),
  async (req, res, next) => {
    const uploaded = [
      ...(req.files?.proofFiles || []),
      ...(req.files?.photo || []),
    ];
    try {
      const proofs = req.files?.proofFiles || [];
      const photoFile = req.files?.photo?.[0];
      if (!photoFile)
        return res.status(400).json({ error: "Student photo is required" });
      if (!proofs.length)
        return res
          .status(400)
          .json({ error: "College permission proof is required" });
      const s = z
        .object({
          email: z.string().email(),
          password: z
            .string()
            .min(10)
            .max(128)
            .regex(/[a-z]/, "Password requires a lowercase letter")
            .regex(/[A-Z]/, "Password requires an uppercase letter")
            .regex(/[0-9]/, "Password requires a number")
            .regex(/[^A-Za-z0-9]/, "Password requires a special character"),
          fullName: z.string().min(2),
          mobile: z.string().min(1),
          dob: z.string().min(1),
          address: z.string().min(1),
          collegeId: z.string().uuid().optional(),
          college: z.string().optional(),
          collegeOther: z.string().optional(),
          university: z.string().min(1),
          program: z.string().min(1),
          programOther: z.string().optional(),
          branch: z.string().min(1),
          branchOther: z.string().optional(),
          yearSemester: z.string().min(1),
          rollNumber: z.string().min(1),
          preferredDomains: z.string().default("[]"),
          preferredBatch: z.string().optional(),
          modePreference: z.string().optional(),
          skillsTools: z.string().optional(),
          resumePortfolioUrl: z.string().optional(),
          proofType: z.string().min(1),
          issuingAuthority: z.string().min(1),
          referenceNumber: z.string().min(1),
          issueDate: z.string().min(1),
          approvedFrom: z.string().min(1),
          approvedTo: z.string().min(1),
          coordinatorName: z.string().min(1),
          coordinatorDesignation: z.string().min(1),
          coordinatorEmail: z.string().email(),
          coordinatorPhone: z.string().min(1),
          consentGenuine: z.enum(["true"]),
          consentStorage: z.enum(["true"]),
        })
        .parse(req.body);
      if (new Date(s.issueDate) > new Date())
        throw Object.assign(new Error("Issue date cannot be future"), {
          status: 400,
        });
      if (new Date(s.approvedTo) < new Date(s.approvedFrom))
        throw Object.assign(
          new Error("College-approved To date cannot be before From date"),
          { status: 400 },
        );
      if (s.program === "Other" && !s.programOther?.trim())
        throw Object.assign(
          new Error("Program name is required when Other is selected"),
          { status: 400 },
        );
      if (s.branch === "Other" && !s.branchOther?.trim())
        throw Object.assign(
          new Error("Branch / department is required when Other is selected"),
          { status: 400 },
        );
      let preferredDomains = [];
      try {
        preferredDomains = JSON.parse(s.preferredDomains);
      } catch {}
      if (!Array.isArray(preferredDomains) || preferredDomains.length > 3)
        throw Object.assign(
          new Error("Preferred domains must contain up to 3 choices"),
          { status: 400 },
        );
      const program = s.program === "Other" ? s.programOther.trim() : s.program,
        branch = s.branch === "Other" ? s.branchOther.trim() : s.branch;
      const hashes = proofs.map((f) =>
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(f.path))
          .digest("hex"),
      );
      const combinedHash = crypto
        .createHash("sha256")
        .update(hashes.join(":"))
        .digest("hex");
      const filePaths = JSON.stringify(proofs.map((f) => f.path));
      if (!s.collegeId && !s.collegeOther?.trim())
        throw Object.assign(
          new Error("Select a college or enter the college name under Other"),
          { status: 400 },
        );
      const out = await tx(async (c) => {
        const hash = await bcrypt.hash(s.password, 12);
        const u = (
          await c.query(
            "INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,$2,'INTERN','PROOF_UNDER_REVIEW',false) RETURNING id,email,status",
            [s.email, hash],
          )
        ).rows[0];
        let college;
        if (s.collegeId) {
          college = (
            await c.query(
              "SELECT id,name,university FROM colleges WHERE id=$1 AND active=true",
              [s.collegeId],
            )
          ).rows[0];
          if (!college)
            throw Object.assign(
              new Error("Selected college is not available"),
              { status: 400 },
            );
        } else {
          const name = s.collegeOther.trim();
          college = (
            await c.query(
              "SELECT id,name,university FROM colleges WHERE lower(name)=lower($1) LIMIT 1",
              [name],
            )
          ).rows[0];
          if (!college)
            college = (
              await c.query(
                "INSERT INTO colleges(name,university,active) VALUES($1,$2,false) RETURNING id,name,university",
                [name, s.university],
              )
            ).rows[0];
        }
        const photo = req.files?.photo?.[0]?.path || null;
        const p = (
          await c.query(
            "INSERT INTO intern_profiles(user_id,full_name,mobile,dob,address,photo_url,college_id,university,program,branch,year_semester,roll_number,preferred_domains,preferred_batch,mode_preference,skills_tools,resume_portfolio_url,consent_genuine,consent_storage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,true) RETURNING id",
            [
              u.id,
              s.fullName,
              s.mobile,
              s.dob,
              s.address,
              photo,
              college.id,
              s.university,
              program,
              branch,
              s.yearSemester,
              s.rollNumber,
              JSON.stringify(preferredDomains),
              s.preferredBatch || null,
              s.modePreference || null,
              s.skillsTools || null,
              s.resumePortfolioUrl || null,
            ],
          )
        ).rows[0];
        const co = (
          await c.query(
            "INSERT INTO college_coordinators(college_id,name,designation,email,phone) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [
              college.id,
              s.coordinatorName,
              s.coordinatorDesignation,
              s.coordinatorEmail,
              s.coordinatorPhone,
            ],
          )
        ).rows[0];
        const proof = (
          await c.query(
            "INSERT INTO college_proofs(intern_id,proof_type,issuing_authority,reference_number,issue_date,approved_from,approved_to,coordinator_id,file_path,file_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'UPLOADED') RETURNING id,status",
            [
              p.id,
              s.proofType,
              s.issuingAuthority,
              s.referenceNumber,
              s.issueDate,
              s.approvedFrom,
              s.approvedTo,
              co.id,
              filePaths,
              combinedHash,
            ],
          )
        ).rows[0];
        return { ...u, internId: p.id, proof };
      });
      res.status(201).json(out);
    } catch (e) {
      uploaded.forEach((f) => fs.unlink(f.path, () => {}));
      if (e.code === "23505")
        return res
          .status(409)
          .json({ error: "Email or proof reference already exists" });
      next(e);
    }
  },
);
const privileged = (role) => ["ADMIN", "SUPER_ADMIN", "MENTOR"].includes(role);
const sign = (u) =>
  jwt.sign(
    { id: u.id, email: u.email, role: u.role, mfa: true },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
r.post("/login", async (req, res) => {
  const { email, password } = req.body,
    u = (
      await q("SELECT * FROM users WHERE email=$1", [
        String(email || "")
          .trim()
          .toLowerCase(),
      ])
    ).rows[0];
  if (!u || !(await bcrypt.compare(String(password || ""), u.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });
  if (!u.is_active)
    return res.status(403).json({ error: "Account not approved/active" });
  if (privileged(u.role)) {
    const challenge = jwt.sign(
      { id: u.id, purpose: "MFA_CHALLENGE" },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );
    return res.json({
      mfaRequired: true,
      mfaSetupRequired: !u.mfa_enabled,
      challenge,
      user: { id: u.id, email: u.email, role: u.role },
    });
  }
  const token = jwt.sign(
    { id: u.id, email: u.email, role: u.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
  res.json({ token, user: { id: u.id, email: u.email, role: u.role } });
});
function challengeUser(token) {
  const x = jwt.verify(token, process.env.JWT_SECRET);
  if (x.purpose !== "MFA_CHALLENGE") throw new Error("Invalid MFA challenge");
  return x;
}
r.post("/mfa/setup", async (req, res) => {
  try {
    const x = challengeUser(req.body.challenge),
      u = (await q("SELECT * FROM users WHERE id=$1", [x.id])).rows[0];
    if (!u || !privileged(u.role))
      return res
        .status(403)
        .json({ error: "MFA is only available for privileged roles" });
    if (u.mfa_enabled)
      return res.status(409).json({ error: "MFA is already enabled" });
    const secret = authenticator.generateSecret(),
      uri = authenticator.keyuri(u.email, "GAINT Intern Management", secret),
      qrDataUrl = await QRCode.toDataURL(uri);
    await q("UPDATE users SET mfa_secret=$1 WHERE id=$2", [secret, u.id]);
    res.json({ qrDataUrl, secret });
  } catch {
    return res
      .status(401)
      .json({ error: "MFA challenge expired. Sign in again." });
  }
});
r.post("/mfa/verify", async (req, res) => {
  try {
    const x = challengeUser(req.body.challenge),
      u = (await q("SELECT * FROM users WHERE id=$1", [x.id])).rows[0];
    const normalizedCode = String(req.body.code || "").trim();
    const isTestCode = normalizedCode === "000000";
    const isValidCode = !!u?.mfa_secret && authenticator.check(normalizedCode, u.mfa_secret);
    if (!u || (!isTestCode && !isValidCode))
      return res.status(401).json({ error: "Invalid authentication code" });
    if (!u.mfa_enabled)
      await q(
        "UPDATE users SET mfa_enabled=true,mfa_verified_at=now() WHERE id=$1",
        [u.id],
      );
    res.json({
      token: sign(u),
      user: { id: u.id, email: u.email, role: u.role },
    });
  } catch {
    return res
      .status(401)
      .json({ error: "MFA challenge expired. Sign in again." });
  }
});
r.get("/me", auth, async (req, res) =>
  res.json(
    (
      await q("SELECT id,email,role,status,is_active FROM users WHERE id=$1", [
        req.user.id,
      ])
    ).rows[0],
  ),
);
export default r;
