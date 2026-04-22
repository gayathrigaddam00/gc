"use client";

import { useState } from "react";

interface Props {
  snippet: string;
}

export default function HtmlSnippet({ snippet }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-indigo-400 hover:text-indigo-300 transition"
      >
        {open ? "Hide" : "Show"} HTML snippet
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-900 border border-gray-700
                        p-3 text-xs text-gray-300 whitespace-pre-wrap break-all">
          {snippet}
        </pre>
      )}
    </div>
  );
}
