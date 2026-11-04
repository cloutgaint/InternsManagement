export const OBJECTIVE_QUESTION_TYPES = ["MCQ", "MULTI_SELECT", "TRUE_FALSE"];

export const QUESTION_TYPES = [
  ...OBJECTIVE_QUESTION_TYPES,
  "SHORT_TEXT",
  "DESCRIPTIVE",
  "CASE_STUDY",
  "CODING_PRACTICAL",
  "WRITING_SAMPLE",
  "PORTFOLIO_LINK",
];

export const isObjectiveQuestion = (type) =>
  OBJECTIVE_QUESTION_TYPES.includes(String(type || "").toUpperCase());

export function questionValidationError(value) {
  const type = String(value.type || "").toUpperCase();
  const difficulty = String(value.difficulty || "").toUpperCase();
  const options = value.options;
  const correctAnswer = value.correctAnswer ?? value.correct_answer;
  if (!String(value.question || "").trim()) return "Question is required";
  if (!QUESTION_TYPES.includes(type)) return "Invalid question type";
  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) return "Invalid difficulty";
  if (!Number.isFinite(Number(value.marks)) || Number(value.marks) <= 0)
    return "Marks must be greater than zero";
  if (type === "MCQ" && (!Array.isArray(options) || options.length !== 4 || options.some((option) => !String(option || "").trim())))
    return "Single-answer MCQs require exactly four options";
  if (type === "MCQ" && new Set(options.map((option) => String(option).trim().toLowerCase())).size !== 4)
    return "MCQ options must be unique";
  if (type === "MULTI_SELECT" && (!Array.isArray(options) || options.filter(Boolean).length < 2))
    return "Multiple-select questions require at least two options";
  if (
    isObjectiveQuestion(type) &&
    (correctAnswer === undefined ||
      correctAnswer === null ||
      correctAnswer === "" ||
      (Array.isArray(correctAnswer) && !correctAnswer.length))
  )
    return "Correct answer is required for objective questions";
  if (type === "MCQ" && !options.some((option) => String(option).trim() === String(correctAnswer).trim()))
    return "The MCQ correct answer must match one option";
  return null;
}
