export const DEFAULT_WEIGHTS = Object.freeze({attendance:25,tasks:35,reviews:25,final:15});
export function validateWeights(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys=Object.keys(DEFAULT_WEIGHTS);
  return Object.keys(value).length===keys.length && keys.every(k=>typeof value[k]==="number" && Number.isFinite(value[k]) && value[k]>=0 && value[k]<=100) && keys.reduce((n,k)=>n+value[k],0)===100;
}
export function calculatePerformance(metrics,weights=DEFAULT_WEIGHTS) {
  if (!validateWeights(weights)) throw new Error("Performance weights must total 100%");
  const values={attendance:metrics.attendance_pct,tasks:metrics.avg_task_marks,reviews:metrics.avg_individual_marks,final:metrics.final_individual_marks};
  const available=Object.keys(weights).filter(k=>values[k]!==null && values[k]!==undefined && Number.isFinite(Number(values[k])));
  const total=available.reduce((n,k)=>n+weights[k],0);
  return total ? Number((available.reduce((n,k)=>n+Math.max(0,Math.min(100,Number(values[k])))*weights[k],0)/total).toFixed(1)) : null;
}
