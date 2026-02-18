import * as cheerio from "cheerio";
import { prisma } from "./db";
import { scrapeYCCompanies, type YCCompany } from "./scrapers/yc";
import { scrapeRSSFeed } from "./scrapers/rss";
import { scrapeHackerNews } from "./scrapers/hackernews";
import { scrapeBlogs } from "./scrapers/blogs";
import type { ScrapedItem } from "./scrapers/types";

// Category mapping for grouping
const CATEGORY_MAP: Record<string, string> = {
  "Developer Tools": "Developer Tools & Infra",
  Infrastructure: "Developer Tools & Infra",
  Fintech: "Fintech",
  "Consumer Finance": "Fintech",
  Healthcare: "Health Tech",
  "Health Tech": "Health Tech",
  "Supply Chain and Logistics": "Supply Chain & Logistics",
  Logistics: "Supply Chain & Logistics",
  SaaS: "SaaS & Enterprise",
  "Enterprise Software": "SaaS & Enterprise",
  Enterprise: "SaaS & Enterprise",
  Sales: "SaaS & Enterprise",
  "Real Estate and Construction": "Construction & Real Estate",
  Construction: "Construction & Real Estate",
  Education: "Education",
  Marketing: "Marketing & Growth",
  Advertising: "Marketing & Growth",
  Gaming: "Consumer & Gaming",
  Consumer: "Consumer & Gaming",
};

function categorize(company: YCCompany): string {
  const fields = [company.subindustry, company.industry, ...company.tags];
  for (const field of fields) {
    if (!field) continue;
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (field.includes(key)) return val;
    }
  }
  return "Other AI";
}

