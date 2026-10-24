import { OPTIONS, POST } from "../../api/pedagogy/analyze.js";

export default async (req) => {
  if (req.method === "OPTIONS") return OPTIONS();
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  return POST(req);
};
