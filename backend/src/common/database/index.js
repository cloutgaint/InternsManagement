import pg from "pg";
import "../config/env.js";

const { Pool, types } = pg;

// DATE columns stay "YYYY-MM-DD" strings; a JS Date would shift the day across time zones.
types.setTypeParser(types.builtins.DATE, (value) => value);

// current_date must mean the internship's local day, not the database server's.
const appTimezone = process.env.APP_TIMEZONE || "Asia/Kolkata";
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c TimeZone=" + appTimezone,
});

export const q = (text, params = []) => pool.query(text, params);

export async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
