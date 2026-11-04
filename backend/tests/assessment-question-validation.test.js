import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { questionSelectionError, summarizeAssessmentAttempt } from "../src/services/assessmentValidation.js";
import {
  QUESTION_TYPES,
  isObjectiveQuestion,
  questionValidationError,
} from "../src/services/questionTypes.js";
import { generateQuestions, resetGroqModelValidationCache } from "../src/services/aiQuestionService.js";

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
  const previousKey = process.env.GROQ_API_KEY;
  const previousModel = process.env.GROQ_MODEL;
  const previousFetch = global.fetch;
  let request;
  process.env.GROQ_API_KEY = "test-key";
  process.env.GROQ_MODEL = "test-model";
  resetGroqModelValidationCache();
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "test-model" }] }) };
    request = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: [{ type: "MCQ", topic: "API incidents", difficulty: "HARD", question: "Which mitigation is safest?", options: ["A", "B", "C", "D"], correctAnswer: "A", markingGuide: null, marks: 5, explanation: "A limits impact." }] }) } }] }),
    };
  };
  try {
    const rows = await generateQuestions({ domain: "Engineering", topic: "APIs", difficulty: "HARD", expectedLevel: "ADVANCED", instructions: "Use a production incident about idempotency", count: 1, types: ["MCQ"], marks: 5 });
    assert.equal(rows[0].type, "MCQ");
    assert.match(request.messages[1].content, /production incident about idempotency/);
    assert.match(request.messages[0].content, /Avoid irrelevant questions/);
    assert.match(request.messages[0].content, /exactly four options/);
    assert.match(request.messages[1].content, /ADVANCED/);
  } finally {
    global.fetch = previousFetch;
    resetGroqModelValidationCache();
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = previousModel;
  }
});

test("AI MCQ persistence is atomic, deduplicated, retrievable, and assessment-eligible", () => {
  const admin = fs.readFileSync(new URL("../src/routes/admin.js", import.meta.url), "utf8");
  const save = admin.split('r.post("/questions/ai-save"')[1]?.split('r.post("/questions/:id/review"')[0];
  assert.ok(save);
  assert.match(save, /await tx\(async \(client\)/);
  assert.match(save, /pg_advisory_xact_lock/);
  assert.match(save, /already exist in the Question Bank/);
  assert.match(save, /'ACTIVE','AI'/);
  assert.match(save, /questionJsonb\(question\.options\)/);
  assert.match(save, /questionJsonb\(question\.correctAnswer\)/);
  assert.match(admin, /aiGenerationInFlight\.has/);
  assert.match(admin, /Number of questions must be between 1 and/);
  assert.match(admin, /r\.use\(auth, permit\("ADMIN", "SUPER_ADMIN"\)\)/);
  assert.match(admin, /questions: "question_bank"/);
  assert.match(admin, /status='ACTIVE' AND type='MCQ'/);
});

test("Groq integration returns safe configuration, quota, malformed response, and timeout errors", async () => {
  const previous = {
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    timeout: process.env.GROQ_TIMEOUT_SECONDS,
    fetch: global.fetch,
  };
  const args = { instructions: "Generate SQL join MCQs", difficulty: "BEGINNER", count: 5, types: ["MCQ"], marks: 1 };
  try {
    delete process.env.GROQ_API_KEY;
    process.env.GROQ_MODEL = "test-model";
    resetGroqModelValidationCache();
    await assert.rejects(generateQuestions(args), /unavailable.*administrator/i);

    process.env.GROQ_API_KEY = "test-key";
    global.fetch = async () => ({ ok: false, status: 429, headers: { get: () => "30" } });
    resetGroqModelValidationCache();
    await assert.rejects(generateQuestions(args), (error) => error.status === 429 && error.retryAfter === "30");

    global.fetch = async (url) => String(url).endsWith("/models")
      ? { ok: true, status: 200, json: async () => ({ data: [{ id: "test-model" }] }) }
      : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "not json" } }] }) };
    resetGroqModelValidationCache();
    await assert.rejects(generateQuestions(args), /invalid questions/i);

    process.env.GROQ_TIMEOUT_SECONDS = "0.01";
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    resetGroqModelValidationCache();
    await assert.rejects(generateQuestions(args), /timed out/i);
  } finally {
    global.fetch = previous.fetch;
    resetGroqModelValidationCache();
    for (const [key, value] of [["GROQ_API_KEY", previous.key], ["GROQ_MODEL", previous.model], ["GROQ_TIMEOUT_SECONDS", previous.timeout]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
