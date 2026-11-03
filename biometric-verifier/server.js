import http from "node:http";
import { loadImage, createCanvas } from "canvas";
import Human from "@vladmandic/human";
import "@tensorflow/tfjs-node";
const token=process.env.BIOMETRIC_VERIFY_TOKEN;
if(!token)throw new Error("Set BIOMETRIC_VERIFY_TOKEN before starting verifier");
const human=new Human({backend:"tensorflow",modelBasePath:"https://vladmandic.github.io/human-models/models/",face:{enabled:true,detector:{enabled:true},mesh:{enabled:true},description:{enabled:true},emotion:{enabled:false},iris:{enabled:false}},body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false}});
await human.load();
await human.warmup();
const score=(a,b)=>{if(!a?.length||a.length!==b?.length)return 0;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?Math.max(0,Math.min(1,dot/Math.sqrt(aa*bb))):0};
async function detect(data){if(!/^data:image\/(jpeg|jpg|png);base64,/.test(data||""))throw Error("Invalid image");const image=await loadImage(Buffer.from(data.split(",")[1],"base64"));const canvas=createCanvas(image.width,image.height);canvas.getContext("2d").drawImage(image,0,0);const result=await human.detect(canvas);if(result.face?.length!==1)throw Error("Exactly one face required");return result.face[0]}
const yaw=f=>Number(f.rotation?.angle?.yaw);
const server=http.createServer(async(req,res)=>{res.setHeader("Content-Type","application/json");if(req.method!=="POST"||req.url!=="/verify"){res.writeHead(404).end(JSON.stringify({error:"Not found"}));return}if(req.headers.authorization!=="Bearer "+token){res.writeHead(401).end(JSON.stringify({error:"Unauthorized"}));return}try{let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>20000000)throw Error("Request too large")}const {imageData,baselineImageData,enrollmentImageData,challengeType}=JSON.parse(raw);if(!["TURN_LEFT","TURN_RIGHT"].includes(challengeType))throw Error("Unsupported challenge");const [live,base,enrolled]=await Promise.all([detect(imageData),detect(baselineImageData),detect(enrollmentImageData)]);const matchScore=score(live.embedding,enrolled.embedding);const baseMatch=score(base.embedding,enrolled.embedding);const delta=yaw(live)-yaw(base);const challengePass=Number.isFinite(delta)&&Math.abs(delta)>=0.18&&((challengeType==="TURN_LEFT"&&delta<0)||(challengeType==="TURN_RIGHT"&&delta>0));const livenessScore=challengePass?1:0;res.writeHead(200).end(JSON.stringify({matchScore:Math.min(matchScore,baseMatch),livenessScore,challengePass}));}catch(e){res.writeHead(422).end(JSON.stringify({error:e.message}))}});
server.listen(Number(process.env.BIOMETRIC_VERIFY_PORT||8765),"127.0.0.1",()=>console.log("Local biometric verifier listening on 127.0.0.1:"+(process.env.BIOMETRIC_VERIFY_PORT||8765)));
