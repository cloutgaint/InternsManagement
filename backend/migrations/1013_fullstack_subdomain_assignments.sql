-- Make Frontend and Backend first-class Full Stack subdomains and carry the
-- assignment through intern, decision, group and task records.
INSERT INTO subdomains(domain_id,name,code,active)
SELECT d.id,'Frontend','FRONTEND',true FROM domains d
WHERE (upper(d.code)='FULLSTACK' OR lower(d.name) IN ('full stack','fullstack'))
  AND NOT EXISTS(SELECT 1 FROM subdomains s WHERE s.domain_id=d.id AND upper(s.code)='FRONTEND');

INSERT INTO subdomains(domain_id,name,code,active)
SELECT d.id,'Backend','BACKEND',true FROM domains d
WHERE (upper(d.code)='FULLSTACK' OR lower(d.name) IN ('full stack','fullstack'))
  AND NOT EXISTS(SELECT 1 FROM subdomains s WHERE s.domain_id=d.id AND upper(s.code)='BACKEND');

UPDATE subdomains s SET active=true
FROM domains d
WHERE s.domain_id=d.id
  AND (upper(d.code)='FULLSTACK' OR lower(d.name) IN ('full stack','fullstack'))
  AND upper(s.code) IN ('FRONTEND','BACKEND')
  AND NOT s.active;

ALTER TABLE intern_profiles ADD COLUMN IF NOT EXISTS final_subdomain_id uuid REFERENCES subdomains(id) ON DELETE SET NULL;
ALTER TABLE domain_decisions ADD COLUMN IF NOT EXISTS confirmed_subdomain_id uuid REFERENCES subdomains(id) ON DELETE SET NULL;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS subdomain_id uuid REFERENCES subdomains(id) ON DELETE SET NULL;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS subdomain_id uuid REFERENCES subdomains(id) ON DELETE SET NULL;
ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS subdomain_id uuid REFERENCES subdomains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS intern_profiles_final_subdomain_idx ON intern_profiles(final_subdomain_id);
CREATE INDEX IF NOT EXISTS group_members_subdomain_idx ON group_members(subdomain_id) WHERE active;
CREATE INDEX IF NOT EXISTS weekly_tasks_subdomain_idx ON weekly_tasks(subdomain_id) WHERE subdomain_id IS NOT NULL;

-- Preserve the assessment's existing Frontend/Backend recommendation for
-- already-confirmed Full Stack interns when evidence is available.
UPDATE intern_profiles ip
SET final_subdomain_id=(
  SELECT s.id FROM subdomains s
  WHERE s.domain_id=ip.final_domain_id AND upper(s.code)=(
    SELECT upper(aa.result_snapshot->>'domainRecommendation')
    FROM assessment_attempts aa
    WHERE aa.intern_id=ip.id AND aa.status='EVALUATED' AND aa.result_snapshot IS NOT NULL
      AND upper(aa.result_snapshot->>'domainRecommendation') IN ('FRONTEND','BACKEND')
    ORDER BY aa.submitted_at DESC NULLS LAST,aa.started_at DESC LIMIT 1
  ) LIMIT 1
)
FROM domains d
WHERE ip.final_domain_id=d.id
  AND (upper(d.code)='FULLSTACK' OR lower(d.name) IN ('full stack','fullstack'))
  AND ip.final_subdomain_id IS NULL
  AND EXISTS(
    SELECT 1 FROM assessment_attempts aa
    WHERE aa.intern_id=ip.id AND aa.status='EVALUATED'
      AND upper(aa.result_snapshot->>'domainRecommendation') IN ('FRONTEND','BACKEND')
  );

-- Project roles are a safe fallback for older records without an assessment snapshot.
UPDATE intern_profiles ip
SET final_subdomain_id=s.id
FROM domains d, subdomains s, group_members gm
WHERE ip.final_domain_id=d.id AND gm.intern_id=ip.id AND gm.active AND s.domain_id=d.id
  AND (upper(d.code)='FULLSTACK' OR lower(d.name) IN ('full stack','fullstack'))
  AND ip.final_subdomain_id IS NULL
  AND upper(s.code)=CASE
    WHEN gm.project_role ILIKE 'frontend%' THEN 'FRONTEND'
    WHEN gm.project_role ILIKE 'backend%' THEN 'BACKEND'
    ELSE NULL END;

UPDATE group_members gm SET subdomain_id=ip.final_subdomain_id
FROM intern_profiles ip WHERE ip.id=gm.intern_id AND gm.subdomain_id IS NULL;

UPDATE domain_decisions dd SET confirmed_subdomain_id=ip.final_subdomain_id
FROM intern_profiles ip WHERE ip.id=dd.intern_id AND dd.confirmed_domain_id=ip.final_domain_id
  AND dd.confirmed_subdomain_id IS NULL;
