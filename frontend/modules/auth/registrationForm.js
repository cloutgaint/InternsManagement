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
  const required=(value,message,field)=>{if(!String(value??"").trim())throw invalid(message,field);};
  const emailPattern=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const mobile=String(form.mobile||"").replace(/\\D/g,"");
  const coordinatorPhone=String(form.coordinatorPhone||"").replace(/\\D/g,"");
  required(form.fullName,"Enter your full name as shown in college records.","fullName");
  if(form.fullName.trim().length<3)throw invalid("Full name must have at least 3 characters.","fullName");
  if(!emailPattern.test(form.email.trim()))throw invalid("Enter a valid student email address.","email");
  if(!/^[6-9]\\d{9}$/.test(mobile))throw invalid("Enter a valid 10-digit Indian mobile number.","mobile");
  required(form.dob,"Date of birth is required.","dob");
  const today=new Date();today.setHours(0,0,0,0);
  const dob=new Date(form.dob);
  if(Number.isNaN(dob.getTime())||dob>=today)throw invalid("Enter a valid date of birth in the past.","dob");
  required(form.address,"Enter your residential address.","address");
  if(!collegeChoice||(!form.collegeId&&!form.collegeOther.trim()))throw invalid("Select your college or choose Other and enter the college name.","collegeChoice");
  required(form.university,"Enter your university.","university");
  required(form.program,"Select your program.","program");
  if(form.program==="Other")required(form.programOther,"Enter your program name.","programOther");
  required(form.branch,"Select your branch or department.","branch");
  if(form.branch==="Other")required(form.branchOther,"Enter your branch or department.","branchOther");
  required(form.yearSemester,"Enter your year or semester.","yearSemester");
  required(form.rollNumber,"Enter your roll or registration number.","rollNumber");
  if(form.resumePortfolioUrl.trim()){
    try{const url=new URL(form.resumePortfolioUrl.trim());if(url.protocol!=="https:"||!url.hostname)throw new Error();}
    catch{throw invalid("Enter a valid HTTPS link to your resume or portfolio.","resumePortfolioUrl");}
  }
  const preferredDomains=form.preferredDomains.split(",").map(v=>v.trim()).filter(Boolean);
  if(preferredDomains.length>3)throw invalid("Choose up to 3 preferred domains only.","preferredDomains");
  if(photo&&!["image/jpeg","image/png"].includes(photo.type))throw invalid("Student photo must be JPG or PNG.","photo");
  if(photo&&photo.size>5*1024*1024)throw invalid("Student photo must be 5 MB or smaller.","photo");
  if(!covered){
    required(form.proofType,"Select the college permission proof type.","proofType");
    required(form.issuingAuthority,"Enter the issuing authority.","issuingAuthority");
    required(form.referenceNumber,"Enter the letter or reference number.","referenceNumber");
    required(form.issueDate,"Enter the permission letter issue date.","issueDate");
    const issueDate=new Date(form.issueDate);
    if(Number.isNaN(issueDate.getTime())||issueDate>today)throw invalid("Proof issue date must be valid and cannot be in the future.","issueDate");
    required(form.approvedFrom,"Enter the college-approved internship start date.","approvedFrom");
    required(form.approvedTo,"Enter the college-approved internship end date.","approvedTo");
    const from=new Date(form.approvedFrom),to=new Date(form.approvedTo);
    if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||to<from)throw invalid("College-approved end date cannot be before the start date.","approvedTo");
    required(form.coordinatorName,"Enter the faculty coordinator name.","coordinatorName");
    required(form.coordinatorDesignation,"Enter the faculty coordinator designation.","coordinatorDesignation");
    if(!emailPattern.test(form.coordinatorEmail.trim()))throw invalid("Enter a valid faculty coordinator email.","coordinatorEmail");
    if(!/^[6-9]\\d{9}$/.test(coordinatorPhone))throw invalid("Enter a valid 10-digit faculty coordinator phone number.","coordinatorPhone");
    if(!files.length)throw invalid("Upload at least one college permission proof.","proofFiles");
    if(files.length>2)throw invalid("Maximum 2 proof files are allowed.","proofFiles");
    const allowedTypes=["application/pdf","image/jpeg","image/png"];
    if(files.some(file=>!allowedTypes.includes(file.type)))throw invalid("Proof must be a PDF, JPG or PNG file.","proofFiles");
    if(files.some(file=>file.size>5*1024*1024))throw invalid("Each proof file must be 5 MB or smaller.","proofFiles");
  }
  if(form.password.length<10||!/[A-Z]/.test(form.password)||!/[a-z]/.test(form.password)||!/[0-9]/.test(form.password)||!/[^A-Za-z0-9]/.test(form.password))
    throw invalid("Password must be 10+ characters with uppercase, lowercase, number and special character.","password");
  if(!form.consentGenuine)throw invalid("Confirm that your college permission document is genuine.","consentGenuine");
  if(!form.consentStorage)throw invalid("Consent to storing and verifying your college permission document.","consentStorage");
  return {preferredDomains};
}
