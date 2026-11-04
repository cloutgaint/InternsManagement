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
    return "Every assessment question must be approved and active before publishing";
  return null;
}
