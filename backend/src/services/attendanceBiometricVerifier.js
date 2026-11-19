import { isInternalServiceHost } from "../common/security/internalService.js";
import { detectFileType } from "../common/storage/secureFiles.js";
import { readSecureStoredBuffer } from "../common/storage/storage.service.js";
// Returns the configured anti-spoof threshold in [0, 1], or null when enforcement is off.
export function antispoofThresholdFromEnv() {
  const raw = process.env.BIOMETRIC_ANTISPOOF_THRESHOLD?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new Error("BIOMETRIC_ANTISPOOF_THRESHOLD must be a number between 0 and 1");
  return value;
}

export async function verifyAttendanceBiometrics({
  imageData,
  baselineImageData,
  enrollment,
  challengeType,
}) {
  const endpoint = process.env.BIOMETRIC_VERIFY_URL;
  const token = process.env.BIOMETRIC_VERIFY_TOKEN;
  if (!endpoint || !token)
    return {
      ok: false,
      unavailable: true,
      reason: "Trusted biometric verification is not configured",
    };
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return {
      ok: false,
      unavailable: true,
      reason: "Invalid biometric verifier URL",
    };
  }
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        isInternalServiceHost(url.hostname))
    )
  )
    return {
      ok: false,
      unavailable: true,
      reason: "Biometric verifier must use HTTPS",
    };
  const controller = new AbortController();
  // Three CPU face detections can take several seconds, especially on the first request.
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.BIOMETRIC_VERIFY_TIMEOUT_MS || 30000),
  );
  try {
    if (!enrollment.raw_image_path)
      return {
        ok: false,
        unavailable: true,
        reason: "Approved enrollment image is unavailable",
      };
    const enrollmentBytes = await readSecureStoredBuffer(
      enrollment.raw_image_path,
    );
    const enrollmentMime =
      detectFileType(enrollmentBytes)?.mime || "image/jpeg";
    const enrollmentImageData = `data:${enrollmentMime};base64,${enrollmentBytes.toString("base64")}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        imageData,
        baselineImageData,
        enrollmentImageData,
        challengeType,
      }),
      signal: controller.signal,
    });
    if (response.status === 422) {
      const body = await response.json().catch(() => ({}));
      return {
        ok: false,
        rejected: true,
        reason:
          String(body.error || "Captured images could not be verified") +
          ". Retake in good lighting with only your face visible.",
      };
    }
    if (!response.ok)
      return {
        ok: false,
        unavailable: true,
        reason: "Biometric verifier rejected the request",
      };
    const result = await response.json();
    const matchScore = Number(result.matchScore),
      livenessScore = Number(result.livenessScore);
    if (
      !Number.isFinite(matchScore) ||
      !Number.isFinite(livenessScore) ||
      matchScore < 0 ||
      matchScore > 1 ||
      livenessScore < 0 ||
      livenessScore > 1 ||
      typeof result.challengePass !== "boolean"
    )
      return {
        ok: false,
        unavailable: true,
        reason: "Invalid biometric verifier response",
      };
    // matchScore is Human's normalized similarity, where values above 0.5 are considered a match.
    const matchThreshold = Number(process.env.BIOMETRIC_MATCH_THRESHOLD || 0.6);
    const matched = matchScore >= matchThreshold;
    // livenessScore is the verifier's passive anti-spoof score for the live frame. It is always
    // stored with the attendance event, but only enforced once BIOMETRIC_ANTISPOOF_THRESHOLD is set:
    // the model has not yet been calibrated on real webcam captures, and a guessed threshold would
    // reject genuine interns. Pick a threshold from the recorded liveness_score values first.
    const antispoofThreshold = antispoofThresholdFromEnv();
    const live =
      result.challengePass &&
      (antispoofThreshold === null || livenessScore >= antispoofThreshold);
    const reason =
      !matched && !live
        ? "Live face did not match the approved registration and looked like a photo or screen"
        : !matched
          ? "Live face did not match the approved registration"
          : !live
            ? "The capture looked like a photo or screen rather than a live face. Retake facing the camera directly in good lighting."
            : null;
    if (process.env.NODE_ENV !== "production")
      console.log("[biometric] attendance decision", {
        matched,
        live,
        matchScore: Number(matchScore.toFixed(3)),
        matchThreshold,
        antispoofScore: Number(livenessScore.toFixed(3)),
        antispoofThreshold: antispoofThreshold ?? "not enforced",
      });
    return {
      ok: matched && live,
      matchScore,
      livenessScore,
      challengePass: result.challengePass,
      reason,
    };
  } catch {
    return {
      ok: false,
      unavailable: true,
      reason: "Biometric verifier unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
