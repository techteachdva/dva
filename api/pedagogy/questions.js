import { INSTRUMENT_FRAMEWORK, LIKERT, QUESTIONS, SHORT_FIELD_LABELS, SPECTRUM_POLES } from "./_bank.js";

function headers() {
  return {
    "Cache-Control": "no-store",
  };
}

export async function GET() {
  return Response.json(
    {
      framework: INSTRUMENT_FRAMEWORK,
      likert: LIKERT,
      questions: QUESTIONS,
      spectrum_poles: SPECTRUM_POLES,
      short_field_labels: SHORT_FIELD_LABELS,
    },
    { headers: headers() }
  );
}

