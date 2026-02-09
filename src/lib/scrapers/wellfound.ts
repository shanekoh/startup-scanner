import * as cheerio from "cheerio";

export interface WellfoundJob {
  title: string;
  company: string;
  url: string;
  source: "wellfound";
}

const PM_KEYWORDS = [
  "product manager",
  "founding pm",
  "head of product",
  "product lead",
  "chief product",
  "vp product",
  "director of product",
];

// Search Wellfound for product roles at AI startups
export async function scrapeWellfoundJobs(
  companyNames: string[]
): Promise<WellfoundJob[]> {
  const jobs: WellfoundJob[] = [];

  for (const name of companyNames) {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const url = `https://wellfound.com/company/${slug}/jobs`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $("a[href*='/jobs/'], div[class*='job-listing']").each((_, el) => {
        const title = $(el).find("h3, .job-title, span").first().text().trim();
        const href = $(el).attr("href") || "";
        const jobUrl = href.startsWith("http")
          ? href
          : `https://wellfound.com${href}`;

        if (isPMRole(title)) {
          jobs.push({ title, company: name, url: jobUrl, source: "wellfound" });
        }
      });
    } catch {
      // Skip companies we can't find
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return jobs;
}

function isPMRole(title: string): boolean {
  const lower = title.toLowerCase();
  return PM_KEYWORDS.some((kw) => lower.includes(kw));
}
