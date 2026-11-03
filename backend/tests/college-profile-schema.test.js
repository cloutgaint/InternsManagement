import test from "node:test";
import assert from "node:assert/strict";
import { createCollegeSchema, updateCollegeSchema } from "../src/modules/colleges/college.schema.js";
const college={name:"GAINT College",code:"GAINT001",university:"GAINT University",college_type:"Degree College",state:"Telangana",district:"Siddipet",city:"Siddipet",address:"Main Road",pin_code:"502103",email:"",phone:"",website:"",coordinator_name:"",coordinator_email:"",coordinator_mobile:"",active:true};
test("college master accepts full institution profile",()=>{const parsed=createCollegeSchema.parse(college);assert.equal(parsed.code,"GAINT001");assert.equal(parsed.active,true);});
test("college master rejects invalid PIN and missing required location",()=>{assert.equal(createCollegeSchema.safeParse({...college,pin_code:"123"}).success,false);assert.equal(createCollegeSchema.safeParse({...college,city:""}).success,false);});
test("college updates preserve partial edit support for existing records",()=>{assert.deepEqual(updateCollegeSchema.parse({active:false}),{active:false});});
