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
  resumePortfolioUrl: z.string().optional(), proofType: z.string().min(1),
  issuingAuthority: z.string().min(1), referenceNumber: z.string().min(1),
  issueDate: z.string().min(1), approvedFrom: z.string().min(1),
  approvedTo: z.string().min(1), coordinatorName: z.string().min(1),
  coordinatorDesignation: z.string().min(1), coordinatorEmail: z.string().email(),
  coordinatorPhone: z.string().min(1), consentGenuine: z.enum(["true"]),
  consentStorage: z.enum(["true"]),
});
