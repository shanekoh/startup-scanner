import * as cheerio from "cheerio";
import { ScrapedItem, categorizeItem, matchesKeywords } from "./types";

export async function scrapeRSSFeed(
  feedUrl: string,
  sourceName: string,
  keywords: string[]
): Promise<ScrapedItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StartupScanner/1.0)",
    },
  });

  if (!res.ok) {
    console.error(`RSS fetch failed for ${sourceName}: ${res.status}`);
    return [];
  }

  const xml = await res.text();
  const $ = cheerio.load(xml, { xml: true });
  const items: ScrapedItem[] = [];

  // Handle both RSS <item> and Atom <entry>
  const entries = $("item").length > 0 ? $("item") : $("entry");

  entries.each((_, el) => {
    const title =
      $(el).find("title").first().text().trim() || "";
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

    const fullText = `${title} ${description}`;

    if (!matchesKeywords(fullText, keywords)) return;

    items.push({
      title,
      url: link,
      source: sourceName,
      summary: stripHtml(description).substring(0, 300),
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      category: categorizeItem(fullText),
    });
  });

  // Filter to last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return items.filter((item) => item.publishedAt >= sevenDaysAgo);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