// Scrape founder info from YC company detail page
async function scrapeYCPage(slug: string): Promise<{
  founders: { name: string; bio: string; linkedIn: string }[];
  companyLinkedIn: string;
}> {
  try {
    const res = await fetch(`https://www.ycombinator.com/companies/${slug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Scrape company LinkedIn from social links on the page
    let companyLinkedIn = "";
    $("a[href*='linkedin.com/company']").each((_, el) => {
      if (!companyLinkedIn) companyLinkedIn = $(el).attr("href") || "";
    });

    const metaDesc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    const founderMatch = metaDesc.match(/Founded in\s+\d*\s*by (.+?),\s+\w+ has/);
    if (!founderMatch) return { founders: [], companyLinkedIn };

    const founderNames = founderMatch[1]
      .split(/,\s+and\s+|\s+and\s+|,\s+/)
      .map((n) => n.trim())
      .filter(Boolean);

    // Collect founder LinkedIn URLs keyed by anchor text / nearby name
    const founderLinkedIns: Record<string, string> = {};
    $("a[href*='linkedin.com/in/']").each((_, el) => {
      const href = $(el).attr("href") || "";
      // Walk up to find closest name text in the same founder card block
      const cardText = $(el).closest("div, section, li").text().trim();
      for (const name of founderNames) {
        if (cardText.includes(name) && !founderLinkedIns[name]) {
          founderLinkedIns[name] = href;
        }
      }
    });

    const bodyText = $("body").text();
    const foundersSection = bodyText.match(
      /Active Founders([\s\S]*?)(?:Company Launches|Jobs at|News|$)/
    );

    if (!foundersSection) {
      return {
        founders: founderNames.map((n) => ({ name: n, bio: "", linkedIn: founderLinkedIns[n] || "" })),
        companyLinkedIn,
      };
    }

    const block = foundersSection[1];
    const details: { name: string; bio: string; linkedIn: string }[] = [];

    for (const name of founderNames) {
      const idx = block.indexOf(name);
      if (idx < 0) {
        details.push({ name, bio: "", linkedIn: founderLinkedIns[name] || "" });
        continue;
      }
      let bio = block.substring(idx + name.length, idx + name.length + 500).trim();
      bio = bio.replace(/^(?:Co-)?Founder(?:\s*[&,]\s*\w+)*\s*/i, "");
      for (const other of founderNames) {
        if (other !== name) {
          const oi = bio.indexOf(other);
          if (oi > 0) bio = bio.substring(0, oi);
        }
      }
      bio = bio.trim().replace(/\s+/g, " ");
      if (bio.length > 150) bio = bio.substring(0, 150) + "...";
      details.push({ name, bio, linkedIn: founderLinkedIns[name] || "" });
    }

    return { founders: details, companyLinkedIn };
  } catch {
    return { founders: [], companyLinkedIn: "" };
  }
}

export interface EnrichedStartup {
  name: string;
  slug: string;
  website: string;
  ycUrl: string;
  batch: string;
  oneLiner: string;
  description: string;
  industry: string;
  category: string;
  teamSize: number;
  stage: string;
  founders: { name: string; bio: string; linkedIn: string }[];
  fundingInfo: string;
  companyLinkedIn: string;
}

// Full pipeline: scrape YC → enrich top N with founder details → save to DB
export async function runScrape(limit = 30): Promise<EnrichedStartup[]> {
  console.log("Scraping YC Algolia...");
  const companies = await scrapeYCCompanies({ hiringOnly: true });
  console.log(`Found ${companies.length} early-stage AI startups hiring.`);

  const top = companies.slice(0, limit);
  const enriched: EnrichedStartup[] = [];

  console.log(`Enriching top ${top.length} with founder data...`);
  for (const c of top) {
    const { founders, companyLinkedIn } = await scrapeYCPage(c.slug);

    const entry: EnrichedStartup = {
      name: c.name,
      slug: c.slug,
      website: c.website,
      ycUrl: c.ycUrl,
      batch: c.batch,
      oneLiner: c.oneLiner,
      description: c.longDescription.substring(0, 500),
      industry: c.subindustry || c.industry,
      category: categorize(c),
      teamSize: c.teamSize,
      stage: c.stage,
      founders,
      fundingInfo: "",
      companyLinkedIn,
    };
    enriched.push(entry);

    // Save to DB
    await prisma.startup.upsert({
      where: { id: c.slug },
      create: {
        id: c.slug,
        name: c.name,
        url: c.website,
        ycUrl: c.ycUrl,
        ycBatch: c.batch,
        industry: entry.category,
        summary: c.oneLiner,
        founders: JSON.stringify(founders),
        fundingStage: c.stage,
      },
      update: {
        name: c.name,
        url: c.website,
        summary: c.oneLiner,
        founders: JSON.stringify(founders),
        industry: entry.category,
      },
    });

    await new Promise((r) => setTimeout(r, 300));
  }

  return enriched;
}

// Full pipeline: scrape all enabled sources + YC → returns separated buckets
export async function runFullScrape(): Promise<{
  startups: EnrichedStartup[];
  blogPosts: ScrapedItem[];
  fundraisingNews: ScrapedItem[];
  hiringNews: ScrapedItem[];
}> {
  // Load enabled sources and keywords from DB
  const [sources, keywordRecords] = await Promise.all([
    prisma.source.findMany({ where: { enabled: true } }),
    prisma.keyword.findMany({ where: { enabled: true } }),
  ]);

  const keywords = keywordRecords.map((k) => k.term);
  const allItems: ScrapedItem[] = [];

  // Run YC scrape (always)
  const startups = await runScrape(30);

  // Run other scrapers in parallel
  const scraperPromises: Promise<ScrapedItem[]>[] = [];

  // Blog/Substack/Medium scraper (replaces X/Twitter)
  scraperPromises.push(scrapeBlogs());

  for (const source of sources) {
    if (source.type === "rss") {
      scraperPromises.push(scrapeRSSFeed(source.url, source.name, keywords));
    } else if (source.type === "api" && source.name === "Hacker News") {
      scraperPromises.push(scrapeHackerNews(keywords));
    }
    // YC Algolia is handled by runScrape above
  }

  const results = await Promise.allSettled(scraperPromises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      console.error("Scraper failed:", result.reason);
    }
  }

  // Filter to last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentItems = allItems.filter((item) => item.publishedAt >= sevenDaysAgo);

  // Sort by date (newest first)
  recentItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  // Separate into buckets
  const blogPosts = recentItems.filter((i) => i.category === "blog" || i.category === "trend");
  const fundraisingNews = recentItems.filter((i) => i.category === "fundraising");
  const hiringNews = recentItems.filter((i) => i.category === "hiring");

  console.log(
    `Full scrape: ${startups.length} startups, ${blogPosts.length} blog posts, ` +
    `${fundraisingNews.length} fundraising, ${hiringNews.length} hiring`
  );
  return { startups, blogPosts, fundraisingNews, hiringNews };
}
