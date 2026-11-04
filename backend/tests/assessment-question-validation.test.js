import test from "node:test";
import assert from "node:assert/strict";
import { questionSelectionError, summarizeAssessmentAttempt } from "../src/services/assessmentValidation.js";
import {
  QUESTION_TYPES,
  isObjectiveQuestion,
  questionValidationError,
} from "../src/services/questionTypes.js";
import { generateQuestions } from "../src/services/aiQuestionService.js";

test("assessment sections require an eligible question", () => {
  assert.match(questionSelectionError([]), /at least one assessment section/);
  assert.match(questionSelectionError([{ question_ids: [] }]), /must contain/);
  assert.match(
    questionSelectionError([{ question_ids: ["q1"] }], new Set()),
    /approved, active/,
  );
  assert.equal(
    questionSelectionError([{ question_ids: ["q1"] }], new Set(["q1"])),
    null,
  );
});

test("assessment question selection prevents duplicates", () => {
  assert.match(
    questionSelectionError([{ question_ids: ["q1", "q1"] }]),
    /within a section/,
  );
  assert.match(
    questionSelectionError([{ question_ids: ["q1"] }, { question_ids: ["q1"] }]),
    /multiple sections/,
  );
});

test("manual and AI workflows share all supported question types", () => {
  for (const type of ["CASE_STUDY", "CODING_PRACTICAL", "WRITING_SAMPLE", "PORTFOLIO_LINK"])
    assert.ok(QUESTION_TYPES.includes(type));
  assert.equal(isObjectiveQuestion("MCQ"), true);
  assert.equal(isObjectiveQuestion("CASE_STUDY"), false);
});

test("all non-objective assessment types require manual evaluation", () => {
  for (const type of QUESTION_TYPES.filter((value) => !["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(value)))
    assert.equal(isObjectiveQuestion(type), false);
});

test("manual creation and AI approval use the same question validation", () => {
  assert.equal(
    questionValidationError({
      type: "MCQ",
      difficulty: "MEDIUM",
      question: "Which option is correct?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      marks: 1,
    }),
    null,
  );
  assert.match(
    questionValidationError({
      type: "MCQ",
      difficulty: "MEDIUM",
      question: "Incomplete objective question",
      options: ["A", "B", "C", "D"],
      marks: 1,
    }),
    /Correct answer/,
  );
  assert.equal(
    questionValidationError({
      type: "CODING_PRACTICAL",
      difficulty: "HARD",
      question: "Implement the requested feature.",
      options: null,
      correct_answer: null,
      marks: 10,
    }),
    null,
  );
});

test("Initial Assessment MCQs require four unique options and one matching answer", () => {
  assert.match(questionValidationError({ type: "MCQ", difficulty: "EASY", question: "Two options", options: ["A", "B"], correctAnswer: "A", marks: 1 }), /exactly four/);
  assert.match(questionValidationError({ type: "MCQ", difficulty: "EASY", question: "Duplicates", options: ["A", "A", "C", "D"], correctAnswer: "A", marks: 1 }), /unique/);
  assert.match(questionValidationError({ type: "MCQ", difficulty: "EASY", question: "Wrong answer", options: ["A", "B", "C", "D"], correctAnswer: "E", marks: 1 }), /must match/);
});

test("section results determine overall score and passing status", () => {
  assert.deepEqual(
    summarizeAssessmentAttempt([
      { earned: 8, possible: 10, passed: true },
      { earned: 3, possible: 10, passed: false },
    ], "EVALUATED"),
    { earned: 11, possible: 20, percentage: 55, passed: false },
  );
  assert.equal(summarizeAssessmentAttempt([{ earned: 8, possible: 10, passed: true }], "IN_PROGRESS").passed, null);
});

test("AI generation forwards Admin instructions and parses provider drafts", async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousFetch = global.fetch;
  let request;
  process.env.AI_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: [{ type: "CASE_STUDY", question: "Analyse this case", options: null, correctAnswer: null, markingGuide: "Assess reasoning", marks: 5, explanation: "Reference" }] }) } }] }),
    };
  };
  try {
    const rows = await generateQuestions({ domain: "Engineering", topic: "APIs", difficulty: "HARD", expectedLevel: "ADVANCED", instructions: "Use a production incident", count: 1, types: ["CASE_STUDY"], marks: 5 });
    assert.equal(rows[0].type, "CASE_STUDY");
    assert.match(request.messages[1].content, /Use a production incident/);
    assert.match(request.messages[1].content, /ADVANCED/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousKey;
  }
});
