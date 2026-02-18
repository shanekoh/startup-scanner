import type { EnrichedStartup } from "./scraper";
import type { ScrapedItem } from "./scrapers/types";

function buildCard(s: EnrichedStartup, idx: number): string {
  const founderHtml = s.founders.length
    ? s.founders
        .map((f) => {
          const bio = f.bio ? `<span style="color:#64748b;"> — ${f.bio}</span>` : "";
          const linkedInLink = f.linkedIn
            ? ` <a href="${f.linkedIn}" style="color:#0077b5;font-size:11px;text-decoration:none;margin-left:6px;">LinkedIn &rarr;</a>`
            : "";
          return `<div style="margin:3px 0;font-size:12px;color:#334155;line-height:1.4;"><strong>${f.name}</strong>${bio}${linkedInLink}</div>`;
        })
        .join("")
    : `<div style="font-size:12px;color:#94a3b8;">Founder info not available</div>`;

  const fundingBadge = s.fundingInfo
    ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-left:4px;">${s.fundingInfo}</span>`
    : "";

  const companyLinkedIn = s.companyLinkedIn
    ? `<a href="${s.companyLinkedIn}" style="color:#0077b5;font-size:12px;text-decoration:none;margin-left:12px;">Company LinkedIn &rarr;</a>`
    : "";

  return `
    <tr><td style="padding:0 0 14px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
        <tr><td style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><a href="${s.ycUrl}" style="color:#1e40af;text-decoration:none;font-size:16px;font-weight:700;">${idx}. ${s.name}</a></td>
              <td align="right" style="font-size:12px;color:#64748b;">${s.batch}</td>
            </tr>
          </table>
          <div style="margin:6px 0 8px;">
            <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;">${s.industry || "AI"}</span>
            <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-left:4px;">${s.stage} · ${s.teamSize} people</span>
            <span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-left:4px;">Hiring</span>
            ${fundingBadge}
          </div>
          <p style="color:#0f172a;font-size:14px;font-weight:600;margin:0 0 4px;">${s.oneLiner}</p>
          <p style="color:#475569;font-size:13px;line-height:1.5;margin:0 0 12px;">${s.description.substring(0, 250)}${s.description.length > 250 ? "..." : ""}</p>
          <div style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;padding:10px 12px;margin:0 0 8px;">
            <p style="font-size:11px;font-weight:700;color:#1e293b;margin:0 0 5px;text-transform:uppercase;letter-spacing:0.5px;">Founders</p>
            ${founderHtml}
          </div>
          ${s.website ? `<a href="${s.website}" style="color:#2563eb;font-size:12px;text-decoration:none;">Visit website &rarr;</a>` : ""}${companyLinkedIn}
        </td></tr>
      </table>
    </td></tr>`;
}

const CAT_COLORS: Record<string, { color: string }> = {
  "Developer Tools & Infra": { color: "#0891b2" },
  Fintech: { color: "#d97706" },
  "Health Tech": { color: "#059669" },
  "Supply Chain & Logistics": { color: "#7c3aed" },
  "SaaS & Enterprise": { color: "#2563eb" },
  "Construction & Real Estate": { color: "#ea580c" },
  Education: { color: "#0d9488" },
  "Marketing & Growth": { color: "#db2777" },
  "Consumer & Gaming": { color: "#e11d48" },
  "Other AI": { color: "#475569" },
};

export function generateTemplateNewsletter(startups: EnrichedStartup[]): {
  subject: string;
  html: string;
} {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Group by category
  const groups: Record<string, EnrichedStartup[]> = {};
  for (const s of startups) {
    const cat = s.category || "Other AI";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  const sortedCats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  const toc = sortedCats
    .map(
      ([cat, items]) =>
        `<span style="display:inline-block;margin:2px 4px;font-size:12px;color:#4338ca;">${cat} (${items.length})</span>`
    )
    .join(" &middot; ");

  let idx = 1;
  const sections = sortedCats
    .map(([cat, items]) => {
      const catColor = CAT_COLORS[cat]?.color || "#475569";
      const cards = items.map((s) => buildCard(s, idx++)).join("");
      return `
      <tr><td style="padding:20px 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-bottom:2px solid ${catColor};padding-bottom:6px;">
            <span style="font-size:16px;font-weight:700;color:${catColor};">${cat}</span>
            <span style="font-size:12px;color:#94a3b8;margin-left:8px;">${items.length} startup${items.length > 1 ? "s" : ""}</span>
          </td></tr>
        </table>
      </td></tr>
      ${cards}`;
    })
    .join("");

  const subject = `Startup Scanner: ${startups.length} AI Startups Hiring — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#1e3a8a,#7c3aed);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:-0.5px;">Startup Scanner</h1>
        <p style="color:#c7d2fe;font-size:14px;margin:8px 0 0;">AI Startups · Seed & Early Stage · Actively Hiring</p>
      </td></tr>
      <tr><td style="background:#eef2ff;padding:14px 24px;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#4338ca;"><strong>${startups.length}</strong> startups</td>
          <td align="center" style="font-size:13px;color:#4338ca;">Source: YC Directory</td>
          <td align="right" style="font-size:13px;color:#4338ca;">${today}</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#fff;padding:16px 24px 0;text-align:center;">
        <p style="font-size:11px;font-weight:600;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Categories</p>
        ${toc}
      </td></tr>
      <tr><td style="background:#fff;padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">${sections}</table>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 24px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Generated by Startup Scanner &middot; Data from YC Algolia API</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}

// Wraps AI-generated inner HTML content in the email template shell
export function wrapInEmailShell(
  aiContent: string,
  stats: { blogPosts: number; deals: number; hiring: number }
): { subject: string; html: string } {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `AI PM Weekly: Trends, Deals & Jobs — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#1e3a8a,#7c3aed);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:-0.5px;">Startup Scanner</h1>
        <p style="color:#c7d2fe;font-size:14px;margin:8px 0 0;">Weekly AI Intel &middot; Trends &middot; Deals &middot; PM Jobs</p>
      </td></tr>
      <tr><td style="background:#eef2ff;padding:14px 24px;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#4338ca;"><strong>${stats.blogPosts}</strong> articles &middot; <strong>${stats.deals}</strong> deals &middot; <strong>${stats.hiring}</strong> hiring signals</td>
          <td align="right" style="font-size:13px;color:#4338ca;">${today}</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#fff;padding:24px;">
        ${aiContent}
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 24px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Generated by Startup Scanner &middot; AI-powered by Claude &middot; Past 7 days</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}

// Default export: template-only (no LLM required)
export function generateNewsletter(startups: EnrichedStartup[]): {
  subject: string;
  html: string;
} {
  return generateTemplateNewsletter(startups);
}
