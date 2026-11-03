import { q, pool } from "../src/common/database/index.js";
const email=String(process.argv[2]||"").trim().toLowerCase();
if(!email){console.error("Usage: node scripts/check-student-login.js student@example.com");process.exitCode=1;}
else{
  try{
    const result=await q("SELECT id,email,role,status,is_active,created_at,(password_hash LIKE '$2%') AS bcrypt_hash FROM users WHERE lower(btrim(email))=$1 ORDER BY created_at DESC,id DESC",[email]);
    if(!result.rowCount)console.log("No student account found for this email in the connected database.");
    else console.table(result.rows.map(({id,email,role,status,is_active,created_at,bcrypt_hash})=>({id,email,role,status,is_active,created_at,bcrypt_hash})));
    console.log("Database:",(await q("SELECT current_database() AS name")).rows[0].name);
    console.log("Note: This script does not reveal or test passwords. It does not modify records.");
  }catch(error){console.error("Database lookup failed:",error.message);process.exitCode=1;}
}
await pool.end();
