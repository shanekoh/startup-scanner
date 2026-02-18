import { ScrapedItem, categorizeItem, matchesKeywords } from "./types";

interface HNHit {
  title: string;
  url: string | null;
  story_url?: string | null;
  objectID: string;
  points: number | null;
  created_at: string;
}

export async function scrapeHackerNews(
  keywords: string[]
): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];

  // Search last 24 hours with AI/startup related terms
  const searchTerms = ["AI startup", "fundraising AI", "seed round AI", "Series A AI"];

  for (const query of searchTerms) {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 86400 * 7;

    const params = new URLSearchParams({
      query,
      tags: "story",
      numericFilters: `created_at_i>${sevenDaysAgo}`,
      hitsPerPage: "20",
    });

    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?${params}`
      );

      if (!res.ok) continue;

      const data = (await res.json()) as { hits: HNHit[] };

      for (const hit of data.hits) {
        const title = hit.title || "";
        const url = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

        if (!matchesKeywords(title, keywords)) continue;

        // Deduplicate by URL
        if (items.some((i) => i.url === url)) continue;

        items.push({
          title,
          url,
          source: "Hacker News",
          summary: title,
          publishedAt: new Date(hit.created_at),
          category: categorizeItem(title),
        });
      }
    } catch (err) {
      console.error(`HN search failed for "${query}":`, err);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return items;
}
