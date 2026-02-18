#!/usr/bin/env node
// Daily newsletter generation script
// Scrapes data → generates HTML via Claude CLI → saves and sends email
// Designed to be run by Windows Task Scheduler or cron

import { request as httpRequest } from "node:http";
import { spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const EMAIL = "ksx1991@gmail.com";

function httpPost(url, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = body ? JSON.stringify(body) : "";
    const req = httpRequest(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
        },
        timeout: 120000,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch { reject(new Error(`Invalid JSON: ${d.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("HTTP timeout")); });
    if (postData) req.write(postData);
    req.end();
  });
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "-", "--output-format", "json", "--dangerously-skip-permissions"];
    const childEnv = { ...process.env };
    delete childEnv.CLAUDECODE;
    delete childEnv.CLAUDE_CODE_SESSION;

    const cmd = ["claude", ...args].join(" ");
    const proc = spawn("bash", ["-c", cmd], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Claude timed out (10 min)"));
    }, 10 * 60 * 1000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        reject(new Error(`Claude exit ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json.result || json.text || stdout.slice(0, 8000));
      } catch {
        resolve(stdout.slice(0, 8000));
      }
    });
  });
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting daily newsletter generation...`);

  // Step 1: Scrape
  console.log("Scraping...");
  const scrapeResult = await httpPost(`${BASE}/api/newsletter/scrape`);
  if (!scrapeResult.success) {
    throw new Error(`Scrape failed: ${scrapeResult.error}`);
  }

  const { stats, data } = scrapeResult;
  console.log(`Scraped: ${stats.blogPosts} blogs, ${stats.fundraising} fundraising, ${stats.startups} startups`);

  // Step 2: Generate HTML via Claude
  const blogText = (data.blogPosts || [])
    .map((i) => `- [${i.source}] ${i.title}: ${i.summary} (${i.url})`)
    .join("\n");
  const fundText = (data.fundraising || [])
    .map((i) => `- [${i.source}] ${i.title}: ${i.summary} (${i.url})`)
    .join("\n");
  const startupText = (data.startups || [])
    .map((s) => {
      const links = [s.website, s.companyLinkedIn].filter(Boolean).join(" | ");
      const founderLIs = (s.founders || [])
        .filter((f) => f.linkedIn)
        .map((f) => `${f.name}: ${f.linkedIn}`)
        .join(", ");
      return `- ${s.name} (${s.stage}, ${s.teamSize} people): ${s.oneLiner}. ${links}${founderLIs ? ` | Founders: ${founderLIs}` : ""}`;
    })
    .join("\n");

  const prompt = `You are generating a weekly AI newsletter. Output ONLY the raw inner HTML content. No explanation, no markdown fences, no \`\`\`, no <html>/<head>/<body> tags. Just the HTML div content.

DATA:

## Blog Posts:
${blogText || "None"}

## Fundraising:
${fundText || "None"}

## Startups Hiring:
${startupText || "None"}

Write exactly 3 sections:
1. Hot AI Trends & Insights — 3-5 trend bullets synthesized from blog posts. Use <a> links.
2. Startup Fundraise & M&A — 3-5 notable deals with amounts.
3. AI Startups Hiring PMs — 3-5 companies, stage, what they do, why a PM should care. Include LinkedIn links for the company and founders where available.

Use inline CSS: colored left borders, rounded cards, bold headers with emoji. Keep under 4000 chars of HTML. Output starts with <div and ends with </div>.`;

  console.log("Generating newsletter with Claude...");
  let htmlContent = await runClaude(prompt);

  // Clean up
  htmlContent = htmlContent
    .replace(/^[\s\S]*?(<div)/i, "$1")
    .replace(/(<\/div>)\s*[\s\S]*?$/i, "$1")
    .trim();

  if (!htmlContent || htmlContent.length < 50) {
    throw new Error("Claude returned empty or too-short content");
  }

  // Step 3: Save and send
  console.log("Saving and sending...");
  const saveResult = await httpPost(`${BASE}/api/newsletter/save`, {
    content: htmlContent,
    email: EMAIL,
    stats: {
      blogPosts: stats.blogPosts,
      deals: stats.fundraising,
      hiring: stats.hiring + stats.startups,
    },
  });

  if (!saveResult.success) {
    throw new Error(`Save failed: ${saveResult.error}`);
  }

  console.log(`Newsletter sent to ${EMAIL}`);
  console.log(`Subject: ${saveResult.subject}`);
  console.log(`ID: ${saveResult.id}`);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] Newsletter generation failed:`, err.message);
  process.exit(1);
});
