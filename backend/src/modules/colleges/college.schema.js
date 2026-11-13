import { z } from "zod";
const optionalText = z.string().trim().optional();
const requiredText = z.string().trim().min(1);
const profile = {
  name: requiredText,
  code: requiredText,
  university: requiredText,
  college_type: z.enum(["Engineering College","Degree College","Polytechnic","University","Other"]),
  state: requiredText,
  district: optionalText,
  city: requiredText,
  address: requiredText,
  pin_code: z.union([z.literal(""), z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code")]).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  phone: optionalText.refine((v) => !v || /^[+\d\s()-]{7,20}$/.test(v), "Enter a valid contact number"),
  website: z.union([z.literal(""), z.string().url()]).optional(),
  coordinator_name: optionalText,
  coordinator_email: z.union([z.literal(""), z.string().email()]).optional(),
  coordinator_mobile: optionalText.refine((v) => !v || /^\d{10}$/.test(v), "Coordinator mobile must have 10 digits"),
  active: z.boolean().optional(),
};
export const createCollegeSchema = z.object({
  ...profile,
  district: profile.district.default(""),
  pin_code: profile.pin_code.default(""),
  email: profile.email.default(""),
  phone: profile.phone.default(""),
  website: profile.website.default(""),
  coordinator_name: profile.coordinator_name.default(""),
  coordinator_email: profile.coordinator_email.default(""),
  coordinator_mobile: profile.coordinator_mobile.default(""),
  active: profile.active.default(true),
});
export const updateCollegeSchema = z.object(profile).partial();
