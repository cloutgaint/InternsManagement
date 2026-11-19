import http from "node:http";
import "@tensorflow/tfjs-node";
import HumanModule from "@vladmandic/human";
import { createRequire } from "node:module";
import path from "node:path";
// The Node build is CommonJS, so the default import is the module object rather than the class.
const Human=HumanModule.Human||HumanModule.default;
const token=process.env.BIOMETRIC_VERIFY_TOKEN;
if(!token)throw new Error("Set BIOMETRIC_VERIFY_TOKEN before starting verifier");
// Load the model weights shipped with the installed package, so the verifier works offline and
// always uses weights that match the library version.
const modelDir=path.join(path.dirname(createRequire(import.meta.url).resolve("@vladmandic/human")),"..","models")+path.sep;
// Still images only: disable frame caching/skipping so every input is analysed fresh.
// antispoof scores how likely the live capture is a real face rather than a printed or on-screen photo.
const human=new Human({backend:"tensorflow",modelBasePath:"file://"+modelDir,cacheSensitivity:0,face:{enabled:true,detector:{enabled:true,rotation:true,skipFrames:0,maxDetected:2},mesh:{enabled:true},description:{enabled:true,skipFrames:0},emotion:{enabled:false},iris:{enabled:false},antispoof:{enabled:true,skipFrames:0},liveness:{enabled:false}},body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false},segmentation:{enabled:false}});
await human.load();
await human.warmup();
const YAW_SIGN=Number(process.env.BIOMETRIC_YAW_SIGN||1)<0?-1:1;
class InputError extends Error{}
async function detect(data,label){
  if(!/^data:image\/(jpeg|jpg|png);base64,/.test(data||""))throw new InputError("Invalid "+label+" image");
  const tensor=human.tf.tidy(()=>human.tf.expandDims(human.tf.node.decodeImage(Buffer.from(data.split(",")[1],"base64"),3),0));
  try{
    const result=await human.detect(tensor);
    const faces=result.face||[];
    if(faces.length!==1)throw new InputError((faces.length?"Multiple faces":"No face")+" detected in the "+label+" image");
    if(!faces[0].embedding?.length)throw new InputError("Could not read facial features from the "+label+" image");
    return faces[0];
  }finally{human.tf.dispose(tensor)}
}
const yaw=f=>Number(f.rotation?.angle?.yaw);
const server=http.createServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method!=="POST"||req.url!=="/verify"){res.writeHead(404).end(JSON.stringify({error:"Not found"}));return}
  if(req.headers.authorization!=="Bearer "+token){res.writeHead(401).end(JSON.stringify({error:"Unauthorized"}));return}
  try{
    let raw="";
    for await(const chunk of req){raw+=chunk;if(raw.length>20000000)throw new InputError("Request too large")}
    const {imageData,baselineImageData,enrollmentImageData,challengeType}=JSON.parse(raw);
    if(challengeType!=="FACE_ONLY")throw new InputError("Unsupported verification mode");
    // Sequential on purpose: Human keeps per-instance state between detect() calls.
    const enrolled=await detect(enrollmentImageData,"enrollment");
    const live=await detect(imageData,"live");
    const matchScore=human.match.similarity(live.embedding,enrolled.embedding);
    // Passive presentation-attack score for the live frame (0 = likely spoof, 1 = likely real face).
    const antispoofScore=Number(live.real);
    if(!Number.isFinite(antispoofScore))throw new Error("Anti-spoof model returned no score");
    if(process.env.NODE_ENV!=="production")console.log("verify",{mode:"FACE_ONLY",matchScore,antispoofScore});
    // FACE_ONLY has no active challenge, so challengePass is always true; the backend decides whether
    // antispoofScore (sent as livenessScore) is enforced.
    res.writeHead(200).end(JSON.stringify({matchScore,livenessScore:antispoofScore,challengePass:true}));
  }catch(e){
    if(!(e instanceof InputError)&&!(e instanceof SyntaxError))console.error("verify failed",e);
    res.writeHead(e instanceof InputError||e instanceof SyntaxError?422:500).end(JSON.stringify({error:e instanceof InputError?e.message:"Verification failed"}));
  }
});
// Localhost by default; the container sets BIOMETRIC_VERIFY_HOST=0.0.0.0 so the backend can reach it
// over the private Compose network (the port is never published).
const bindHost=process.env.BIOMETRIC_VERIFY_HOST||"127.0.0.1",bindPort=Number(process.env.BIOMETRIC_VERIFY_PORT||8765);
server.listen(bindPort,bindHost,()=>console.log("Local biometric verifier listening on "+bindHost+":"+bindPort));
