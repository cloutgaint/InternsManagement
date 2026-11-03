import { q } from "../../common/database/index.js";
const fields = ["name","code","university","college_type","state","district","city","address","pin_code","email","phone","website","coordinator_name","coordinator_email","coordinator_mobile"];
export async function listColleges() {
  return (await q("SELECT * FROM colleges ORDER BY created_at DESC")).rows;
}
export async function findCollege(id) {
  return (await q("SELECT * FROM colleges WHERE id=$1", [id])).rows[0];
}
export async function createCollege(input) {
  const cols = [...fields, "active"];
  const values = cols.map((key) => input[key] === "" ? null : input[key] ?? null);
  return (await q(
    `INSERT INTO colleges(${cols.join(",")}) VALUES(${cols.map((_,i)=>"$"+(i+1)).join(",")}) RETURNING *`,
    values,
  )).rows[0];
}
export async function updateCollege(id, input) {
  const cols = [...fields, "active"];
  const values = cols.map((key) => input[key] === "" ? null : input[key] ?? null);
  return (await q(
    `UPDATE colleges SET ${cols.map((key,i)=>key+"=$"+(i+1)).join(",")} WHERE id=$${cols.length+1} RETURNING *`,
    [...values,id],
  )).rows[0];
}

export async function deleteCollege(id) {
  return (await q("DELETE FROM colleges WHERE id=$1 RETURNING *",[id])).rows[0];
}
