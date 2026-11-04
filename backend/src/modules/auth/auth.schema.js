import { z } from "zod";

export const registrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128)
    .regex(/[a-z]/, "Password requires a lowercase letter")
    .regex(/[A-Z]/, "Password requires an uppercase letter")
    .regex(/[0-9]/, "Password requires a number")
    .regex(/[^A-Za-z0-9]/, "Password requires a special character"),
  fullName: z.string().min(2), mobile: z.string().min(1),
  dob: z.string().min(1), address: z.string().min(1),
  collegeId: z.string().uuid().optional(), college: z.string().optional(),
  collegeOther: z.string().optional(), university: z.string().min(1),
  program: z.string().min(1), programOther: z.string().optional(),
  branch: z.string().min(1), branchOther: z.string().optional(),
  yearSemester: z.string().min(1), rollNumber: z.string().min(1),
  preferredDomains: z.string().default("[]"), preferredBatch: z.string().optional(),
  modePreference: z.string().optional(), skillsTools: z.string().optional(),
  resumePortfolioUrl: z.string().optional(), proofType: z.string().optional(),
  issuingAuthority: z.string().optional(), referenceNumber: z.string().optional(),
  issueDate: z.string().optional(), approvedFrom: z.string().optional(),
  approvedTo: z.string().optional(), coordinatorName: z.string().optional(),
  coordinatorDesignation: z.string().optional(), coordinatorEmail: z.string().email().optional().or(z.literal("")),
  coordinatorPhone: z.string().optional(), consentGenuine: z.enum(["true"]),
  consentStorage: z.enum(["true"]),
});

export const passwordSchema = registrationSchema.shape.password;
