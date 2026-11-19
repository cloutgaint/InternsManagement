import { q, pool } from "./common/database/index.js";
import { hashPassword } from "./common/security/password.js";
const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || "gaintclout@gmail.com")
  .trim()
  .toLowerCase();
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe123!";
const pw = await hashPassword(adminPassword);
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
for (const [name, code] of [
  ["Frontend", "FRONTEND"],
  ["Backend", "BACKEND"],
]) {
  await q(
    `INSERT INTO subdomains(domain_id,name,code,active)
     SELECT d.id,$1,$2,true FROM domains d WHERE d.code='FULLSTACK'
       AND NOT EXISTS(SELECT 1 FROM subdomains s WHERE s.domain_id=d.id AND upper(s.code)=upper($2))`,
    [name, code],
  );
  await q(
    `UPDATE subdomains s SET active=true FROM domains d
       WHERE s.domain_id=d.id AND d.code='FULLSTACK' AND upper(s.code)=upper($1) AND NOT s.active`,
    [code],
  );
}
console.log(
  `Seed complete; initial admin: ${adminEmail} (change the password immediately)`,
);
await pool.end();
