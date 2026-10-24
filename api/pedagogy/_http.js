export function jsonHeaders() {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: jsonHeaders() });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
