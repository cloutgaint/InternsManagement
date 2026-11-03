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

export async function remove(req,res,next) {
  try {
    const before=await service.deleteCollege(req.params.id);
    await audit(req,"COLLEGE_ARCHIVED","college",before.id,before,{...before,active:false,archived_at:new Date().toISOString()});
    res.json({message:"College removed from the master list and student registration. Existing student and internship history is preserved."});
  } catch(error) {
    if(error.code==="23503")return res.status(409).json({error:"This college is linked to existing student or internship records. Deactivate it instead to preserve those records."});
    next(error);
  }
}
