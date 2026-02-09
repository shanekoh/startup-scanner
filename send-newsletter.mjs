import "dotenv/config";
import { Resend } from "resend";
import * as cheerio from "cheerio";

const ALGOLIA_APP_ID = "45BWZJ1SGC";
const ALGOLIA_API_KEY =
  "ZjA3NWMwMmNhMzEwZmMxOThkZDlkMjFmNDAwNTNjNjdkZjdhNWJkOWRjMThiODQwMjUyZTVkYjA4YjFlMmU2YnJlc3RyaWN0SW5kaWNlcz0lNUIlMjJZQ0NvbXBhbnlfcHJvZHVjdGlvbiUyMiUyQyUyMllDQ29tcGFueV9CeV9MYXVuY2hfRGF0ZV9wcm9kdWN0aW9uJTIyJTVEJnRhZ0ZpbHRlcnM9JTVCJTIyeWNkY19wdWJsaWMlMjIlNUQmYW5hbHl0aWNzVGFncz0lNUIlMjJ5Y2RjJTIyJTVE";

const resend = new Resend(process.env.RESEND_API_KEY);

// --- Step 1: Fetch all hiring AI startups from Algolia ---
async function fetchAllHiringAIStartups() {
  const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/YCCompany_production/query`;
  let page = 0;
  let totalPages = 1;
  const results = [];

  while (page < totalPages) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-API-Key": ALGOLIA_API_KEY,
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
      },
      body: JSON.stringify({
        query: "",
        facetFilters: [["tags:Artificial Intelligence"]],
        hitsPerPage: 100,
        page,
      }),
    });
    const data = await res.json();
    if (page === 0) totalPages = data.nbPages;

    for (const h of data.hits) {
      const isEarly = h.stage === "Early" || h.stage === "Seed";
      const isActive = h.status !== "Acquired" && h.status !== "Inactive";
      if (isEarly && isActive && h.isHiring) results.push(h);
    }
    page++;
    await new Promise((r) => setTimeout(r, 200));
  }

  const batchOrder = (b) => {
    const m = b.match(/(Winter|Summer|Fall|Spring)\s+(\d+)/);
    if (!m) return 0;
    return parseInt(m[2]) * 10 + ({ Winter: 0, Spring: 1, Summer: 2, Fall: 3 }[m[1]] || 0);
  };
  results.sort((a, b) => batchOrder(b.batch) - batchOrder(a.batch));
  return results;
}

// --- Step 2: Scrape YC company page for founders + funding ---
async function scrapeCompanyDetail(slug) {
  try {
    const res = await fetch(`https://www.ycombinator.com/companies/${slug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const metaDesc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") || "";

    // Extract founder names from meta: "Founded in XXXX by Name1 and Name2, Company has..."
    // Handle edge case where year is missing: "Founded in  by Name1 and Name2"
    const founderMatch = metaDesc.match(/Founded in\s+\d*\s*by (.+?),\s+\w+ has/);
    let founderNames = [];
    if (founderMatch) {
      founderNames = founderMatch[1]
        .split(/,\s+and\s+|\s+and\s+|,\s+/)
        .map((n) => n.trim())
        .filter(Boolean);
    }

    // Parse body for "Active Founders" section bios
    const bodyText = $("body").text();
    const foundersSection = bodyText.match(/Active Founders([\s\S]*?)(?:Company Launches|Jobs at|News|$)/);

    let founderDetails = [];
    if (foundersSection && founderNames.length) {
      const block = foundersSection[1];
      for (const name of founderNames) {
        const nameIdx = block.indexOf(name);
        if (nameIdx >= 0) {
          const afterName = block.substring(nameIdx + name.length, nameIdx + name.length + 500).trim();
          // Bio starts after "Founder" or "Co-Founder..." title, take first meaningful sentence
          // Remove the duplicated name block by stopping at the next founder name or section
          let bio = afterName;
          // Remove leading role prefix like "FounderBuilding..." or "Co-Founder & CEOManaged..."
          bio = bio.replace(/^(?:Co-)?Founder(?:\s*[&,]\s*\w+)*\s*/i, "");
          // Stop at next founder's name to avoid duplication
          for (const otherName of founderNames) {
            if (otherName !== name) {
              const otherIdx = bio.indexOf(otherName);
              if (otherIdx > 0) bio = bio.substring(0, otherIdx);
            }
          }
          // Clean up and truncate
          bio = bio.trim().replace(/\s+/g, " ");
          if (bio.length > 150) bio = bio.substring(0, 150) + "...";
          founderDetails.push({ name, bio });
        }
      }
    }
    if (founderDetails.length === 0) {
      founderDetails = founderNames.map((n) => ({ name: n, bio: "" }));
    }

    // Look for funding amounts in body or description
    const allText = metaDesc + " " + bodyText;
    const fundingPatterns = [
      /raised\s+\$[\d.,]+[MmBbKk]?/i,
      /\$[\d.,]+[MmBb]\s+(?:seed|series|round|funding|raised)/i,
    ];
    let fundingInfo = "";
    for (const pat of fundingPatterns) {
      const match = allText.match(pat);
      if (match) {
        fundingInfo = match[0];
        break;
      }
    }

    return { founderDetails, fundingInfo };
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
    return { founderDetails: [], fundingInfo: "" };
  }
}

