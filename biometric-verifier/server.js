import http from "node:http";
import "@tensorflow/tfjs-node";
import HumanModule from "@vladmandic/human";
// The Node build is CommonJS, so the default import is the module object rather than the class.
const Human=HumanModule.Human||HumanModule.default;
const token=process.env.BIOMETRIC_VERIFY_TOKEN;
if(!token)throw new Error("Set BIOMETRIC_VERIFY_TOKEN before starting verifier");
// Still images only: disable frame caching/skipping so every input is analysed fresh.
const human=new Human({backend:"tensorflow",modelBasePath:"https://vladmandic.github.io/human-models/models/",cacheSensitivity:0,face:{enabled:true,detector:{enabled:true,rotation:true,skipFrames:0,maxDetected:2},mesh:{enabled:true},description:{enabled:true,skipFrames:0},emotion:{enabled:false},iris:{enabled:false},antispoof:{enabled:false},liveness:{enabled:false}},body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false},segmentation:{enabled:false}});
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
    if(!["TURN_LEFT","TURN_RIGHT"].includes(challengeType))throw new InputError("Unsupported challenge");
    // Sequential on purpose: Human keeps per-instance state between detect() calls.
    const enrolled=await detect(enrollmentImageData,"enrollment");
    const base=await detect(baselineImageData,"initial live");
    const live=await detect(imageData,"challenge");
    const matchScore=Math.min(human.match.similarity(live.embedding,enrolled.embedding),human.match.similarity(base.embedding,enrolled.embedding));
    const delta=YAW_SIGN*(yaw(live)-yaw(base));
    const challengePass=Number.isFinite(delta)&&Math.abs(delta)>=0.18&&((challengeType==="TURN_LEFT"&&delta<0)||(challengeType==="TURN_RIGHT"&&delta>0));
    if(process.env.NODE_ENV!=="production")console.log("verify",{challengeType,baseYaw:yaw(base),liveYaw:yaw(live),delta,matchScore,challengePass});
    res.writeHead(200).end(JSON.stringify({matchScore,livenessScore:challengePass?1:0,challengePass}));
  }catch(e){
    if(!(e instanceof InputError)&&!(e instanceof SyntaxError))console.error("verify failed",e);
    res.writeHead(e instanceof InputError||e instanceof SyntaxError?422:500).end(JSON.stringify({error:e instanceof InputError?e.message:"Verification failed"}));
  }
});
server.listen(Number(process.env.BIOMETRIC_VERIFY_PORT||8765),"127.0.0.1",()=>console.log("Local biometric verifier listening on 127.0.0.1:"+(process.env.BIOMETRIC_VERIFY_PORT||8765)));
