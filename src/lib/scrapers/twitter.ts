import * as cheerio from "cheerio";
import type { ScrapedItem } from "./types";

// Curated default accounts — editable via dashboard (Source records with type="twitter")
export const DEFAULT_X_ACCOUNTS = [
  "sama", "pmarca", "garrytan", "elonmusk", "satikirant",
  "emaborevkova", "benedictevans", "pacaborevkova", "levelsio",
  "paulg", "jason", "aaborevkova", "naval", "ycombinator", "OpenAI",
];

// Nitter instances to try — public instances are unreliable since X removed
// guest accounts. Update this list as instances come and go.
// Check https://status.d420.de/ or https://github.com/zedeus/nitter/wiki/Instances
const NITTER_INSTANCES = [
  "nitter.privacyredirect.com",
  "xcancel.com",
  "nitter.net",
  "nitter.poast.org",
  "nitter.catsarch.com",
];

async function fetchNitterRSS(
  handle: string
): Promise<{ xml: string; instance: string } | null> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${handle}/rss`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StartupScanner/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const xml = await res.text();
        // Sanity check: must contain RSS-like content
        if (xml.includes("<item>") || xml.includes("<entry>")) {
          return { xml, instance };
        }
      }
    } catch {
      // Instance down or timed out, try next
    }
  }
  return null;
}

export async function scrapeTwitter(
  accounts: string[]
): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const handle of accounts) {
    const username = handle.replace(/^@/, "");

    try {
      const result = await fetchNitterRSS(username);
      if (!result) {
        console.warn(`Nitter RSS: no working instance for @${username}`);
        continue;
      }

      const $ = cheerio.load(result.xml, { xml: true });

      $("item").each((_, el) => {
        const title = $(el).find("title").first().text().trim();
        const link = $(el).find("link").first().text().trim();
        const description = $(el).find("description").first().text().trim();
        const pubDate = $(el).find("pubDate").first().text().trim();

        const publishedAt = pubDate ? new Date(pubDate) : new Date();
        if (publishedAt < sevenDaysAgo) return;

        // Strip HTML from description for plain text summary
        const plainText = description
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        // Nitter links point to the nitter instance; convert to x.com
        const xUrl = link
          ? link.replace(
              /https?:\/\/[^/]+\//,
              "https://x.com/"
            )
          : `https://x.com/${username}`;

        items.push({
          title: `@${username}: ${plainText.substring(0, 120)}${plainText.length > 120 ? "..." : ""}`,
          url: xUrl,
          source: `X/@${username}`,
          summary: plainText.substring(0, 300),
          publishedAt,
          category: "xpost",
        });
      });

      // Be polite between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`Nitter scraper error for @${username}:`, err);
    }
  }

  return items;
}
