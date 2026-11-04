import { Router } from "express";
import { q } from "../common/database/index.js";

const r = Router();
// Certificate verification by ID (13.1): shows only what the certificate itself states.
r.get("/certificates/:certificateId", async (req, res) => {
  const x = (await q(
    "SELECT c.certificate_id,c.status,c.issue_date,c.domain_snapshot,c.date_snapshot,ip.full_name FROM certificates c JOIN intern_profiles ip ON ip.id=c.intern_id WHERE c.certificate_id=$1 AND c.status='ISSUED'",
    [req.params.certificateId],
  )).rows[0];
  if (!x) return res.status(404).json({ valid: false, error: "No issued certificate has this ID" });
  res.json({ valid: true, certificateId: x.certificate_id, name: x.full_name, domain: x.domain_snapshot, period: x.date_snapshot, issueDate: x.issue_date });
});
export default r;
