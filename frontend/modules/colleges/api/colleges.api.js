import { api } from "@/shared/api/client";

export const getColleges = () => api("/admin/colleges");
export const createCollege = (input) => api("/admin/colleges", {
  method: "POST",
  body: JSON.stringify(input),
});
export const updateCollege = (id, input) => api("/admin/colleges/" + id, {
  method: "PATCH",
  body: JSON.stringify(input),
});
