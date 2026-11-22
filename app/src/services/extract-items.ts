import { generateText } from "./firebase-ai";
import type { Priority, Trade } from "../models/walkthrough";

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
      "No issues were identified. Edit the note or add an item manually.",
    );

  return items;
}

const prompt = `Extract every distinct site issue as a JSON array of objects with issueSummary, location, trade, priority, missingInfoHint. Trade can be any appropriate short name. Priority must be High, Medium, Low, or null. Use null for unknown fields; never invent details. Return JSON only.`;

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

  return parseItems(result.text);
}

function parseItems(text: string): ExtractedItem[] {
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

    return [
      {
        issueSummary: item.issueSummary.trim(),
        location: typeof item.location === "string" ? item.location.trim() : "",
        trade:
          typeof item.trade === "string" && item.trade.trim()
            ? item.trade.trim()
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