// --- Category mapping ---
const CATEGORY_MAP = {
  "Developer Tools": { label: "Developer Tools & Infra", color: "#0891b2", bg: "#ecfeff" },
  "Infrastructure": { label: "Developer Tools & Infra", color: "#0891b2", bg: "#ecfeff" },
  "Fintech": { label: "Fintech", color: "#d97706", bg: "#fffbeb" },
  "Consumer Finance": { label: "Fintech", color: "#d97706", bg: "#fffbeb" },
  "Healthcare": { label: "Health Tech", color: "#059669", bg: "#ecfdf5" },
  "Health Tech": { label: "Health Tech", color: "#059669", bg: "#ecfdf5" },
  "Supply Chain and Logistics": { label: "Supply Chain & Logistics", color: "#7c3aed", bg: "#f5f3ff" },
  "Logistics": { label: "Supply Chain & Logistics", color: "#7c3aed", bg: "#f5f3ff" },
  "SaaS": { label: "SaaS & Enterprise", color: "#2563eb", bg: "#eff6ff" },
  "Enterprise Software": { label: "SaaS & Enterprise", color: "#2563eb", bg: "#eff6ff" },
  "Enterprise": { label: "SaaS & Enterprise", color: "#2563eb", bg: "#eff6ff" },
  "Sales": { label: "SaaS & Enterprise", color: "#2563eb", bg: "#eff6ff" },
  "Real Estate and Construction": { label: "Construction & Real Estate", color: "#ea580c", bg: "#fff7ed" },
  "Construction": { label: "Construction & Real Estate", color: "#ea580c", bg: "#fff7ed" },
  "Education": { label: "Education", color: "#0d9488", bg: "#f0fdfa" },
  "Marketing": { label: "Marketing & Growth", color: "#db2777", bg: "#fdf2f8" },
  "Advertising": { label: "Marketing & Growth", color: "#db2777", bg: "#fdf2f8" },
  "Gaming": { label: "Consumer & Gaming", color: "#e11d48", bg: "#fff1f2" },
  "Consumer": { label: "Consumer & Gaming", color: "#e11d48", bg: "#fff1f2" },
};

function categorize(startup) {
  // Check subindustry, industry, then tags for a match
  const fields = [startup.subindustry, startup.industry, ...(startup.tags || [])];
  for (const field of fields) {
    if (!field) continue;
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (field.includes(key)) return val.label;
    }
  }
  return "Other AI";
}

// --- Step 3: Build HTML newsletter (grouped by category) ---
function buildCard(s, idx) {
  const founderHtml = s._founders?.length
    ? s._founders
        .map((f) => {
          const bio = f.bio ? `<span style="color:#64748b;"> — ${f.bio}</span>` : "";
          return `<div style="margin:3px 0;font-size:12px;color:#334155;line-height:1.4;"><strong>${f.name}</strong>${bio}</div>`;
        })
        .join("")
    : `<div style="font-size:12px;color:#94a3b8;">Founder info not available</div>`;

  const fundingBadge = s._fundingInfo
    ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-left:4px;">${s._fundingInfo}</span>`
    : "";

  return `
    <tr><td style="padding:0 0 14px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
        <tr><td style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><a href="https://www.ycombinator.com/companies/${s.slug}" style="color:#1e40af;text-decoration:none;font-size:16px;font-weight:700;">${idx}. ${s.name}</a></td>
              <td align="right" style="font-size:12px;color:#64748b;">${s.batch}</td>
            </tr>
          </table>
          <div style="margin:6px 0 8px;">
            <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;">${s.stage} · ${s.team_size} people</span>
            <span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-left:4px;">Hiring</span>
            ${fundingBadge}
          </div>
          <p style="color:#0f172a;font-size:14px;font-weight:600;margin:0 0 4px;">${s.one_liner || ""}</p>
          <p style="color:#475569;font-size:13px;line-height:1.5;margin:0 0 12px;">${(s.long_description || "").substring(0, 250)}${(s.long_description || "").length > 250 ? "..." : ""}</p>
          <div style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;padding:10px 12px;margin:0 0 8px;">
            <p style="font-size:11px;font-weight:700;color:#1e293b;margin:0 0 5px;text-transform:uppercase;letter-spacing:0.5px;">Founders</p>
            ${founderHtml}
          </div>
          ${s.website ? `<a href="${s.website}" style="color:#2563eb;font-size:12px;text-decoration:none;">Visit website &rarr;</a>` : ""}
        </td></tr>
      </table>
    </td></tr>`;
}

