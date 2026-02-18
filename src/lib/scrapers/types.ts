export interface ScrapedItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: Date;
  category: "fundraising" | "hiring" | "trend" | "news" | "xpost" | "blog";
}

const FUNDRAISING_PATTERNS = /fundrais|series [a-d]|seed round|raises? \$|funding|valuation|investment round|pre-seed/i;
const HIRING_PATTERNS = /hiring|product manager|PM role|job opening|recruit|talent/i;
const TREND_PATTERNS = /AI trend|artificial intelligence|machine learning|LLM|generative AI|foundation model/i;

export function categorizeItem(text: string): ScrapedItem["category"] {
  if (FUNDRAISING_PATTERNS.test(text)) return "fundraising";
  if (HIRING_PATTERNS.test(text)) return "hiring";
  if (TREND_PATTERNS.test(text)) return "trend";
  return "news";
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}
