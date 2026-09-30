# Requirements traceability — Blueprint v1.2

Legend: **Implemented** = working schema/API/UI path included; **Configured/External decision** = blueprint explicitly leaves a launch decision or external technology choice open.

| Area | Status | Implementation |
|---|---|---|
| Registration + consent | Implemented | `/register`, `POST /api/auth/register`, `intern_profiles` |
| College proof + duplicate detection | Implemented core | `college_proofs`, SHA/ref uniqueness, Admin verification API |
| Account approval gate | Implemented | Login requires active; Admin approval requires verified proof unless Super Admin override |
| Colleges / batches / allocation / date mismatch | Implemented core | schema + Admin APIs |
| Offer letter snapshots/version history | Implemented core | `offer_letters`, `offer_letter_versions`, issue API |
| Domain master / subdomains / rubrics / deliverables | Implemented data model + domain API | configurable schema |
| Assessment/question bank | Implemented data model | objective/manual evaluation entities; admin listing |
| AI question generation | External provider decision | Blueprint makes AI optional; no provider/model/API is specified |
| Domain recommendation + Admin confirmation | Implemented persistence/confirmation | `domain_decisions`, Admin endpoint |
| Groups / mentor / project | Implemented data model + group approval | tables and secured endpoints |
| Face enrollment + Admin approval | Implemented workflow | consent, enrollment, Admin decision |
| Actual face matching/liveness engine | External technology decision | Blueprint §23 explicitly requires selected technology/device/retry/fallback decision |
| Camera attendance evidence / exceptions | Implemented API contract | approved enrollment gate, score/liveness result ingestion, daily calculation, exception workflow |
| Leave / holidays / daily reports | Implemented core | tables + intern APIs |
| Weekly tasks/submission/evaluation | Implemented core | tables + intern submit + mentor evaluation |
| Fortnight reviews + individual marks | Implemented core data/API | review endpoint + mark table |
| Documents / chat / notifications | Implemented data model | access model tables; full realtime transport not specified by blueprint |
| Final evaluation / completion / exits | Implemented data model | tables/status model |
| Certificates / college reports | Implemented data model | offline/in-app state supported; PDF template decision remains configurable |
| Audit | Implemented | critical admin actions logged |
| Reporting/export | Data model ready | operational SQL data present; PDF/Excel presentation templates remain configurable |
| Production security | Baseline implemented | JWT, bcrypt, helmet, CORS, rate limit, validation, audit; secrets/TLS/backups/retention must be set per deployment |
