import fs from "fs";
import { pool } from "./common/database/index.js";
const sql = fs.readFileSync(
  new URL("../migrations/001_init.sql", import.meta.url),
  "utf8",
);
await pool.query(sql);
console.log("Migration complete");
await pool.end();
