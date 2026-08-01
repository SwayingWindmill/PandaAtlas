import { runReleaseGate } from "../gate-core.mjs";
import { sealMapCloseEvidence } from "../map-close-evidence.mjs";

export async function runEvidenceSealedCertification({
  gate,
  reportDir,
  steps,
  runGate = runReleaseGate,
  sealEvidence = sealMapCloseEvidence,
} = {}) {
  if (!gate) throw new TypeError("runEvidenceSealedCertification requires gate");
  if (!reportDir) throw new TypeError("runEvidenceSealedCertification requires reportDir");
  if (!Array.isArray(steps)) {
    throw new TypeError("runEvidenceSealedCertification requires steps");
  }

  const report = await runGate({ gate, reportDir, steps });
  await sealEvidence({ reportDir });
  return report;
}
