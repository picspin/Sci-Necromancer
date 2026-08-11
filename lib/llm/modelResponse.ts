/**
 * Parse structured model output without assuming the provider obeyed the
 * "JSON only" instruction literally. Compatible gateways commonly wrap
 * otherwise valid JSON in a Markdown fence or short explanatory sentence.
 */
export function parseStructuredModelOutput(text: string): unknown | null {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const candidates = [unfenced];
  const objectStart = unfenced.indexOf('{');
  const objectEnd = unfenced.lastIndexOf('}');
  const arrayStart = unfenced.indexOf('[');
  const arrayEnd = unfenced.lastIndexOf(']');
  const boundedCandidates = [
    ...(arrayStart >= 0 && arrayEnd > arrayStart
      ? [{ start: arrayStart, value: unfenced.slice(arrayStart, arrayEnd + 1) }]
      : []),
    ...(objectStart >= 0 && objectEnd > objectStart
      ? [{ start: objectStart, value: unfenced.slice(objectStart, objectEnd + 1) }]
      : []),
  ].sort((left, right) => left.start - right.start);
  for (const candidate of boundedCandidates) {
    candidates.push(candidate.value);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next bounded candidate before treating the response as text.
    }
  }
  return null;
}
