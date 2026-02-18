"use client";

import { useState, useEffect, useCallback } from "react";

interface NewsletterSummary {
  id: string;
  subject: string;
  sentAt: string | null;
  createdAt: string;
}

interface Source {
  id: string;
  type: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface Keyword {
  id: string;
  term: string;
  enabled: boolean;
}

export default function Dashboard() {
  const [newsletters, setNewsletters] = useState<NewsletterSummary[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [configEmail, setConfigEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // New source form
  const [newSourceType, setNewSourceType] = useState("rss");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // New keyword input
  const [newKeyword, setNewKeyword] = useState("");

  const fetchNewsletters = useCallback(async () => {
    const res = await fetch("/api/newsletter");
    if (res.ok) setNewsletters(await res.json());
  }, []);

  const fetchSources = useCallback(async () => {
    const res = await fetch("/api/sources");
    if (res.ok) setSources(await res.json());
  }, []);

  const fetchKeywords = useCallback(async () => {
    const res = await fetch("/api/keywords");
    if (res.ok) setKeywords(await res.json());
  }, []);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      setConfigEmail(data.email || "");
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
    fetchSources();
    fetchKeywords();
    fetchConfig();
  }, [fetchNewsletters, fetchSources, fetchKeywords, fetchConfig]);

  async function runScan() {
    setLoading(true);
    setScanStatus("Scraping all sources for AI startup news...");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setScanStatus(
          `Done! ${data.startupCount} startups, ${data.newsItemCount || 0} news items.`
        );
        fetchNewsletters();
      } else {
        setScanStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setScanStatus(`Failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }
    setLoading(false);
  }

  async function viewNewsletter(id: string) {
    const res = await fetch(`/api/newsletter/${id}`);
    if (res.ok) {
      const data = await res.json();
      setPreviewHtml(data.html);
    }
  }

  // Source CRUD
  async function addSource() {
    if (!newSourceName || !newSourceUrl) return;

    const url = newSourceUrl;

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newSourceType, name: newSourceName, url }),
    });
    if (res.ok) {
      setNewSourceName("");
      setNewSourceUrl("");
      fetchSources();
    }
  }

  async function toggleSource(id: string, enabled: boolean) {
    await fetch(`/api/sources/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchSources();
  }

  async function deleteSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    fetchSources();
  }

  // Keyword CRUD
  async function addKeyword() {
    if (!newKeyword.trim()) return;
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: newKeyword.trim() }),
    });
    if (res.ok) {
      setNewKeyword("");
      fetchKeywords();
    }
  }

  async function toggleKeyword(id: string, enabled: boolean) {
    await fetch(`/api/keywords/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchKeywords();
  }

  async function deleteKeyword(id: string) {
    await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    fetchKeywords();
  }

  // Config
  async function saveEmail() {
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: configEmail }),
    });
  }

  const typeBadgeColors: Record<string, string> = {
    rss: "bg-orange-100 text-orange-700",
    api: "bg-blue-100 text-blue-700",
    blog: "bg-sky-100 text-sky-700",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold tracking-tight">Startup Scanner</h1>
          <p className="text-blue-200 mt-1">
            Daily AI startup intelligence — scrape, analyze, and deliver newsletters
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Run Scanner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Run Scanner</h2>
              <p className="text-sm text-slate-500 mt-1">
                Scrape all enabled sources, generate AI-powered newsletter.
              </p>
            </div>
            <button
              onClick={runScan}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Scanning..." : "Run Scan"}
            </button>
          </div>
          {scanStatus && (
            <div className="mt-4 px-4 py-3 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-100">
              {scanStatus}
            </div>
          )}
        </div>

        {/* Data Sources */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Data Sources</h2>
          </div>
          <div className="p-6">
            {/* Source List */}
            {sources.length > 0 && (
              <div className="mb-6 divide-y divide-slate-100">
                {sources.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${typeBadgeColors[s.type] || "bg-gray-100 text-gray-700"}`}
                      >
                        {s.type.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-400 truncate max-w-md">{s.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSource(s.id, s.enabled)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                          s.enabled
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}
                      >
                        {s.enabled ? "Enabled" : "Disabled"}
                      </button>
                      <button
                        onClick={() => deleteSource(s.id)}
                        className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Source Form */}
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="rss">RSS Feed</option>
                  <option value="api">API</option>
                  <option value="blog">Blog/Substack</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Source name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Feed URL
                </label>
                <input
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={addSource}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Keywords</h2>
          </div>
          <div className="p-6">
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {keywords.map((k) => (
                  <span
                    key={k.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                      k.enabled
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "bg-slate-50 text-slate-400 border border-slate-200"
                    }`}
                  >
                    <button
                      onClick={() => toggleKeyword(k.id, k.enabled)}
                      className="hover:opacity-70"
                      title={k.enabled ? "Disable" : "Enable"}
                    >
                      {k.term}
                    </button>
                    <button
                      onClick={() => deleteKeyword(k.id)}
                      className="text-current opacity-40 hover:opacity-100 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder="Add keyword..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={addKeyword}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Email Settings</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-3">
              <input
                value={configEmail}
                onChange={(e) => setConfigEmail(e.target.value)}
                placeholder="recipient@example.com"
                type="email"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={saveEmail}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Daily newsletter will be sent to this email via the cron job.
            </p>
          </div>
        </div>

        {/* Newsletter History */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Past Newsletters
            </h2>
          </div>
          {newsletters.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              No newsletters yet. Run a scan to generate your first one.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {newsletters.map((n) => (
                <div
                  key={n.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {n.subject}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Created{" "}
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {n.sentAt && (
                        <span className="ml-2 text-green-600">
                          Sent{" "}
                          {new Date(n.sentAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => viewNewsletter(n.id)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {previewHtml && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between rounded-t-xl">
              <span className="text-sm font-semibold text-slate-900">
                Newsletter Preview
              </span>
              <button
                onClick={() => setPreviewHtml(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
