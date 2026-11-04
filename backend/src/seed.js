import bcrypt from "bcryptjs";
import { q, pool } from "./common/database/index.js";
const pw = await bcrypt.hash("ChangeMe123!", 12);
await q(
  `INSERT INTO users(email,password_hash,role,status,is_active,must_change_password) SELECT $1,$2,'SUPER_ADMIN','ACTIVE',true,true WHERE NOT EXISTS(SELECT 1 FROM users WHERE lower(btrim(email))=$1 AND status<>'DELETED')`,
  ["admin@gaintclout.com", pw],
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
  "Seed complete; admin@gaintclout.com / ChangeMe123! (change immediately)",
);
await pool.end();
