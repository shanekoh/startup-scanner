import * as cheerio from "cheerio";
import type { ScrapedItem } from "./types";

// Curated AI/tech blog RSS feeds — free, public, no auth required
export const DEFAULT_BLOG_FEEDS: { url: string; name: string }[] = [
  // Substack — AI & tech thought leaders
  { url: "https://www.oneusefulthing.org/feed", name: "One Useful Thing (Ethan Mollick)" },
  { url: "https://www.lennysnewsletter.com/feed", name: "Lenny's Newsletter" },
  { url: "https://stratechery.com/feed/", name: "Stratechery" },
  { url: "https://www.newcomer.co/feed", name: "Newcomer (Eric Newcomer)" },
  { url: "https://www.semianalysis.com/feed", name: "SemiAnalysis" },
  { url: "https://simonwillison.net/atom/everything/", name: "Simon Willison" },
  // Company & research blogs
  { url: "https://paulgraham.com/rss.html", name: "Paul Graham" },
  { url: "https://openai.com/blog/rss.xml", name: "OpenAI Blog" },
  // Tech news RSS
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", name: "TechCrunch AI" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", name: "The Verge AI" },
];

const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt",
  "generative", "foundation model", "startup", "funding", "seed",
  "series a", "series b", "venture", "vc", "product manager", "hiring",
  "transformer", "diffusion", "agent", "autonomous", "copilot",
];

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some((kw) => lower.includes(kw));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchFeed(
  feedUrl: string,
  sourceName: string
): Promise<ScrapedItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StartupScanner/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`Blog feed failed for ${sourceName}: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });
    const items: ScrapedItem[] = [];

    // Handle both RSS <item> and Atom <entry>
    const entries = $("item").length > 0 ? $("item") : $("entry");

    entries.each((_, el) => {
      const title = $(el).find("title").first().text().trim();
      const link =
        $(el).find("link").first().text().trim() ||
        $(el).find("link").first().attr("href") ||
        "";
      const description =
        $(el).find("description").first().text().trim() ||
        $(el).find("summary").first().text().trim() ||
        $(el).find("content").first().text().trim() ||
        "";
      const pubDate =
        $(el).find("pubDate").first().text().trim() ||
        $(el).find("published").first().text().trim() ||
        $(el).find("updated").first().text().trim() ||
        "";

      const plainDesc = stripHtml(description);
      const fullText = `${title} ${plainDesc}`;

      // Only include AI/tech relevant posts
      if (!isRelevant(fullText)) return;

      items.push({
        title,
        url: link,
        source: sourceName,
        summary: plainDesc.substring(0, 300),
        publishedAt: pubDate ? new Date(pubDate) : new Date(),
        category: "blog",
      });
    });

    return items;
  } catch (err) {
    console.warn(`Blog feed error for ${sourceName}:`, err);
    return [];
  }
}

export async function scrapeBlogs(
  extraFeeds?: { url: string; name: string }[]
): Promise<ScrapedItem[]> {
  const feeds = [...DEFAULT_BLOG_FEEDS, ...(extraFeeds ?? [])];

  // Fetch all feeds in parallel (they're independent)
  const results = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.url, f.name))
  );

  const items: ScrapedItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    }
  }

  // Filter to last 7 days and sort newest first
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return items
    .filter((item) => item.publishedAt >= sevenDaysAgo)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
