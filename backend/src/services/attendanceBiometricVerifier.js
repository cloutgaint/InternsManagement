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
  // Three CPU face detections can take several seconds, especially on the first request.
  const timeout = setTimeout(() => controller.abort(), Number(process.env.BIOMETRIC_VERIFY_TIMEOUT_MS || 30000));
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
    if (response.status === 422) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, rejected: true, reason: String(body.error || "Captured images could not be verified") + ". Retake in good lighting with only your face visible." };
    }
    if (!response.ok) return { ok: false, unavailable: true, reason: "Biometric verifier rejected the request" };
    const result = await response.json();
    const matchScore = Number(result.matchScore), livenessScore = Number(result.livenessScore);
    if (!Number.isFinite(matchScore) || !Number.isFinite(livenessScore) || matchScore < 0 || matchScore > 1 || livenessScore < 0 || livenessScore > 1 || typeof result.challengePass !== "boolean")
      return { ok: false, unavailable: true, reason: "Invalid biometric verifier response" };
    // matchScore is Human's normalized similarity, where values above 0.5 are considered a match.
    const matchThreshold = Number(process.env.BIOMETRIC_MATCH_THRESHOLD || 0.6);
    return { ok: result.challengePass && matchScore >= matchThreshold && livenessScore >= 0.75, matchScore, livenessScore, challengePass: result.challengePass, reason: "Biometric verification did not meet threshold" };
  } catch {
    return { ok: false, unavailable: true, reason: "Biometric verifier unavailable" };
  } finally { clearTimeout(timeout); }
}
