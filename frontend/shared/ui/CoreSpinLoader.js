import {useId} from "react";
/** Lightweight CoreSpin-inspired loading indicator. No third-party dependencies. */
export default function CoreSpinLoader({label="Loading",size="md",inline=false}){
 const id=useId().replace(/:/g,"");
 return <div className={"gaint-core-spin"+(inline?" gaint-core-spin-inline":"")} role="status" aria-live="polite" aria-label={label}>
 <svg className={"gaint-core-spin-art gaint-core-spin-"+size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
 <circle cx="50" cy="50" r="38" stroke="#D9F3E6" strokeWidth="2"/>
 <circle cx="50" cy="50" r="32" stroke="#B7E7CF" strokeWidth="1.5" strokeDasharray="2 4"/>
 <circle className="gaint-core-spin-orbit" cx="50" cy="50" r="37" stroke="#17A66B" strokeWidth="2" strokeLinecap="round" strokeDasharray="45 188"/>
 <circle className="gaint-core-spin-orbit-reverse" cx="50" cy="50" r="28" stroke="#70D4A7" strokeWidth="2" strokeLinecap="round" strokeDasharray="26 150"/>
 <circle cx="50" cy="50" r="22" fill="#ECFBF3"/>
 <path className="gaint-core-spin-sweep" d="M50 32a18 18 0 0 1 0 36" stroke="#18A66C" strokeWidth="2" strokeLinecap="round"/>
 <circle cx="50" cy="50" r="4" fill="#158A60"/>
 </svg>
 <span className="gaint-core-spin-label">{label}<span aria-hidden="true">...</span></span>
 <style jsx>{`
 .gaint-core-spin{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:160px;width:100%;color:#075e46}.gaint-core-spin-inline{min-height:0;width:auto;flex-direction:row;gap:8px}.gaint-core-spin-art{display:block;flex:none}.gaint-core-spin-sm{width:30px;height:30px}.gaint-core-spin-md{width:72px;height:72px}.gaint-core-spin-lg{width:96px;height:96px}.gaint-core-spin-label{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#075e46}.gaint-core-spin-inline .gaint-core-spin-label{font-size:12px;letter-spacing:.02em;text-transform:none}.gaint-core-spin-orbit{transform-origin:50px 50px;animation:gaint-core-rotate 1.65s linear infinite}.gaint-core-spin-orbit-reverse{transform-origin:50px 50px;animation:gaint-core-rotate 2.4s linear infinite reverse}.gaint-core-spin-sweep{transform-origin:50px 50px;animation:gaint-core-rotate 1.2s ease-in-out infinite}@keyframes gaint-core-rotate{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.gaint-core-spin-orbit,.gaint-core-spin-orbit-reverse,.gaint-core-spin-sweep{animation:none}}
 `}</style>
 </div>;
}