function buildHtml(startups) {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Group by category
  const groups = {};
  for (const s of startups) {
    const cat = categorize(s);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  // Sort categories by count descending
  const sortedCats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  // Build table of contents
  const toc = sortedCats
    .map(([cat, items]) => `<span style="display:inline-block;margin:2px 4px;font-size:12px;color:#4338ca;">${cat} (${items.length})</span>`)
    .join(" &middot; ");

  // Build grouped cards
  let idx = 1;
  const sections = sortedCats
    .map(([cat, items]) => {
      const catMeta = Object.values(CATEGORY_MAP).find((v) => v.label === cat) || { color: "#475569", bg: "#f8fafc" };
      const cards = items.map((s) => buildCard(s, idx++)).join("");
      return `
      <tr><td style="padding:20px 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-bottom:2px solid ${catMeta.color};padding-bottom:6px;">
              <span style="font-size:16px;font-weight:700;color:${catMeta.color};">${cat}</span>
              <span style="font-size:12px;color:#94a3b8;margin-left:8px;">${items.length} startup${items.length > 1 ? "s" : ""}</span>
            </td>
          </tr>
        </table>
      </td></tr>
      ${cards}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1e3a8a,#7c3aed);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:-0.5px;">Startup Scanner</h1>
        <p style="color:#c7d2fe;font-size:14px;margin:8px 0 0;">AI Startups · Seed & Early Stage · Actively Hiring</p>
      </td></tr>
      <!-- Stats -->
      <tr><td style="background:#eef2ff;padding:14px 24px;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#4338ca;"><strong>${startups.length}</strong> startups</td>
          <td align="center" style="font-size:13px;color:#4338ca;">Source: YC Directory</td>
          <td align="right" style="font-size:13px;color:#4338ca;">${today}</td>
        </tr></table>
      </td></tr>
      <!-- TOC -->
      <tr><td style="background:#fff;padding:16px 24px 0;text-align:center;">
        <p style="font-size:11px;font-weight:600;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Categories</p>
        ${toc}
      </td></tr>
      <!-- Grouped Cards -->
      <tr><td style="background:#fff;padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">${sections}</table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 24px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Generated by Startup Scanner &middot; Data from YC Algolia API</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// --- Main ---
async function main() {
  console.log("Step 1: Fetching early-stage AI startups hiring from YC...");
  const startups = await fetchAllHiringAIStartups();
  console.log(`Found ${startups.length} startups.\n`);

  const top30 = startups.slice(0, 30);
  console.log("Step 2: Enriching top 30 with founder bios + funding...");
  for (const [i, s] of top30.entries()) {
    process.stdout.write(`  [${i + 1}/30] ${s.name}...`);
    const detail = await scrapeCompanyDetail(s.slug);
    s._founders = detail.founderDetails;
    s._fundingInfo = detail.fundingInfo;
    const fCount = detail.founderDetails.length;
    const fNames = detail.founderDetails.map((f) => f.name).join(", ");
    console.log(` ${fCount} founder${fCount !== 1 ? "s" : ""}${fNames ? ` (${fNames})` : ""}${detail.fundingInfo ? ` | ${detail.fundingInfo}` : ""}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\nStep 3: Generating newsletter...");
  const html = buildHtml(top30);
  const subject = `Startup Scanner: Top 30 AI Startups Hiring — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const recipient = process.env.NEWSLETTER_TO || "your-email@example.com";
  console.log(`Step 4: Sending to ${recipient}...`);
  const { data, error } = await resend.emails.send({
    from: "Startup Scanner <onboarding@resend.dev>",
    to: recipient,
    subject,
    html,
  });

  if (error) console.error("Failed:", error);
  else console.log("Sent!", data);
}

main().catch(console.error);
