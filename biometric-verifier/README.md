# GAINT local face verifier (development prototype)

This Node.js service checks a single live capture against the intern's approved enrollment image:

- **Face match:** compares Human face embeddings (`matchScore`, 0–1). The backend accepts a match at
  `BIOMETRIC_MATCH_THRESHOLD` (default `0.6`).
- **Anti-spoof:** runs Human's passive `antispoof` model on the live frame and returns its score as
  `livenessScore` (0 = likely a photo or screen, 1 = likely a real face).

Anti-spoof is **recorded but not enforced** until `BIOMETRIC_ANTISPOOF_THRESHOLD` is set. The model has
not been calibrated on real webcam captures: in early testing a genuine webcam enrollment scored about
0.51, while screenshots of photos scored between 0.43 and 0.86. So no single threshold yet separates them. Every attempt stores the score in
`attendance_events.liveness_score`; choose a threshold from that data before enforcing it. A single still
image cannot prove liveness, so this is not a certified presentation-attack defence.

Model weights load from the installed `@vladmandic/human` package (`node_modules/@vladmandic/human/models`),
so the verifier needs no internet access.

Requires Node.js 20 and native build support for TensorFlow.js Node.

```bash
cd biometric-verifier
npm install
BIOMETRIC_VERIFY_TOKEN=replace-with-long-random-secret npm start
```

In the root `.env` set the same token and:

```env
BIOMETRIC_VERIFY_URL=http://127.0.0.1:8765/verify
BIOMETRIC_VERIFY_TOKEN=replace-with-long-random-secret
# Optional, 0-1. Empty = record anti-spoof scores without rejecting.
BIOMETRIC_ANTISPOOF_THRESHOLD=
```

Restart the backend, then start the frontend. The verifier listens only on localhost. If face matching
fails, attendance is not recorded.
