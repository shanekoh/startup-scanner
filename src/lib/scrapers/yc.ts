const ALGOLIA_APP_ID = "45BWZJ1SGC";
const ALGOLIA_API_KEY =
  "ZjA3NWMwMmNhMzEwZmMxOThkZDlkMjFmNDAwNTNjNjdkZjdhNWJkOWRjMThiODQwMjUyZTVkYjA4YjFlMmU2YnJlc3RyaWN0SW5kaWNlcz0lNUIlMjJZQ0NvbXBhbnlfcHJvZHVjdGlvbiUyMiUyQyUyMllDQ29tcGFueV9CeV9MYXVuY2hfRGF0ZV9wcm9kdWN0aW9uJTIyJTVEJnRhZ0ZpbHRlcnM9JTVCJTIyeWNkY19wdWJsaWMlMjIlNUQmYW5hbHl0aWNzVGFncz0lNUIlMjJ5Y2RjJTIyJTVE";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/YCCompany_production/query`;

export interface YCCompany {
  name: string;
  slug: string;
  website: string;
  ycUrl: string;
  batch: string;
  oneLiner: string;
  longDescription: string;
  industry: string;
  subindustry: string;
  tags: string[];
  teamSize: number;
  isHiring: boolean;
  stage: string;
  status: string;
}

interface AlgoliaHit {
  name: string;
  slug: string;
  website: string;
  batch: string;
  one_liner: string;
  long_description: string;
  industry: string;
  subindustry: string;
  tags: string[];
  team_size: number;
  isHiring: boolean;
  stage: string;
  status: string;
}

export async function scrapeYCCompanies(options?: {
  hitsPerPage?: number;
  aiOnly?: boolean;
  hiringOnly?: boolean;
}): Promise<YCCompany[]> {
  const { hitsPerPage = 100, aiOnly = true, hiringOnly = false } = options || {};
  const allCompanies: YCCompany[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const facetFilters: string[][] = [];
    if (aiOnly) facetFilters.push(["tags:Artificial Intelligence"]);

    const body = JSON.stringify({
      query: "",
      facetFilters,
      hitsPerPage,
      page,
    });

    const res = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-API-Key": ALGOLIA_API_KEY,
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
      },
      body,
    });

    if (!res.ok) throw new Error(`Algolia returned ${res.status}`);

    const data = (await res.json()) as {
      hits: AlgoliaHit[];
      nbPages: number;
      nbHits: number;
    };

    totalPages = data.nbPages;

    for (const hit of data.hits) {
      // Filter for early-stage (seed/early)
      const isEarlyStage =
        hit.stage === "Early" || hit.stage === "Seed" || hit.stage === "Series A";
      if (!isEarlyStage) continue;

      // Skip acquired/dead companies
      if (hit.status === "Acquired" || hit.status === "Inactive") continue;

      if (hiringOnly && !hit.isHiring) continue;

      allCompanies.push({
        name: hit.name,
        slug: hit.slug,
        website: hit.website || "",
        ycUrl: `https://www.ycombinator.com/companies/${hit.slug}`,
        batch: hit.batch,
        oneLiner: hit.one_liner || "",
        longDescription: hit.long_description || "",
        industry: hit.subindustry || hit.industry || "AI",
        subindustry: hit.subindustry || "",
        tags: hit.tags || [],
        teamSize: hit.team_size || 0,
        isHiring: hit.isHiring,
        stage: hit.stage,
        status: hit.status,
      });
    }

    page++;
    // Small delay between pages
    await new Promise((r) => setTimeout(r, 200));
  }

  return allCompanies;
}
