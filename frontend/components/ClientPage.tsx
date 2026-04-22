"use client";

import { useState } from "react";
import { detectAuth, DetectionResult } from "@/lib/api";

const SAMPLE_URLS = [
  { label: "GitHub", url: "https://github.com/login" },
  { label: "WordPress", url: "https://wordpress.com/log-in" },
  { label: "PyPI", url: "https://pypi.org/account/login/" },
  { label: "MediaWiki", url: "https://www.mediawiki.org/w/index.php?title=Special:UserLogin" },
  { label: "Docker Hub", url: "https://hub.docker.com/login" },
];

const METHOD_LABEL: Record<string, string> = {
  static: "httpx",
  headless: "playwright",
  llm: "llm",
  none: "none",
};

type Tab = "snippet" | "keywords" | "json";

export default function ClientPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("snippet");
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const doDetect = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("snippet");
    try {
      const data = await detectAuth(trimmed);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error — could not reach the API.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doDetect(url);
  };

  const handleCopySnippet = () => {
    if (!result?.html_snippet) return;
    navigator.clipboard.writeText(result.html_snippet).then(() => {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!result) return;
    const text = JSON.stringify({ ...result, html_snippet: result.html_snippet ? "(see HTML Snippet tab)" : null }, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    });
  };

  const statusBadge = () => {
    if (!result) return null;
    if (result.bot_protection) {
      return (
        <span style={styles.badgeOrange}>
          <span style={styles.badgeDot} />
          Bot Protected
        </span>
      );
    }
    if (result.found) {
      return (
        <span style={styles.badgeGreen}>
          <span style={styles.badgeDot} />
          Auth Found
        </span>
      );
    }
    return (
      <span style={styles.badgeYellow}>
        <span style={styles.badgeDot} />
        Not Found
      </span>
    );
  };

  const methodBadgeStyle = result?.method === "static" ? styles.methodHttpx : styles.methodPw;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🔍</span>
            <span style={styles.logoText}>AuthScraper</span>
          </div>
          <span style={styles.headerSub}>Login Form Detector · FastAPI</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Auth Component Detector</h1>
          <p style={styles.heroSub}>
            Enter any website URL to detect and extract its login form or authentication component.
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} style={styles.searchBar}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/login"
            autoComplete="off"
            spellCheck={false}
            style={styles.input}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99,102,241,.2)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              ...styles.btn,
              opacity: loading || !url.trim() ? 0.4 : 1,
              cursor: loading || !url.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span style={styles.spinnerWrap}>
                <span style={styles.spinner} />
              </span>
            ) : (
              "Detect Auth"
            )}
          </button>
        </form>

        {/* Examples */}
        <div style={styles.examples}>
          <span style={styles.examplesLabel}>Try:</span>
          {SAMPLE_URLS.map(({ label, url: sampleUrl }) => (
            <button
              key={sampleUrl}
              onClick={() => { setUrl(sampleUrl); doDetect(sampleUrl); }}
              disabled={loading}
              style={styles.exampleBtn}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* How it works (idle state) */}
        {!result && !loading && !error && (
          <div style={styles.howGrid}>
            {[
              { icon: "🌐", title: "Fetch", desc: "Tries fast httpx first; falls back to headless Playwright for JS-rendered or bot-protected pages." },
              { icon: "🔎", title: "Analyze", desc: "Parses the DOM with BeautifulSoup using 4 detection strategies plus optional LLM fallback." },
              { icon: "📋", title: "Extract", desc: "Returns a structured JSON response with the HTML snippet, confidence score, and detected fields." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={styles.howCard}>
                <div style={styles.howIcon}>{icon}</div>
                <h3 style={styles.howTitle}>{title}</h3>
                <p style={styles.howDesc}>{desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={styles.loadingCard}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Fetching and analyzing page…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBanner}>
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <div>
              <p style={styles.errorTitle}>Request Failed</p>
              <p style={styles.errorMsg}>{error}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && !loading && (
          <div style={styles.resultCard}>
            {/* Result header */}
            <div style={styles.resultHeader}>
              <div style={styles.resultHeaderLeft}>
                {statusBadge()}
                <span style={styles.resultUrl}>{result.url}</span>
              </div>
              {result.html_snippet && (
                <button
                  onClick={handleCopySnippet}
                  style={styles.copyBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
                >
                  {copiedSnippet ? "✓ Copied" : "Copy HTML"}
                </button>
              )}
            </div>

            {/* Stats row */}
            {!result.error && (
              <div style={styles.statsRow}>
                <StatCard value={1} label="Forms Found" />
                <StatCard value={result.detected_fields.filter(f => f === "password").length || (result.found ? 1 : 0)} label="Password Inputs" />
                <StatCard value={result.detected_fields.length} label="Auth Keywords" />
                <div style={styles.statCard}>
                  <div style={{ ...styles.statValue, ...methodBadgeStyle }}>
                    {METHOD_LABEL[result.method] ?? result.method}
                  </div>
                  <div style={styles.statLabel}>Fetch Method</div>
                </div>
              </div>
            )}

            {/* Bot protection banner */}
            {result.bot_protection && (
              <div style={styles.botBanner}>
                <span>⚠️</span>
                <div>
                  <p style={styles.errorTitle}>Bot protection detected</p>
                  <p style={styles.errorMsg}>
                    This site actively blocks automated browsers. A login form likely exists but cannot be scraped.
                  </p>
                </div>
              </div>
            )}

            {/* Tabs */}
            {!result.error && !result.bot_protection && (
              <div style={styles.tabSection}>
                <div style={styles.tabBar}>
                  {(["snippet", "keywords", "json"] as Tab[]).map((t, i) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      style={{
                        ...styles.tabBtn,
                        ...(activeTab === t ? styles.tabBtnActive : {}),
                      }}
                    >
                      {["HTML Snippet", "Auth Keywords", "Raw JSON"][i]}
                    </button>
                  ))}
                </div>

                {/* Snippet pane */}
                {activeTab === "snippet" && (
                  <div>
                    {result.html_snippet ? (
                      <div style={styles.codeWrapper}>
                        <div style={styles.codeHeader}>
                          <span style={styles.codeFilename}>login-form.html</span>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <CopyIconBtn
                              onCopy={handleCopySnippet}
                              copied={copiedSnippet}
                              title="Copy HTML snippet"
                            />
                           
                          </div>
                        </div>
                        <pre style={styles.codeBlock}>{result.html_snippet}</pre>
                      </div>
                    ) : (
                      <div style={styles.noSnippet}>
                        <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>🔒</div>
                        <p style={{ fontSize: ".9rem", fontWeight: 500, color: "#94a3b8", marginBottom: ".35rem" }}>
                          No authentication component found
                        </p>
                        <p style={{ fontSize: ".78rem", color: "#64748b", maxWidth: 360, margin: "0 auto" }}>
                          This page may use JS-rendered login forms or has no login at this URL.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Keywords pane */}
                {activeTab === "keywords" && (
                  <div>
                    {result.detected_fields.length > 0 ? (
                      <div style={styles.keywordTags}>
                        {result.detected_fields.map((kw) => (
                          <span key={kw} style={styles.keywordTag}>{kw}</span>
                        ))}
                        {result.form_action && (
                          <span style={{ ...styles.keywordTag, background: "rgba(16,185,129,.15)", borderColor: "rgba(16,185,129,.3)", color: "#34d399" }}>
                            action: {result.form_action}
                          </span>
                        )}
                        {result.fallback_reason && (
                          <span style={{ ...styles.keywordTag, background: "rgba(245,158,11,.1)", borderColor: "rgba(245,158,11,.3)", color: "#fbbf24" }}>
                            {result.fallback_reason.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: ".85rem", color: "#64748b" }}>No auth-related keywords detected.</p>
                    )}
                  </div>
                )}

                {/* JSON pane */}
                {activeTab === "json" && (
                  <div style={styles.codeWrapper}>
                    <div style={styles.codeHeader}>
                      <span style={styles.codeFilename}>response.json</span>
                      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                        <CopyIconBtn
                          onCopy={handleCopyJson}
                          copied={copiedJson}
                          title="Copy JSON"
                        />
                        <div style={styles.trafficLights}>
                          <span style={{ ...styles.tl, background: "rgba(239,68,68,.5)" }} />
                          <span style={{ ...styles.tl, background: "rgba(245,158,11,.5)" }} />
                          <span style={{ ...styles.tl, background: "rgba(16,185,129,.5)" }} />
                        </div>
                      </div>
                    </div>
                    <pre style={{ ...styles.codeBlock, color: "#93c5fd" }}>
                      {JSON.stringify({ ...result, html_snippet: result.html_snippet ? "(see HTML Snippet tab)" : null }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        AuthScraper — AI Engineer Technical Assessment &nbsp;·&nbsp;
        <a href="/docs" target="_blank" style={{ color: "#6366f1" }}>API Docs (Swagger)</a>
      </footer>

      {/* Inline keyframes for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spin2 { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function CopyIconBtn({ onCopy, copied, title }: { onCopy: () => void; copied: boolean; title: string }) {
  return (
    <button
      onClick={onCopy}
      title={title}
      style={styles.iconCopyBtn}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#0f1117",
    color: "#e2e8f0",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: '"SF Mono", "Fira Code", Consolas, "Courier New", monospace',
  },

  // Header
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(15,17,23,.85)",
    backdropFilter: "blur(8px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "0 1.25rem",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { display: "flex", alignItems: "center", gap: ".6rem" },
  logoIcon: {
    width: 32, height: 32,
    background: "#6366f1",
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: ".9rem",
  },
  logoText: { fontWeight: 600, color: "#fff", fontFamily: "system-ui, sans-serif", letterSpacing: "-.01em" },
  headerSub: { fontSize: ".75rem", color: "#64748b", fontFamily: "system-ui, sans-serif" },

  // Main
  main: {
    flex: 1,
    maxWidth: 900,
    margin: "0 auto",
    width: "100%",
    padding: "3rem 1.25rem 4rem",
  },

  // Hero
  hero: { textAlign: "center", marginBottom: "2.5rem" },
  heroTitle: {
    fontSize: "2.4rem",
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-.02em",
    marginBottom: ".6rem",
    fontFamily: "system-ui, sans-serif",
  },
  heroSub: { color: "#64748b", fontSize: "1.05rem", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif" },

  // Search
  searchBar: { display: "flex", gap: ".65rem", marginBottom: "1.1rem" },
  input: {
    flex: 1,
    background: "#1a1d27",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    padding: ".85rem 1.2rem",
    color: "#fff",
    fontSize: ".9rem",
    outline: "none",
    transition: "border-color .2s, box-shadow .2s",
    fontFamily: "system-ui, sans-serif",
  },
  btn: {
    padding: ".85rem 1.5rem",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: ".88rem",
    display: "flex",
    alignItems: "center",
    gap: ".5rem",
    whiteSpace: "nowrap",
    fontFamily: "system-ui, sans-serif",
    transition: "background .2s",
  },
  spinnerWrap: { display: "flex", alignItems: "center" },
  spinner: {
    width: 16, height: 16,
    border: "2px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin .7s linear infinite",
  },

  // Examples
  examples: { display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", marginBottom: "3rem" },
  examplesLabel: { fontSize: ".75rem", color: "#64748b", marginRight: ".25rem", fontFamily: "system-ui, sans-serif" },
  exampleBtn: {
    fontSize: ".75rem",
    padding: ".35rem .8rem",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#cbd5e1",
    cursor: "pointer",
    transition: "background .15s",
    fontFamily: "system-ui, sans-serif",
  },

  // How it works
  howGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" },
  howCard: {
    background: "#1a1d27",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    padding: "1.3rem",
  },
  howIcon: { fontSize: "1.6rem", marginBottom: ".7rem" },
  howTitle: { fontSize: ".95rem", color: "#fff", marginBottom: ".4rem", fontFamily: "system-ui, sans-serif" },
  howDesc: { fontSize: ".8rem", color: "#64748b", lineHeight: 1.55, fontFamily: "system-ui, sans-serif" },

  // Loading
  loadingCard: {
    background: "#1a1d27",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    padding: "3rem",
    textAlign: "center",
  },
  loadingSpinner: {
    width: 40, height: 40,
    border: "2px solid #6366f1",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin .9s linear infinite",
    margin: "0 auto 1rem",
  },
  loadingText: { color: "#64748b", fontSize: ".88rem", fontFamily: "system-ui, sans-serif" },

  // Error
  errorBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: ".75rem",
    padding: "1rem 1.1rem",
    background: "rgba(239,68,68,.08)",
    border: "1px solid rgba(239,68,68,.2)",
    borderRadius: 10,
    color: "#f87171",
    marginBottom: "1rem",
  },
  errorTitle: { fontSize: ".85rem", fontWeight: 600, marginBottom: ".2rem", fontFamily: "system-ui, sans-serif" },
  errorMsg: { fontSize: ".78rem", color: "#fca5a5", fontFamily: "system-ui, sans-serif" },

  // Result card
  resultCard: {
    background: "#1a1d27",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    overflow: "hidden",
  },
  resultHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: ".75rem",
    padding: "1.1rem 1.3rem",
    borderBottom: "1px solid rgba(255,255,255,0.09)",
  },
  resultHeaderLeft: { display: "flex", alignItems: "center", gap: ".75rem", minWidth: 0 },
  resultUrl: { fontSize: ".82rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "system-ui, sans-serif" },

  // Badges
  badgeGreen: {
    display: "inline-flex", alignItems: "center", gap: ".4rem",
    padding: ".25rem .75rem",
    borderRadius: 99,
    fontSize: ".72rem", fontWeight: 600, whiteSpace: "nowrap",
    background: "rgba(16,185,129,.13)", color: "#34d399",
    border: "1px solid rgba(16,185,129,.3)",
    fontFamily: "system-ui, sans-serif",
  },
  badgeYellow: {
    display: "inline-flex", alignItems: "center", gap: ".4rem",
    padding: ".25rem .75rem",
    borderRadius: 99,
    fontSize: ".72rem", fontWeight: 600, whiteSpace: "nowrap",
    background: "rgba(245,158,11,.13)", color: "#fbbf24",
    border: "1px solid rgba(245,158,11,.3)",
    fontFamily: "system-ui, sans-serif",
  },
  badgeOrange: {
    display: "inline-flex", alignItems: "center", gap: ".4rem",
    padding: ".25rem .75rem",
    borderRadius: 99,
    fontSize: ".72rem", fontWeight: 600, whiteSpace: "nowrap",
    background: "rgba(249,115,22,.13)", color: "#fb923c",
    border: "1px solid rgba(249,115,22,.3)",
    fontFamily: "system-ui, sans-serif",
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: "50%", background: "currentColor",
  },

  // Copy button
  copyBtn: {
    fontSize: ".75rem",
    padding: ".35rem .8rem",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#cbd5e1",
    cursor: "pointer",
    transition: "background .15s",
    fontFamily: "system-ui, sans-serif",
  },
  iconCopyBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    padding: 0,
    background: "transparent",
    border: "none",
    borderRadius: 6,
    color: "#64748b",
    cursor: "pointer",
    transition: "color .15s, background .15s",
    flexShrink: 0,
  },

  // Stats
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: ".75rem",
    padding: "1.1rem 1.3rem",
    borderBottom: "1px solid rgba(255,255,255,0.09)",
  },
  statCard: {
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    padding: ".85rem 1rem",
  },
  statValue: { fontSize: "1.3rem", fontWeight: 700, color: "#fff", fontFamily: "system-ui, sans-serif" },
  statLabel: { fontSize: ".72rem", color: "#64748b", marginTop: ".2rem", fontFamily: "system-ui, sans-serif" },
  methodHttpx: { fontSize: ".8rem", fontFamily: "monospace", color: "#6ee7b7" },
  methodPw: { fontSize: ".8rem", fontFamily: "monospace", color: "#a5b4fc" },

  // Bot banner
  botBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: ".75rem",
    margin: "1.1rem 1.3rem",
    padding: "1rem 1.1rem",
    background: "rgba(249,115,22,.08)",
    border: "1px solid rgba(249,115,22,.2)",
    borderRadius: 10,
    color: "#fb923c",
  },

  // Tabs
  tabSection: { padding: "1.1rem 1.3rem" },
  tabBar: {
    display: "flex",
    gap: ".25rem",
    background: "rgba(0,0,0,.2)",
    padding: ".25rem",
    borderRadius: 10,
    width: "fit-content",
    marginBottom: "1rem",
  },
  tabBtn: {
    fontSize: ".75rem",
    fontWeight: 500,
    padding: ".35rem 1rem",
    borderRadius: 7,
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    transition: "background .15s, color .15s",
    fontFamily: "system-ui, sans-serif",
  },
  tabBtnActive: { background: "#6366f1", color: "#fff" },

  // Code block
  codeWrapper: {
    background: "#0d0f16",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    overflow: "hidden",
  },
  codeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: ".5rem 1rem",
    borderBottom: "1px solid rgba(255,255,255,0.09)",
  },
  codeFilename: { fontSize: ".72rem", color: "#64748b", fontFamily: "monospace" },
  codeBlock: {
    fontFamily: '"SF Mono", "Fira Code", Consolas, "Courier New", monospace',
    fontSize: ".76rem",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    overflowWrap: "break-word",
    color: "#6ee7b7",
    padding: "1rem",
    maxHeight: 480,
    overflowY: "auto",
    margin: 0,
  },

  // No snippet
  noSnippet: { textAlign: "center", padding: "3rem 1rem" },

  // Keywords
  keywordTags: { display: "flex", flexWrap: "wrap", gap: ".5rem" },
  keywordTag: {
    padding: ".35rem .8rem",
    fontSize: ".76rem",
    fontFamily: "monospace",
    background: "rgba(99,102,241,.15)",
    color: "#a5b4fc",
    border: "1px solid rgba(99,102,241,.3)",
    borderRadius: 8,
  },

  // Footer
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.09)",
    padding: "1.5rem",
    textAlign: "center",
    fontSize: ".75rem",
    color: "#374151",
    fontFamily: "system-ui, sans-serif",
  },
};