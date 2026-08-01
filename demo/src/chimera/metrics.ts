import { createTinySegmenterTokenizer } from "gibun";

export interface TextMetrics {
  charCount: number;
  tokenCount: number;
  uniqueTokenCount: number;
}

const tokenize = createTinySegmenterTokenizer();

export async function computeTextMetrics(text: string): Promise<TextMetrics> {
  if (!text) {
    return { charCount: 0, tokenCount: 0, uniqueTokenCount: 0 };
  }
  const tokens = await tokenize(text);
  const unique = new Set(tokens.map((t) => t.value));
  return {
    charCount: text.length,
    tokenCount: tokens.length,
    uniqueTokenCount: unique.size,
  };
}

export async function computeLineTokenCounts(lines: string[]): Promise<number[]> {
  return Promise.all(lines.map(async (line) => (await tokenize(line)).length));
}
