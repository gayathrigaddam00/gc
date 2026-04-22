"use client";

import { DetectionResult } from "@/lib/api";

interface Props {
  result: DetectionResult;
}

const METHOD_LABELS: Record<string, string> = {
  static: "Static HTTP",
  headless: "Headless Browser",
  llm: "LLM Fallback",
  none: "No method succeeded",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Confidence</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-700">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ResultCard({ result }: Props) {
  return (
    <div
      className={`rounded-xl border p-5 space-y-4 ${
        result.bot_protection
          ? "border-orange-700 bg-orange-950/30"
          : result.found
          ? "border-emerald-700 bg-emerald-950/40"
          : "border-red-800 bg-red-950/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`text-lg font-semibold ${
            result.found ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {result.bot_protection
            ? "Bot protection detected"
            : result.found
            ? "Auth component found"
            : "No auth component found"}
        </span>
        <div className="flex items-center gap-2">
          {result.bot_protection && (
            <span className="rounded-full bg-orange-900/60 border border-orange-700 px-3 py-1 text-xs text-orange-300">
              Bot Protected
            </span>
          )}
          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
            {METHOD_LABELS[result.method]}
          </span>
        </div>
      </div>

      {/* URL */}
      <p className="text-xs text-gray-400 break-all">{result.url}</p>

      {/* Confidence */}
      <ConfidenceBar value={result.confidence} />

      {/* Detected fields */}
      {result.detected_fields.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Detected fields</p>
          <div className="flex flex-wrap gap-2">
            {result.detected_fields.map((f) => (
              <span
                key={f}
                className="rounded-md bg-indigo-900/60 border border-indigo-700 px-2 py-0.5 text-xs text-indigo-300"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form action */}
      {result.form_action && (
        <p className="text-xs text-gray-400">
          Form action: <code className="text-gray-200">{result.form_action}</code>
        </p>
      )}

      {/* Bot protection explanation */}
      {result.bot_protection && (
        <p className="text-xs text-orange-400/90">
          This site actively blocks automated browsers. A login form likely exists but cannot be scraped.
        </p>
      )}

      {/* Fallback reason (non-bot cases) */}
      {result.fallback_reason && !result.bot_protection && (
        <p className="text-xs text-yellow-500/80">
          Note: {result.fallback_reason.replace(/_/g, " ")}
        </p>
      )}

      {/* Error */}
      {result.error && (
        <p className="text-xs text-red-400">Error: {result.error}</p>
      )}
    </div>
  );
}
