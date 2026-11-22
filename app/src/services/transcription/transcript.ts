export function cleanTranscript(text: string): string {
  return text
    .replace(/\[BLANK_AUDIO\]/gi, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
