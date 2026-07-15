import { useState } from "react";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fall back silently.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-md border border-navy-700 text-navy-800 font-medium px-4 py-2.5 hover:bg-navy-50 transition text-sm"
    >
      {copied ? "Link copied!" : "Copy shareable link"}
    </button>
  );
}
