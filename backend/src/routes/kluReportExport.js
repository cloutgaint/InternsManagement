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
function makePdf(x) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 32,
    autoFirstPage: true,
    bufferPages: false,
  });
  const W = 531,
    L = 32;
  let y = 35;
  const band = (s, h = 20) => {
    doc.rect(L, y, W, h).fillAndStroke("#e9ecef", "#444");
    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(s, L + 4, y + 5, { width: W - 8, align: "center" });
    y += h;
  };
  const row = (cells, h = 25) => {
    let xx = L;
    for (const [w, label] of cells) {
      doc.rect(xx, y, w, h).stroke("#555");
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#111")
        .text(clip(label, 170), xx + 4, y + 5, {
          width: w - 8,
          height: h - 8,
          ellipsis: true,
        });
      xx += w;
    }
    y += h;
  };
  const area = (label, value, h) => {
    doc.rect(L, y, W, h).stroke("#555");
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(label, L + 5, y + 4, { width: W - 10 });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(clip(value, 480), L + 7, y + 19, {
        width: W - 14,
        height: h - 22,
        ellipsis: true,
      });
    y += h;
  };
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("INDUSTRIAL PRACTICE SCHOOL :: K. L. DEEMED TO BE UNIVERSITY", L, y, {
      width: W,
      align: "center",
    });
  y += 18;
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("FORTNIGHTLY PROGRESS REPORT", L, y, { width: W, align: "center" });
  y += 22;
  row(
    [
      [235, "1. Student: " + x.full_name],
      [170, "2. University ID: " + (x.roll_number || "—")],
      [126, "3. Branch: " + (x.branch || "—")],
    ],
    27,
  );
  row(
    [
      [190, "4. Regional Office: Hyderabad"],
      [341, "5. Practice School Company: GAINT Clout Technologies Pvt. Ltd."],
    ],
    25,
  );
  row(
    [
      [260, "6. Company Guide: " + (x.guide || "—")],
      [271, "7. University Guide: —"],
    ],
    25,
  );
  row([[531, "8. Project Title: " + (x.project_title || "—")]], 25);
  row(
    [
      [100, "9. Fortnight No.: " + x.fortnight_no],
      [160, "10. Commencing: " + date(x.from_date)],
      [271, "Period: " + date(x.from_date) + " to " + date(x.to_date)],
    ],
    26,
  );
  row(
    [
      [177, "11. Working days"],
      [177, "12. Days present"],
      [177, "13. Leaves availed"],
    ],
    19,
  );
  row(
    [
      [177, "Fortnight: " + x.fort.work + " | Till date: " + x.all.work],
      [177, "Fortnight: " + x.fort.present + " | Till date: " + x.all.present],
      [177, "Fortnight: " + x.fort.leave + " | Till date: " + x.all.leave],
    ],
    25,
  );
  band("Report on On-the-Job Engineer Training (OJET)", 19);
  area("14. Achievements / Progress till date", x.achievements || "—", 62);
  area(
    "15. Plan for the coming fortnight  |  From: " +
      date(x.next_from) +
      "  To: " +
      date(x.next_to),
    x.next_plan || "—",
    47,
  );
  area("16. Exceptions, if any", x.exceptions || "No exceptions.", 37);
  row(
    [
      [330, "Date: " + date(x.to_date)],
      [201, "Signature of Student: __________________"],
    ],
    22,
  );
  band("Evaluation by University Guide & Company Guide", 19);
  area(
    "17. University Guide Evaluation (10 marks) | Assessed: " +
      (x.university_marks ?? "—") +
      "/10",
    "Discipline, regularity, punctuality, commitment, willingness to work hard, attitude and behavior.\nUniversity Guide Signature: __________________",
    55,
  );
  const sy = y;
  doc.rect(L, y, W, 83).stroke("#555");
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      "18. Company Guide Evaluation (30 marks) | Assessed: " +
        (x.company_marks ?? "—") +
        "/30",
      L + 5,
      y + 4,
      { width: W - 10 },
    );
  doc
    .font("Helvetica")
    .fontSize(7)
    .text(
      "OJET progress, work engagement, problem solving, knowledge application, professional behavior, teamwork and ideas.",
      L + 5,
      y + 18,
      { width: W - 10 },
    );
  doc
    .fontSize(8)
    .text(clip(x.company_comments || "—", 230), L + 5, y + 34, {
      width: W - 180,
      height: 43,
      ellipsis: true,
    });
  if (x.signature_snapshot && x.signature_mime) {
    doc.image(x.signature_snapshot, L + W - 170, y + 38, { fit: [76, 39] });
  }
  if (x.stamp_snapshot && x.stamp_mime) {
    doc.image(x.stamp_snapshot, L + W - 87, y + 32, { fit: [75, 48] });
  }
  y = sy + 83;
  area("19. Feedback, if any, to the student", x.student_feedback || "—", 55);
  const total =
    x.company_marks != null && x.university_marks != null
      ? Number(x.company_marks) + Number(x.university_marks)
      : "—";
  row(
    [
      [
        375,
        "University Guide shall forward to Director, Industrial Practice School",
      ],
      [156, "Total Marks: " + total + " / 40"],
    ],
    23,
  );
  if (y > doc.page.height - 32)
    throw new Error("KLU report exceeds one A4 page");
  doc.end();
  return doc;
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
