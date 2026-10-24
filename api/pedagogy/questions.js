import { FIELD_LABELS, FIELD_ORDER, INSTRUMENT_FRAMEWORK, LIKERT, QUESTIONS, SHORT_FIELD_LABELS, SPECTRUM_POLES } from "./_bank.js";
import { jsonHeaders, optionsResponse } from "./_http.js";

export function OPTIONS() {
  return optionsResponse();
}

/** Question bank for the browser instrument. Replaces questions_data.py on the site. */
export async function GET() {
  return Response.json(
    {
      framework: INSTRUMENT_FRAMEWORK,
      likert: LIKERT,
      questions: QUESTIONS,
      spectrum_poles: SPECTRUM_POLES,
      short_field_labels: SHORT_FIELD_LABELS,
      field_labels: FIELD_LABELS,
      field_order: FIELD_ORDER,
    },
    { headers: jsonHeaders() }
  );
}

