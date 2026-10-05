import * as repository from "./college.repository.js";

export const getColleges = () => repository.listColleges();

export async function createCollege(input) {
  if (!input.name)
    throw Object.assign(new Error("College name is required"), { status: 400 });
  return repository.createCollege(input.name, input.university);
}

export async function updateCollege(id, input) {
  const before = await repository.findCollege(id);
  if (!before)
    throw Object.assign(new Error("College not found"), { status: 404 });
  const name = String(input.name ?? before.name).trim();
  const university = String(input.university ?? before.university ?? "").trim();
  const active = input.active === undefined ? before.active : !!input.active;
  const college = await repository.updateCollege(id, name, university, active);
  return { before, college };
}
