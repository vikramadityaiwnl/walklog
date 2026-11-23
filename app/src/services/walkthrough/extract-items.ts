import { generateText } from "../firebase/ai";
import type { Priority, Trade } from "../../models/walkthrough";

export interface ExtractedItem {
  issueSummary: string;
  location: string;
  trade?: Trade;
  priority?: Priority;
  missingInfoHint?: string;
}

const priorities: Priority[] = ["High", "Medium", "Low"];

function splitNote(note: string): string[] {
  const parts = note.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [note];
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const words = part.trim().split(/\s+/);
    for (const word of words) {
      if (current.length + word.length + 1 > 1600 && current) {
        chunks.push(current);
        current = "";
      }
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

export async function extractItems(
  note: string,
  mode: "device" | "cloud" = "device",
): Promise<ExtractedItem[]> {
  const items: ExtractedItem[] = [];
  for (const chunk of splitNote(note))
    items.push(...(await extractChunk(chunk, mode)));
  if (!items.length)
    throw new Error(
      "We couldn’t find any actionable issues in your notes. Try describing what needs attention.",
    );

  return items;
}

const prompt = `Identify only distinct, actionable property or site issues explicitly described in the input. An issue must describe a real defect, damage, unfinished work, or a specific repair or inspection that is needed. Ignore greetings, names, introductions, general conversation, and statements that do not describe an issue. Do not invent problems, access errors, tasks, locations, or other details. Do not split one issue into multiple items. If there are no actionable issues, return [].

Return only a JSON array. Each object must contain issueSummary, location, trade, priority, missingInfoHint, and sourceExcerpt. sourceExcerpt must be an exact short quote from the input that explicitly describes the issue. Trade can be any appropriate short name. Priority must be High, Medium, Low, or null. Use null for unknown fields.`;

export async function extractAudio(
  uri: string,
  mimeType: string,
): Promise<ExtractedItem[]> {
  const result = await generateText(prompt, "cloud", { uri, mimeType });
  const items = parseItems(result.text);
  if (!items.length)
    throw new Error("No issues were identified. Try another recording.");

  return items;
}

async function extractChunk(
  note: string,
  mode: "device" | "cloud",
): Promise<ExtractedItem[]> {
  const result = await generateText(
    `${prompt} Notes: ${JSON.stringify(note)}`,
    mode,
  );

  return parseItems(result.text, note);
}

function normalizeEvidence(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function capitalizeWords(text: string): string {
  return text
    .trim()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, separator: string, letter: string) =>
        `${separator}${letter.toLocaleUpperCase()}`,
    );
}

function parseItems(text: string, note?: string): ExtractedItem[] {
  const json = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "The model couldn’t organize this note. Try again or add items manually.",
    );
  }
  if (!Array.isArray(parsed))
    throw new Error(
      "The model could not organize this note. Try again or add items manually.",
    );

  const items = parsed.flatMap((value: unknown): ExtractedItem[] => {
    if (!value || typeof value !== "object") return [];

    const item = value as Record<string, unknown>;
    if (typeof item.issueSummary !== "string" || !item.issueSummary.trim())
      return [];

    if (note !== undefined) {
      const excerpt =
        typeof item.sourceExcerpt === "string"
          ? normalizeEvidence(item.sourceExcerpt)
          : "";
      if (!excerpt || !normalizeEvidence(note).includes(excerpt)) return [];
    }

    return [
      {
        issueSummary: item.issueSummary.trim(),
        location:
          typeof item.location === "string"
            ? capitalizeWords(item.location)
            : "",
        trade:
          typeof item.trade === "string" && item.trade.trim()
            ? capitalizeWords(item.trade)
            : undefined,
        priority: priorities.find((priority) => priority === item.priority),
        missingInfoHint:
          typeof item.missingInfoHint === "string"
            ? item.missingInfoHint
            : undefined,
      },
    ];
  });

  return items;
}
