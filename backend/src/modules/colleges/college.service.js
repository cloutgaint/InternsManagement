import * as repository from "./college.repository.js";
export const getColleges = () => repository.listColleges();
export async function createCollege(input) {
  return repository.createCollege(input);
}
export async function updateCollege(id, input) {
  const before = await repository.findCollege(id);
  if (!before) throw Object.assign(new Error("College not found"), { status: 404 });
  const college = await repository.updateCollege(id, { ...before, ...input });
  return { before, college };
}

export async function deleteCollege(id) {
  const before=await repository.findCollege(id);
  if(!before)throw Object.assign(new Error("College not found"),{status:404});
  await repository.deleteCollege(id);
  return before;
}
