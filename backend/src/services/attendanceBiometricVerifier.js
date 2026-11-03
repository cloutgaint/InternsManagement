import fs from "node:fs";
import path from "node:path";
export async function verifyAttendanceBiometrics({ imageData, baselineImageData, enrollment, challengeType }) {
  const endpoint = process.env.BIOMETRIC_VERIFY_URL;
  const token = process.env.BIOMETRIC_VERIFY_TOKEN;
  if (!endpoint || !token) return { ok: false, unavailable: true, reason: "Trusted biometric verification is not configured" };
  let url;
  try { url = new URL(endpoint); } catch { return { ok: false, unavailable: true, reason: "Invalid biometric verifier URL" }; }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
    return { ok: false, unavailable: true, reason: "Biometric verifier must use HTTPS" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const enrollmentPath = path.resolve(enrollment.raw_image_path || "");
    if (!enrollment.raw_image_path || !fs.existsSync(enrollmentPath)) return { ok: false, unavailable: true, reason: "Approved enrollment image is unavailable" };
    const enrollmentImageData = "data:image/" + (enrollmentPath.toLowerCase().endsWith(".png") ? "png" : "jpeg") + ";base64," + fs.readFileSync(enrollmentPath).toString("base64");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ imageData, baselineImageData, enrollmentImageData, challengeType }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, unavailable: true, reason: "Biometric verifier rejected the request" };
    const result = await response.json();
    const matchScore = Number(result.matchScore), livenessScore = Number(result.livenessScore);
    if (!Number.isFinite(matchScore) || !Number.isFinite(livenessScore) || matchScore < 0 || matchScore > 1 || livenessScore < 0 || livenessScore > 1 || typeof result.challengePass !== "boolean")
      return { ok: false, unavailable: true, reason: "Invalid biometric verifier response" };
    return { ok: result.challengePass && matchScore >= 0.75 && livenessScore >= 0.75, matchScore, livenessScore, challengePass: result.challengePass, reason: "Biometric verification did not meet threshold" };
  } catch {
    return { ok: false, unavailable: true, reason: "Biometric verifier unavailable" };
  } finally { clearTimeout(timeout); }
}
