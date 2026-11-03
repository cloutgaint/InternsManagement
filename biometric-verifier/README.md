# GAINT local face verifier (development prototype)

This Node.js service compares the live and baseline frames with the approved enrollment using Human face embeddings, and checks for a head-turn pose change. It is **not** a certified anti-spoofing system: replayed videos or manipulated images may bypass this basic challenge. Do not use for high-assurance production attendance without stronger presentation-attack detection.

Requires Node.js 20 and native build support for canvas and TensorFlow.js Node. Model weights are downloaded on first use; internet access is required.

```bash
cd biometric-verifier
npm install
BIOMETRIC_VERIFY_TOKEN=replace-with-long-random-secret npm start
```

In `backend/.env` set the same token and:

```env
BIOMETRIC_VERIFY_URL=http://127.0.0.1:8765/verify
BIOMETRIC_VERIFY_TOKEN=replace-with-long-random-secret
```

Restart the backend, then start the frontend. The verifier listens only on localhost. A single image cannot prove liveness, so this implementation uses baseline and challenged frames; still, it is only a basic prototype. If face matching fails, attendance must not be recorded.
