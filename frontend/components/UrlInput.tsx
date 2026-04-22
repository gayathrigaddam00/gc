"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function UrlInput({ value, onChange, onSubmit, loading }: Props) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="flex gap-2 w-full">
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="https://github.com/login"
        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm
                   placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1
                   focus:ring-indigo-500 transition"
      />
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500
                   disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {loading ? "Scanning..." : "Detect"}
      </button>
    </div>
  );
}
