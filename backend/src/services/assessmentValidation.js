export function questionSelectionError(sections, eligibleIds = null) {
  if (!Array.isArray(sections) || !sections.length)
    return "Add at least one assessment section before publishing";
  if (sections.some((section) => !Array.isArray(section.question_ids) || !section.question_ids.length))
    return "Every section must contain at least one question before publishing";
  if (sections.some((section) => new Set(section.question_ids).size !== section.question_ids.length))
    return "Duplicate questions within a section are not allowed";
  const ids = sections.flatMap((section) => section.question_ids);
  if (new Set(ids).size !== ids.length)
    return "A question cannot appear in multiple sections of the same assessment";
  if (eligibleIds && ids.some((id) => !eligibleIds.has(id)))
    return "Every Initial Assessment question must be an approved, active single-answer MCQ with four options";
  return null;
}

export function summarizeAssessmentAttempt(sectionResults, status) {
  const rows = Array.isArray(sectionResults) ? sectionResults : [];
  const earned = rows.reduce((sum, section) => sum + Number(section.earned || 0), 0);
  const possible = rows.reduce((sum, section) => sum + Number(section.possible || 0), 0);
  return {
    earned,
    possible,
    percentage: possible ? Number(((earned / possible) * 100).toFixed(2)) : 0,
    passed: status === "EVALUATED" ? Boolean(rows.length) && rows.every((section) => section.passed) : null,
  };
}
