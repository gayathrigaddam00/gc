"use client";

import { useState } from "react";
import { detectAuth, DetectionResult } from "@/lib/api";
import UrlInput from "@/components/UrlInput";
import ResultCard from "@/components/ResultCard";
import HtmlSnippet from "@/components/HtmlSnippet";

const SAMPLE_URLS = [
  "https://github.com/login",
  "https://www.linkedin.com/login",
  "https://accounts.google.com",
  "https://app.slack.com/signin",
  "https://twitter.com/login",
];

export default function ClientPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await detectAuth(trimmed);
      setResult(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Something went wrong. Is the backend running?";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Auth Component Detector</h1>
        <p className="text-gray-400 text-sm">
          Paste any URL below to detect whether it contains a login or authentication form.
        </p>
      </div>

      {/* Input */}
      <UrlInput value={url} onChange={setUrl} onSubmit={handleDetect} loading={loading} />

      {/* Sample sites */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Try a sample site:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_URLS.map((u) => (
            <button
              key={u}
              onClick={() => setUrl(u)}
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1 text-xs
                         text-gray-300 hover:border-indigo-600 hover:text-indigo-300 transition"
            >
              {new URL(u).hostname}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-3 animate-pulse">
          <div className="h-5 w-48 rounded bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-800" />
          <div className="h-2 w-full rounded bg-gray-800" />
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-2">
          <ResultCard result={result} />
          {result.html_snippet && <HtmlSnippet snippet={result.html_snippet} />}
        </div>
      )}
    </main>
  );
}
