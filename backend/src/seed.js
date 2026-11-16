import bcrypt from "bcryptjs";
import { q, pool } from "./common/database/index.js";
const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || "admin@gaintclout.com")
  .trim()
  .toLowerCase();
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe123!";
const pw = await bcrypt.hash(adminPassword, 12);
await q(
  `INSERT INTO users(email,password_hash,role,status,is_active,must_change_password) SELECT $1,$2,'SUPER_ADMIN','ACTIVE',true,true WHERE NOT EXISTS(SELECT 1 FROM users WHERE lower(btrim(email))=$1 AND status<>'DELETED')`,
  [adminEmail, pw],
);
for (const [name, code, cat] of [
  ["Full Stack", "FULLSTACK", "Technology"],
  ["UI/UX", "UIUX", "Design & Media"],
  ["Digital Marketing", "DM", "Business & Management"],
  ["Human Resources", "HR", "Business & Management"],
  ["Data Analytics", "DA", "Technology"],
  ["Research", "RESEARCH", "Research"],
])
  await q(
    "INSERT INTO domains(name,code,category) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING",
    [name, code, cat],
  );
console.log(
  `Seed complete; initial admin: ${adminEmail} (change the password immediately)`,
);
await pool.end();
