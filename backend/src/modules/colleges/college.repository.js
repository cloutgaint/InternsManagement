import { q } from "../../common/database/index.js";

export async function listColleges() {
  return (await q("SELECT * FROM colleges ORDER BY 1 DESC")).rows;
}
export async function findCollege(id) {
  return (await q("SELECT * FROM colleges WHERE id=$1", [id])).rows[0];
}
export async function createCollege(name, university) {
  return (await q(
    "INSERT INTO colleges(name,university,active) VALUES($1,$2,true) RETURNING *",
    [name, university || null],
  )).rows[0];
}
export async function updateCollege(id, name, university, active) {
  return (await q(
    "UPDATE colleges SET name=$1,university=$2,active=$3 WHERE id=$4 RETURNING *",
    [name, university || null, active, id],
  )).rows[0];
}
