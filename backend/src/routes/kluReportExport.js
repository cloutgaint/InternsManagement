import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
} from "docx";
import { q } from "../common/database/index.js";
import { mentorHasInternInGroup } from "../services/mentorScope.js";
const date = (s) => (s ? rawDate(s).split("-").reverse().join("-") : "—");
const plain = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
const rawDate = (s) =>
  s instanceof Date
    ? s.toISOString().slice(0, 10)
    : String(s ?? "").slice(0, 10);
const clip = (s, n = 400) => plain(s).slice(0, n);
const pdfFits = (x) =>
  [
    ["achievements", 270],
    ["next_plan", 190],
    ["exceptions", 130],
    ["company_comments", 190],
    ["student_feedback", 200],
  ].every(([k, n]) => plain(x[k]).length <= n);
async function fetchReport(req, id) {
  const x = (
    await q(
      `SELECT f.*,ip.full_name,ip.roll_number,ip.branch,ip.program,c.name college_name,
 (SELECT pr.title FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=ip.id AND gm.active LIMIT 1) project_title,
 (SELECT m.full_name FROM intern_mentor_assignments ima JOIN mentors m ON m.id=ima.mentor_id AND ima.active WHERE ima.intern_id=ip.id LIMIT 1) guide,
 (SELECT ba.batch_id FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1) batch_id,
 (SELECT ba.intern_start FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1) intern_start
 FROM klu_fortnight_reports f JOIN intern_profiles ip ON ip.id=f.intern_id JOIN colleges c ON c.id=ip.college_id WHERE f.id=$1`,
      [id],
    )
  ).rows[0];
  if (!x || !/klu|koneru lakshmaiah/i.test(x.college_name)) return null;
  if (req.user.role === "MENTOR") {
    const m = (
      await q("SELECT id FROM mentors WHERE user_id=$1", [req.user.id])
    ).rows[0]?.id;
    const access =
      m &&
      (
        await q(
          `SELECT 1 FROM group_members gm WHERE gm.intern_id=$1 AND gm.active AND ${mentorHasInternInGroup("gm.group_id", "$2")}`,
          [x.intern_id, m],
        )
      ).rowCount;
    if (!access) return null;
  }
  const rows = (
    await q(
      "SELECT day,status FROM attendance_daily WHERE intern_id=$1 AND day BETWEEN $2 AND $3",
      [x.intern_id, x.intern_start || x.from_date, x.to_date],
    )
  ).rows;
  const holidays = (
    await q(
      "SELECT day FROM holidays WHERE batch_id=$1 AND day BETWEEN $2 AND $3",
      [x.batch_id, x.intern_start || x.from_date, x.to_date],
    )
  ).rows;
  const leaves = (
    await q(
      "SELECT from_date,to_date FROM leave_requests WHERE intern_id=$1 AND status='APPROVED' AND from_date<=$3 AND to_date>=$2",
      [x.intern_id, x.intern_start || x.from_date, x.to_date],
    )
  ).rows;
  const holiday = new Set(holidays.map((z) => rawDate(z.day))),
    byDay = new Map(rows.map((z) => [rawDate(z.day), z.status]));
  const sum = (start, end) => {
    start = rawDate(start);
    end = rawDate(end);
    let work = 0,
      present = 0,
      leave = 0;
    for (
      let d = new Date(start + "T12:00:00Z"),
        last = new Date(end + "T12:00:00Z"),
        today = new Date();
      d <= last && d <= today;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const day = d.toISOString().slice(0, 10),
        w = d.getUTCDay();
      if (w === 0 || w === 6 || holiday.has(day)) continue;
      work++;
      const status = String(byDay.get(day) || "").toUpperCase();
      if (["PRESENT", "LATE", "HALF_DAY"].includes(status))
        present += status === "HALF_DAY" ? 0.5 : 1;
      else if (
        leaves.some(
          (l) => day >= rawDate(l.from_date) && day <= rawDate(l.to_date),
        )
      )
        leave++;
    }
    return { work, present, leave };
  };
  return {
    ...x,
    fort: sum(x.from_date, x.to_date),
    all: sum(x.intern_start || x.from_date, x.to_date),
  };
}
function makePdf(x){
 const doc=new PDFDocument({size:"A4",margin:0,autoFirstPage:true});
 const L=51,W=493,R=L+W;let y=48;
 const font=(bold=false,size=7)=>doc.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size).fillColor("#111");
 const rect=(left,top,width,height,shade=false)=>{if(shade)doc.rect(left,top,width,height).fill("#D9D9D9");doc.lineWidth(.65).strokeColor("#444").rect(left,top,width,height).stroke();};
 const put=(s,left,top,width,height,opts={})=>{font(opts.bold,opts.size||7);doc.text(plain(s),left+4,top+4,{width:width-8,height:height-8,ellipsis:false,align:opts.align||"left",lineGap:1});};
 const line=(parts,height)=>{let left=L;for(const [width,label,shade] of parts){rect(left,y,width,height,shade);put(label,left,y,width,height);left+=width;}y+=height;};
 const section=(s)=>{rect(L,y,W,15,true);put(s,L,y,W,15,{bold:true,align:"center"});y+=15;};
 const area=(title,value,height)=>{rect(L,y,W,height);put(title,L,y,W,17,{bold:true});put(value||"—",L+2,y+18,W-4,height-20);y+=height;};
 font(true,9);doc.text("INDUSTRIAL PRACTICE SCHOOL :: K. L. DEEMED TO BE UNIVERSITY",L,29,{width:W,align:"center",lineBreak:false});
 font(true,10);doc.text("FORTNIGHTLY PROGRESS REPORT (PS__ , A.Y. 20____ - ____)",L,42,{width:W,align:"center",lineBreak:false});y=61;
 line([[266,"1. Name of the Student: "+x.full_name],[111,"2. University ID No.: "+(x.roll_number||"—")],[116,"3. Branch: "+(x.branch||"—")]],29);
 line([[164,"4. Regional Office: Hyderabad"],[329,"5. Practice School Company: GAINT Clout Technologies Pvt. Ltd."]],27);
 line([[164,"6. Company Guide: "+(x.guide||"—")],[329,"7. University Guide: __________________"]],27);
 line([[493,"8. Project Title (Should be uniform for fortnight reports): "+(x.project_title||"—")]],27);
 const aw=[65,96,55,55,55,55,56,56];
 let left=L;const labels=["9. Fortnight No.","10. Commencing date","11. Working days","", "12. Days present","","13. Leaves availed",""];
 for(let i=0;i<aw.length;i++){rect(left,y,aw[i],25);put(labels[i],left,y,aw[i],25);left+=aw[i];}y+=25;
 left=L;const values=[String(x.fortnight_no),date(x.from_date),"This fortnight","Till date","This fortnight","Till date","This fortnight","Till date"];
 for(let i=0;i<aw.length;i++){rect(left,y,aw[i],24);put(values[i],left,y,aw[i],24,{align:"center"});left+=aw[i];}y+=24;
 left=L;const numbers=["",date(x.from_date),x.fort.work,x.all.work,x.fort.present,x.all.present,x.fort.leave,x.all.leave];
 for(let i=0;i<aw.length;i++){rect(left,y,aw[i],22);put(String(numbers[i]),left,y,aw[i],22,{align:"center"});left+=aw[i];}y+=22;
 section("Report on On-the-Job Engineer Training (OJET)");
 area("14. Achievements / Progress till date (Provide full details. Use additional paper, if required)",x.achievements,93);
 area("15. Plan for the coming fortnight (mention in detail)                  From: "+date(x.next_from)+"          To: "+date(x.next_to),x.next_plan,77);
 area("16. Exceptions, if any (such as time over run, unanticipated problems, etc.)",x.exceptions||"No exceptions.",51);
 line([[275,"Date: "+date(x.to_date)],[218,"Signature of the Student: __________________"]],19);
 section("Evaluation by University Guide & Company Guide");
 const evalRow=(title,criteria,marks,height,extra,assets=false)=>{
  const main=W-93;rect(L,y,main,height);rect(L+main,y,93,height,true);
  put(title,L,y,main,17,{bold:true});put(criteria,L,y+16,main,36,{size:7});
  if(extra)put(extra,L+2,y+49,main-4,assets?36:height-54);
  put(marks,L+main,y,93,43,{bold:true,align:"center"});
  if(assets){
   if(x.signature_snapshot&&x.signature_mime)doc.image(x.signature_snapshot,L+main-173,y+height-42,{fit:[75,32]});
   if(x.stamp_snapshot&&x.stamp_mime)doc.image(x.stamp_snapshot,L+main-91,y+height-48,{fit:[76,40]});
   font(false,6);doc.text("(Signature of Company Guide)",L+main-185,y+height-10,{width:180,align:"right",lineBreak:false});
  }else{font(false,6);doc.text("(Signature of University Guide)",L+main-190,y+height-13,{width:185,align:"right",lineBreak:false});}
  y+=height;
 };
 evalRow("17. Criteria for evaluation:","a) student discipline, b) regularity, c) punctuality, d) commitment, e) willingness to work hard, f) attitude & behavior etc.","Assessed by UG for 10 M per fortnight\n"+(x.university_marks??"—")+" / 10",79,"");
 evalRow("18. Criteria for evaluation:","a) progress achieved during the fortnight on OJET, b) work engagement, c) ability to solve problems, d) knowledge application, e) professional behavior, f) teamwork, g) new ideas generated for the company, h) appreciations received etc.","Assessed by CG for 30 M per fortnight\n"+(x.company_marks??"—")+" / 30",107,x.company_comments,true);
 const total=x.company_marks!=null&&x.university_marks!=null?Number(x.company_marks)+Number(x.university_marks):"—";
 rect(L,y,W-93,58);rect(R-93,y,93,58,true);put("19. Feedback, if any, to the student",L,y,W-93,17,{bold:true});put(x.student_feedback||"—",L,y+17,W-93,31);put("Total Marks for the fortnight (10+30=40 M)\n"+total+" / 40",R-93,y,93,50,{bold:true,align:"center"});
 font(false,6);doc.text("(University Guide shall forward to the Director, Industrial Practice School)",L+30,y+48,{width:W-130,align:"center",lineBreak:false});y+=58;
 if(y>810)throw Error("KLU layout exceeds A4 page");
 doc.end();return doc;
}
const para=(text,bold=false)=>new Paragraph({spacing:{before:0,after:0},children:[new TextRun({text:plain(text),bold,size:15})]});
const makeCell=(span,content,opts={})=>new TableCell({columnSpan:span,verticalAlign:"center",shading:opts.shade?{fill:"E7E7E7"}:undefined,margins:{top:55,bottom:55,left:80,right:80},children:Array.isArray(content)?content:[para(content,opts.bold)]});
const tableRow=(parts,height)=>new TableRow({cantSplit:true,height:{value:height,rule:"atLeast"},children:parts.map(([span,value,opts])=>makeCell(span,value,opts))});
async function makeDocx(x){
 const v=(label,value)=>label+": "+(value??"—");
 const total=x.company_marks!=null&&x.university_marks!=null?Number(x.company_marks)+Number(x.university_marks):"—";
 const sign=[];
 for(const [label,data,mime] of [["Company Guide Signature",x.signature_snapshot,x.signature_mime],["Official Company Stamp",x.stamp_snapshot,x.stamp_mime]]){
  const runs=[new TextRun({text:label+": ",size:14})];
  if(data&&mime)runs.push(new ImageRun({data,transformation:{width:95,height:36},type:mime==="image/png"?"png":"jpg"}));
  sign.push(new Paragraph({spacing:{before:0,after:0},children:runs}));
 }
 const rows=[
 tableRow([[6,v("1. Name of the Student",x.full_name)],[3,v("2. University ID No.",x.roll_number)],[3,v("3. Branch",x.branch)]],430),
 tableRow([[4,"4. Regional Office: Hyderabad"],[8,"5. Practice School Company: GAINT Clout Technologies Pvt. Ltd."]],390),
 tableRow([[5,v("6. Company Guide",x.guide)],[7,"7. University Guide: __________________"]],390),
 tableRow([[12,v("8. Project Title",x.project_title)]],390),
 tableRow([[2,v("9. Fortnight No.",x.fortnight_no)],[2,v("10. Commencing",date(x.from_date))],[8,"11. Working days: "+x.fort.work+" / "+x.all.work+"    12. Days present: "+x.fort.present+" / "+x.all.present+"    13. Leaves: "+x.fort.leave+" / "+x.all.leave]],580),
 tableRow([[12,"Report on On-the-Job Engineer Training (OJET)",{shade:true,bold:true}]],280),
 tableRow([[12,[para("14. Achievements / Progress till date",true),para(x.achievements||"—")]]],1120),
 tableRow([[12,[para("15. Plan for the coming fortnight     From: "+date(x.next_from)+"     To: "+date(x.next_to),true),para(x.next_plan||"—")]]],880),
 tableRow([[12,[para("16. Exceptions, if any",true),para(x.exceptions||"No exceptions."),para("Date: "+date(x.to_date)+"                                   Signature of Student: __________________")]]],680),
 tableRow([[12,"Evaluation by University Guide & Company Guide",{shade:true,bold:true}]],280),
 tableRow([[10,[para("17. Criteria for evaluation:",true),para("Discipline, regularity, punctuality, commitment, willingness to work hard, attitude and behavior."),para("Signature of University Guide: __________________")]], [2,"Assessed by UG: "+(x.university_marks??"—")+"/10"]],1050),
 tableRow([[10,[para("18. Criteria for evaluation:",true),para("OJET progress, work engagement, problem solving, knowledge application, professional behavior, teamwork, ideas and appreciation."),para(x.company_comments||"—"),...sign]],[2,"Assessed by CG: "+(x.company_marks??"—")+"/30"]],1400),
 tableRow([[10,[para("19. Feedback, if any, to the student",true),para(x.student_feedback||"—"),para("University Guide shall forward to Director, Industrial Practice School")]], [2,"Total Marks: "+total+"/40"]],1000)
 ];
 const document=new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:540,bottom:540,left:540,right:540}}},children:[
 new Paragraph({text:"INDUSTRIAL PRACTICE SCHOOL :: K. L. DEEMED TO BE UNIVERSITY",alignment:AlignmentType.CENTER,spacing:{after:70},run:{bold:true}}),
 new Paragraph({text:"FORTNIGHTLY PROGRESS REPORT",alignment:AlignmentType.CENTER,spacing:{after:100}}),
 new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:Array(12).fill(900),rows})
 ]}]});
 return Packer.toBuffer(document);
}
export function registerKluExports(r) {
  r.get("/reports/:id/export/:format", async (req, res) => {
    const format = req.params.format;
    if (!["pdf", "docx"].includes(format))
      return res.status(400).json({ error: "Unsupported format" });
    const x = await fetchReport(req, req.params.id);
    if (!x)
      return res
        .status(404)
        .json({ error: "Report not found or access denied" });
    res.set("Cache-Control", "no-store");
    res.set(
      "Content-Disposition",
      'attachment; filename="KLU_Fortnight_' +
        x.fortnight_no +
        "_" +
        x.roll_number +
        "." +
        format +
        '"',
    );
    if (format === "pdf") {
      if (!pdfFits(x))
        return res
          .status(422)
          .json({
            error:
              "Report text is too long for one A4 page. Shorten the achievements, plan, exceptions, company comments or feedback before downloading.",
          });
      res.type("application/pdf");
      makePdf(x).pipe(res);
    } else {
      res.type(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.send(await makeDocx(x));
    }
  });
}
