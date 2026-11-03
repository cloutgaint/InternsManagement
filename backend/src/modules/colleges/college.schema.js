import { z } from "zod";
const optionalText = z.string().trim().optional().default("");
const requiredText = z.string().trim().min(1);
const profile = {
  name: requiredText,
  code: requiredText,
  university: requiredText,
  college_type: z.enum(["Engineering College","Degree College","Polytechnic","University","Other"]),
  state: requiredText,
  district: requiredText,
  city: requiredText,
  address: requiredText,
  pin_code: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  email: z.union([z.literal(""), z.string().email()]).optional().default(""),
  phone: optionalText.refine((v) => !v || /^[+\d\s()-]{7,20}$/.test(v), "Enter a valid contact number"),
  website: z.union([z.literal(""), z.string().url()]).optional().default(""),
  coordinator_name: optionalText,
  coordinator_email: z.union([z.literal(""), z.string().email()]).optional().default(""),
  coordinator_mobile: optionalText.refine((v) => !v || /^\d{10}$/.test(v), "Coordinator mobile must have 10 digits"),
  active: z.boolean().optional().default(true),
};
export const createCollegeSchema = z.object(profile);
export const updateCollegeSchema = z.object(profile).partial();
