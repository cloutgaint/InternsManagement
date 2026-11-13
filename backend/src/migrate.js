import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./common/database/index.js";
import { compareMigrations } from "./services/migrationOrder.js";
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
try {
  for (const file of fs
    .readdirSync(dir)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort(compareMigrations)) {
    await pool.query(fs.readFileSync(path.join(dir, file), "utf8"));
    console.log("Applied migration:", file);
  }
} finally {
  await pool.end();
}
