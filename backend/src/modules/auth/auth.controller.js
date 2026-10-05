import { registrationSchema } from "./auth.schema.js";
import * as service from "./auth.service.js";
import { removeUploadedFiles, uploadedRegistrationFiles } from "./auth.upload.js";

export async function listColleges(_req, res) {
  res.json(await service.getColleges());
}

export async function register(req, res, next) {
  const uploaded = uploadedRegistrationFiles(req.files);
  const proofs = req.files?.proofFiles || [];
  const photoFile = req.files?.photo?.[0];
  if (!photoFile)
    return res.status(400).json({ error: "Student photo is required" });
  if (!proofs.length)
    return res
      .status(400)
      .json({ error: "College permission proof is required" });
  try {
    const input = registrationSchema.parse(req.body);
    res.status(201).json(await service.registerIntern(input, req.files));
  } catch (error) {
    removeUploadedFiles(uploaded);
    if (error.code === "23505")
      return res.status(409).json({ error: "Email or proof reference already exists" });
    next(error);
  }
}

export async function login(req, res) {
  try {
    res.json(await service.login(req.body));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}

export async function setupMfa(req, res) {
  try {
    res.json(await service.setupMfa(req.body.challenge));
  } catch {
    return res.status(401).json({ error: "MFA challenge expired. Sign in again." });
  }
}

export async function verifyMfa(req, res) {
  try {
    res.json(await service.verifyMfa(req.body.challenge, req.body.code));
  } catch (error) {
    if (error.message === "Invalid authentication code")
      return res.status(401).json({ error: "Invalid authentication code" });
    return res.status(401).json({ error: "MFA challenge expired. Sign in again." });
  }
}

export async function me(req, res) {
  res.json(await service.getCurrentUser(req.user.id));
}
