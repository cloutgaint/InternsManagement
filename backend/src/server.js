import "./common/config/env.js";
import { createApp } from "./app.js";
import { startTaskReleaseScheduler } from "./services/taskReleaseScheduler.js";
import { startLocalBiometricVerifier, stopLocalBiometricVerifier } from "./services/localBiometricVerifier.js";

const app = createApp();
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`GAINT Intern API on ${port}`);
  startTaskReleaseScheduler();
  startLocalBiometricVerifier();
});

process.once("SIGINT",()=>{stopLocalBiometricVerifier();process.exit(0);});
process.once("SIGTERM",()=>{stopLocalBiometricVerifier();process.exit(0);});
