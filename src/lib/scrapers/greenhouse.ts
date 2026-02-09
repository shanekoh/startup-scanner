export interface GreenhouseJob {
  title: string;
  company: string;
  url: string;
  source: "greenhouse" | "lever";
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

// Greenhouse exposes a public JSON API for job boards
export async function scrapeGreenhouseJobs(
  companies: { name: string; slug: string }[]
): Promise<GreenhouseJob[]> {
  const jobs: GreenhouseJob[] = [];

  for (const { name, slug } of companies) {
    // Try Greenhouse first
    try {
      const ghRes = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (ghRes.ok) {
        const data = (await ghRes.json()) as { jobs: { title: string; absolute_url: string }[] };
        for (const job of data.jobs) {
          if (isPMRole(job.title)) {
            jobs.push({
              title: job.title,
              company: name,
              url: job.absolute_url,
              source: "greenhouse",
            });
          }
        }
        continue;
      }
    } catch {
      // Not on Greenhouse
    }

    // Try Lever
    try {
      const leverRes = await fetch(`https://api.lever.co/v0/postings/${slug}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (leverRes.ok) {
        const data = (await leverRes.json()) as { text: string; hostedUrl: string }[];
        for (const job of data) {
          if (isPMRole(job.text)) {
            jobs.push({
              title: job.text,
              company: name,
              url: job.hostedUrl,
              source: "lever",
            });
          }
        }
      }
    } catch {
      // Not on Lever either
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return jobs;
}

function isPMRole(title: string): boolean {
  const lower = title.toLowerCase();
  return PM_KEYWORDS.some((kw) => lower.includes(kw));
}
