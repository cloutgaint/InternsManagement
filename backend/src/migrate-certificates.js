import {readFile} from "node:fs/promises";
import {q,pool} from "./common/database/index.js";
try{
 const sql=await readFile(new URL("../migrations/9999_internship_certificates.sql",import.meta.url),"utf8");
 await q(sql);
 console.log("Certificate schema installed successfully.");
}catch(e){console.error("Certificate schema migration failed:",e.message);process.exitCode=1}
finally{await pool.end()}
