import { GET, OPTIONS } from "../../api/pedagogy/questions.js";

export default async (req) => {
  if (req.method === "OPTIONS") return OPTIONS();
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "GET required" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  return GET(req);
};
