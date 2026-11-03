import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_WEIGHTS,validateWeights,calculatePerformance} from "../src/services/performanceScoreService.js";
test("performance weights must be complete, numeric and sum to 100",()=>{
 assert.equal(validateWeights(DEFAULT_WEIGHTS),true);
 assert.equal(validateWeights({attendance:25,tasks:35,reviews:25,final:14}),false);
 assert.equal(validateWeights({attendance:25,tasks:35,reviews:25,final:"15"}),false);
});
test("weighted scores use configured weights and exclude missing evidence",()=>{
 assert.equal(calculatePerformance({attendance_pct:80,avg_task_marks:90,avg_individual_marks:70,final_individual_marks:100}),84);
 assert.equal(calculatePerformance({attendance_pct:80,avg_task_marks:null,avg_individual_marks:null,final_individual_marks:null}),80);
 assert.equal(calculatePerformance({attendance_pct:null,avg_task_marks:null,avg_individual_marks:null,final_individual_marks:null}),null);
});
