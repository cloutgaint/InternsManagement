import {PDFDocument,StandardFonts,rgb,degrees} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";

// Coordinates are measured from the TOP of the original 862.5 x 605.25 pt
// landscape certificate. They are normalized at runtime against the page's
// actual CropBox, without changing the source page, art or signatures.
// Admins can override positions by providing CERTIFICATE_LAYOUT_JSON.
export const DEFAULT_LAYOUT=Object.freeze({
 referenceWidth:862.5,referenceHeight:605.25,
 certificateId:{cx:0.5,top:0.115,maxWidth:0.38,fontSize:10,minSize:8},
 recipient:{cx:0.5,top:0.445,maxWidth:0.68,height:0.078,fontSize:35,minSize:18},
 body:{cx:0.5,top:0.558,maxWidth:0.77,bottom:0.744,fontSize:9.6,minSize:7.2,lineHeight:1.55}
});
export function formatCertificateDate(value){
 const s=value instanceof Date?value.toISOString().slice(0,10):String(value||"").slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error("Invalid approved internship date");
 const [year,month,day]=s.split("-").map(Number);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error("Invalid approved internship date");
 const suffix=day%100>=11&&day%100<=13?"TH":day%10===1?"ST":day%10===2?"ND":day%10===3?"RD":"TH";
 return String(day).padStart(2,"0")+suffix+" "+d.toLocaleString("en-GB",{month:"long",timeZone:"UTC"}).toUpperCase()+" "+year;
}
function centered(page,font,text,top,size,region,color){
 const box=page.getCropBox(),x=box.x+box.width*region.cx;
 const width=font.widthOfTextAtSize(text,size);
 page.drawText(text,{x:x-width/2,y:box.y+box.height*(1-top)-font.heightAtSize(size),font,size,color});
}
function fitted(font,text,size,min,maxWidth){
 let n=size;
 while(n>min&&font.widthOfTextAtSize(text,n)>maxWidth)n-=0.25;
 if(font.widthOfTextAtSize(text,n)>maxWidth)throw Error("Certificate text exceeds the configured safe area");
 return n;
}
function wordsIntoLines(text,font,size,maxWidth){
 const lines=[];let current="";
 for(const word of text.split(/\s+/).filter(Boolean)){
  const next=current?current+" "+word:word;
  if(font.widthOfTextAtSize(next,size)<=maxWidth){current=next;continue}
  if(!current)throw Error("Certificate text contains a word too wide for its region");
  lines.push(current);current=word;
 }
 if(current)lines.push(current);
 return lines;
}
export async function renderCertificate(template,certificate,{scriptFontPath=process.env.CERTIFICATE_SCRIPT_FONT_PATH,layout=DEFAULT_LAYOUT}={}){
 const doc=await PDFDocument.load(template,{updateMetadata:false});
 if(doc.getPageCount()!==1)throw Error("Certificate template must contain exactly one page");
 const page=doc.getPage(0),box=page.getCropBox();
 if(box.width<=box.height)throw Error("Certificate template must be landscape");
 const regular=await doc.embedFont(StandardFonts.Helvetica);
 const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let script;
 if(scriptFontPath){
  doc.registerFontkit(fontkit);
  script=await doc.embedFont(await readFile(scriptFontPath),{subset:true});
 }else{
  // Fail closed rather than silently replacing the reference script with
  // Times Italic and claiming a matching certificate.
  throw Error("Configure CERTIFICATE_SCRIPT_FONT_PATH with a licensed TTF/OTF script font before generating certificates");
 }
 const scale=Math.min(box.width/layout.referenceWidth,box.height/layout.referenceHeight);
 const ink=rgb(0.13,0.22,0.40),gold=rgb(0.79,0.60,0.09);
 const id="Certificate ID: "+String(certificate.certificate_number||"");
 const idRegion=layout.certificateId;
 const idSize=fitted(bold,id,idRegion.fontSize*scale,idRegion.minSize*scale,box.width*idRegion.maxWidth);
 centered(page,bold,id,idRegion.top,idSize,idRegion,rgb(0.08,0.08,0.08));
 const name=String(certificate.student_name||"").trim();
 if(!name)throw Error("Intern name is required");
 const nr=layout.recipient,maxNameWidth=box.width*nr.maxWidth;
 let nameSize=nr.fontSize*scale;
 while(nameSize>nr.minSize*scale&&script.widthOfTextAtSize(name,nameSize)>maxNameWidth)nameSize-=0.25;
 const nameLines=script.widthOfTextAtSize(name,nameSize)<=maxNameWidth?[name]:wordsIntoLines(name,script,nameSize,maxNameWidth);
 if(nameLines.length>2)throw Error("Recipient name cannot fit within two lines");
 const height=script.heightAtSize(nameSize)*nameLines.length;
 if(height>box.height*nr.height)throw Error("Recipient name exceeds the safe height; adjust the template layout");
 nameLines.forEach((line,i)=>centered(page,script,line,nr.top+i*script.heightAtSize(nameSize)/box.height,nameSize,nr,gold));
 const project=String(certificate.project_title||"").trim().toUpperCase();
 if(!project)throw Error("A project title is required before issuing a certificate");
 const intern=name.toUpperCase();
 const body=[
  "THIS IS TO CERTIFY THAT THE INTERNSHIP PROJECT ENTITLED \""+project+"\" IS A BONAFIDE WORK",
  "CARRIED OUT BY",
  intern+" AT GAINT CLOUT TECHNOLOGIES PVT. LTD., HYDERABAD DURING THE",
  "PERIOD FROM",
  formatCertificateDate(certificate.start_date)+" TO "+formatCertificateDate(certificate.end_date)
 ];
 const region=layout.body,maxWidth=box.width*region.maxWidth,allowedHeight=box.height*(region.bottom-region.top);
 let fontSize=region.fontSize*scale,lines=[];
 for(;fontSize>=region.minSize*scale;fontSize-=0.2){
  lines=body.flatMap((line,index)=>wordsIntoLines(line,index===1||index===4?bold:regular,fontSize,maxWidth).map(text=>({text,bold:index===1||index===4})));
  if(lines.length*fontSize*region.lineHeight<=allowedHeight)break;
 }
 if(fontSize<region.minSize*scale)throw Error("Certificate paragraph cannot fit above the signatures");
 lines.forEach((line,i)=>centered(page,line.bold?bold:regular,line.text,region.top+(i*fontSize*region.lineHeight)/box.height,fontSize,region,ink));
 return Buffer.from(await doc.save({useObjectStreams:false}));
}
