import { q } from "../../common/database/index.js";

const run = (client) => client?.query.bind(client) || q;

export async function findActiveColleges() {
  return (await q(
    "SELECT id,name,university FROM colleges WHERE active=true ORDER BY name",
  )).rows;
}

export async function createInternUser(client, email, passwordHash) {
  return (await run(client)(
    "INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,$2,'INTERN','PROOF_UNDER_REVIEW',false) RETURNING id,email,status",
    [email, passwordHash],
  )).rows[0];
}

export async function findActiveCollegeById(client, collegeId) {
  return (await run(client)(
    "SELECT id,name,university FROM colleges WHERE id=$1 AND active=true",
    [collegeId],
  )).rows[0];
}

export async function findCollegeByName(client, name) {
  return (await run(client)(
    "SELECT id,name,university FROM colleges WHERE lower(name)=lower($1) LIMIT 1",
    [name],
  )).rows[0];
}

export async function createInactiveCollege(client, name, university) {
  return (await run(client)(
    "INSERT INTO colleges(name,university,active) VALUES($1,$2,false) RETURNING id,name,university",
    [name, university],
  )).rows[0];
}

export async function createInternProfile(client, p) {
  return (await run(client)(
    "INSERT INTO intern_profiles(user_id,full_name,mobile,dob,address,photo_url,college_id,university,program,branch,year_semester,roll_number,preferred_domains,preferred_batch,mode_preference,skills_tools,resume_portfolio_url,consent_genuine,consent_storage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,true) RETURNING id",
    [p.userId,p.fullName,p.mobile,p.dob,p.address,p.photo,p.collegeId,p.university,p.program,p.branch,p.yearSemester,p.rollNumber,p.preferredDomains,p.preferredBatch,p.modePreference,p.skillsTools,p.resumePortfolioUrl],
  )).rows[0];
}

export async function createCollegeCoordinator(client, c) {
  return (await run(client)(
    "INSERT INTO college_coordinators(college_id,name,designation,email,phone) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [c.collegeId,c.name,c.designation,c.email,c.phone],
  )).rows[0];
}

export async function createCollegeProof(client, p) {
  return (await run(client)(
    "INSERT INTO college_proofs(intern_id,proof_type,issuing_authority,reference_number,issue_date,approved_from,approved_to,coordinator_id,file_path,file_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'UPLOADED') RETURNING id,status",
    [p.internId,p.proofType,p.issuingAuthority,p.referenceNumber,p.issueDate,p.approvedFrom,p.approvedTo,p.coordinatorId,p.filePaths,p.fileHash],
  )).rows[0];
}

export async function findUserByEmail(email) {
  return (await q("SELECT * FROM users WHERE email=$1", [email])).rows[0];
}

export async function findUserById(userId) {
  return (await q("SELECT * FROM users WHERE id=$1", [userId])).rows[0];
}

export async function saveMfaSecret(userId, secret) {
  await q("UPDATE users SET mfa_secret=$1 WHERE id=$2", [secret, userId]);
}

export async function enableMfa(userId) {
  await q("UPDATE users SET mfa_enabled=true,mfa_verified_at=now() WHERE id=$1", [userId]);
}

export async function findPublicUserById(userId) {
  return (await q(
    "SELECT id,email,role,status,is_active FROM users WHERE id=$1",
    [userId],
  )).rows[0];
}
