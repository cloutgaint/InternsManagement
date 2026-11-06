// An intern's mentor is their active per-intern assignment. Interns without one fall back to the
// mentors of their active group, so groups mentored the older way keep working.
export const mentorOwnsIntern = (internColumn, mentorParam) =>
  `(EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=${internColumn} AND ima.mentor_id=${mentorParam} AND ima.active) OR (NOT EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=${internColumn} AND ima.active) AND EXISTS(SELECT 1 FROM group_members gm JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.active WHERE gm.intern_id=${internColumn} AND gm.active AND ma.mentor_id=${mentorParam})))`;

// Group-level work (chat, documents, reviews, final submissions) needs one of the mentor's own interns in the group.
export const mentorHasInternInGroup = (groupColumn, mentorParam) =>
  `EXISTS(SELECT 1 FROM group_members mine WHERE mine.group_id=${groupColumn} AND mine.active AND ${mentorOwnsIntern("mine.intern_id", mentorParam)})`;
