import { scoreResponses } from "./_engine.js";
import { jsonHeaders, optionsResponse, readJson } from "./_http.js";

export function OPTIONS() {
  return optionsResponse();
}

/** Likert totals for a finished Pedagogy Profile. Replaces root scoring.py. */
export async function POST(request) {
  const body = await readJson(request);
  const responses = body?.responses && typeof body.responses === "object" ? body.responses : {};
  return Response.json(scoreResponses(responses), { headers: jsonHeaders() });
}
