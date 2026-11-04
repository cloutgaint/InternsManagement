import { registrationSchema } from "./auth.schema.js";
import * as service from "./auth.service.js";
import { removeUploadedFiles, uploadedRegistrationFiles } from "./auth.upload.js";

export async function listColleges(_req, res) {
  res.json(await service.getColleges());
}

export async function register(req, res, next) {
  const uploaded = uploadedRegistrationFiles(req.files);
  try {
    const input = registrationSchema.parse(req.body);
    res.status(201).json(await service.registerIntern(input, req.files));
  } catch (error) {
    removeUploadedFiles(uploaded);
    if (error.code === "23505") return res.status(409).json({ error: "This email is already registered.", field: "email" });
    if (error.status === 409) return res.status(409).json({ error: error.message, field: error.field });
    next(error);
  }
}

const handled = (work) => async (req, res, next) => {
  try {
    await work(req, res);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

export const applicationStatus = handled(async (req, res) => res.json(await service.applicationStatus(req.body)));
export const submitCorrection = handled(async (req, res) => res.json(await service.submitCorrection(req.body)));
export async function reuploadProof(req, res, next) {
  const files = req.files?.proofFiles || [];
  try {
    res.status(201).json(await service.reuploadProof(req.body, files));
  } catch (error) {
    removeUploadedFiles(files);
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
}
// The reply is identical for known and unknown emails so this cannot be used to discover accounts.
export const forgotPassword = handled(async (req, res) => {
  await service.requestPasswordReset(req.body.email);
  res.json({ message: "If that email is registered, a reset link has been sent." });
});
export const resetPassword = handled(async (req, res) => {
  await service.resetPassword(req.body.token, req.body.password);
  res.json({ message: "Password updated. Sign in with your new password." });
});
export const changePassword = handled(async (req, res) => res.json(await service.changePassword(req.user.id, req.body.currentPassword, req.body.password)));

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
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    return res.status(401).json({ error: "MFA challenge expired. Sign in again." });
  }
}

export async function verifyMfa(req, res) {
  try {
    res.json(await service.verifyMfa(req.body.challenge, req.body.code));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    return res.status(401).json({ error: "401 challenge expired. Sign in again." });
  }
}

export async function me(req, res) {
  res.json(await service.getCurrentUser(req.user.id));
}
