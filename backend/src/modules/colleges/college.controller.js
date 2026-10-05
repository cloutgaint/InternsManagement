import { audit } from "../../common/audit/audit.service.js";
import { createCollegeSchema, updateCollegeSchema } from "./college.schema.js";
import * as service from "./college.service.js";

export async function list(_req, res) {
  res.json(await service.getColleges());
}

export async function create(req, res, next) {
  try {
    const college = await service.createCollege(createCollegeSchema.parse(req.body));
    await audit(req, "COLLEGE_CREATE", "college", college.id, null, college);
    res.status(201).json(college);
  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({ error: "College already exists" });
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { before, college } = await service.updateCollege(
      req.params.id,
      updateCollegeSchema.parse(req.body),
    );
    await audit(req, "COLLEGE_UPDATE", "college", college.id, before, college);
    res.json(college);
  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({ error: "College name already exists" });
    next(error);
  }
}
