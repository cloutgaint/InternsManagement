export const PROGRAMS = ["B.Tech", "B.E.", "BBA", "B.Com", "B.Des", "B.Sc", "M.Sc", "BCA", "MCA", "M.Tech", "MBA", "Diploma", "Other"];
export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "AI & ML", "Data Science", "Cyber Security", "Other"];
export const PROOFS = ["College Allotment Order", "No Objection Certificate (NOC)", "Internship Permission / Recommendation Letter", "Bonafide Certificate with internship permission", "Other"];

export const initialRegistrationForm = {
  email: "", password: "", fullName: "", mobile: "", dob: "", address: "",
  collegeId: "", collegeOther: "", university: "", program: "", programOther: "",
  branch: "", branchOther: "", yearSemester: "", rollNumber: "", preferredDomains: "",
  preferredBatch: "", skillsTools: "", resumePortfolioUrl: "", proofType: "",
  issuingAuthority: "", referenceNumber: "", issueDate: "", approvedFrom: "",
  approvedTo: "", coordinatorName: "", coordinatorDesignation: "", coordinatorEmail: "",
  coordinatorPhone: "", consentGenuine: false, consentStorage: false,
};

const invalid = (message, field) => Object.assign(new Error(message), { field });

export function validateRegistration({ form, files, photo, covered, collegeChoice }) {
  const email = form.email.trim().toLowerCase();
  const mobile = form.mobile.replace(/\D/g, "");
  const coordinatorPhone = form.coordinatorPhone.replace(/\D/g, "");
  if (form.fullName.trim().length < 3) throw invalid("Enter the student full name as shown in college records.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("Enter a valid student email address.");
  if (!/^[6-9]\d{9}$/.test(mobile)) throw invalid("Enter a valid 10-digit Indian mobile number.");
  if (form.resumePortfolioUrl.trim()) {
    try {
      const url = new URL(form.resumePortfolioUrl.trim());
      if (url.protocol !== "https:" || !url.hostname) throw new Error();
    } catch {
      throw invalid("Enter a valid HTTPS link to your resume or portfolio.", "resumePortfolioUrl");
    }
  }
  if (!form.dob) throw invalid("Date of birth is required.");
  const dob = new Date(form.dob), today = new Date();
  if (dob >= today) throw invalid("Date of birth must be in the past.");
  if (form.password.length < 10 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password))
    throw invalid("Password must be 10+ characters and include uppercase, lowercase, number and special character.");
  if (!collegeChoice || (!form.collegeId && !form.collegeOther.trim())) throw invalid("Select your college or choose Other and enter the college name.");
  if (!form.university.trim() || !form.rollNumber.trim()) throw invalid("University and roll number are required.");
  if (form.program === "Other" && !form.programOther.trim()) throw invalid("Enter your program name.");
  if (form.branch === "Other" && !form.branchOther.trim()) throw invalid("Enter your branch / department.");
  if (form.approvedFrom && form.approvedTo && new Date(form.approvedTo) < new Date(form.approvedFrom)) throw invalid("Internship end date cannot be before the start date.");
  if (form.issueDate && new Date(form.issueDate) > today) throw invalid("Proof issue date cannot be in the future.");
  if (!covered && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.coordinatorEmail.trim())) throw invalid("Enter a valid faculty coordinator email.");
  if (!covered && !/^\d{10}$/.test(coordinatorPhone)) throw invalid("Enter a valid 10-digit faculty coordinator phone number.");
  if (photo && !["image/jpeg", "image/png"].includes(photo.type)) throw invalid("Student photo must be JPG or PNG.");
  if (photo && photo.size > 5 * 1024 * 1024) throw invalid("Student photo must be 5 MB or smaller.");
  if (!covered && !files.length) throw invalid("Please upload the college permission proof.");
  if (files.length > 2) throw invalid("Maximum 2 proof files are allowed.");
  if (files.some((file) => file.size > 5 * 1024 * 1024)) throw invalid("Each proof file must be 5 MB or smaller.");
  const preferredDomains = form.preferredDomains.split(",").map((value) => value.trim()).filter(Boolean);
  if (preferredDomains.length > 3) throw invalid("Choose up to 3 preferred domains only.");
  return { preferredDomains };
}
