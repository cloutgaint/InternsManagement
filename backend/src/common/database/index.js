import pg from "pg";
import "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
