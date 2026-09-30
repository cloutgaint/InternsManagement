import jwt from 'jsonwebtoken';
export function auth(req,res,next){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):null;if(!t)return res.status(401).json({error:'Authentication required'});try{req.user=jwt.verify(t,process.env.JWT_SECRET);next()}catch{return res.status(401).json({error:'Invalid or expired token'})}}
export const permit=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'});
