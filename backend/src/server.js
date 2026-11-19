import "./common/config/env.js";
import { createApp } from "./app.js";
import { startTaskReleaseScheduler } from "./services/taskReleaseScheduler.js";
import { startLocalBiometricVerifier, stopLocalBiometricVerifier } from "./services/localBiometricVerifier.js";
import { testMfaCodeAllowed } from "./modules/auth/auth.service.js";

const app = createApp();
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`GAINT Intern API on ${port}`);
  if (testMfaCodeAllowed())
    console.warn("[security] WARNING: the test MFA code 000000 is accepted for staff sign-in. Unset ALLOW_TEST_MFA_CODE before real users are onboarded.");
  startTaskReleaseScheduler();
  startLocalBiometricVerifier();
});

process.once("SIGINT",()=>{stopLocalBiometricVerifier();process.exit(0);});
process.once("SIGTERM",()=>{stopLocalBiometricVerifier();process.exit(0);});
