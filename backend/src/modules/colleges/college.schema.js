import { z } from "zod";

export const createCollegeSchema = z.object({
  name: z.string().transform((value) => value.trim()),
  university: z.string().optional().default("").transform((value) => value.trim()),
});

export const updateCollegeSchema = z.object({
  name: z.string().optional(),
  university: z.string().optional(),
  active: z.boolean().optional(),
});
