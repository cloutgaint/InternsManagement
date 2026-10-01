import {q} from '../config/db.js';
let timer=null,running=false;
export async function releaseDueTasks(){
 if(running)return;running=true;
 try{
  const due=(await q(`SELECT wt.* FROM weekly_tasks wt WHERE wt.status='SCHEDULED' AND wt.release_at IS NOT NULL AND wt.release_at<=now() ORDER BY wt.release_at FOR UPDATE SKIP LOCKED`)).rows;
  for(const t of due){
   const x=(await q("UPDATE weekly_tasks SET status='RELEASED',released_at=now() WHERE id=$1 AND status='SCHEDULED' RETURNING *",[t.id])).rows[0];
   if(!x)continue;
   const users=(await q(`SELECT DISTINCT ip.user_id FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active WHERE ba.batch_id=$1 AND ($2::uuid IS NULL OR ip.final_domain_id=$2) AND ($3::uuid IS NULL OR gm.group_id=$3)`,[t.batch_id,t.domain_id,t.group_id])).rows;
   for(const u of users)await q("INSERT INTO notifications(user_id,type,title,body) VALUES($1,'TASK_RELEASED',$2,$3)",[u.user_id,'Weekly task released: '+t.title,t.due_at?'Due '+new Date(t.due_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'Open your Tasks workspace for details.']);
  }
 }finally{running=false}
}
export function startTaskReleaseScheduler(){releaseDueTasks().catch(console.error);timer=setInterval(()=>releaseDueTasks().catch(console.error),60_000);timer.unref?.();return timer}
