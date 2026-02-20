'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-3 px-6 py-4 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-mono text-sm transition-colors"
    >
      <span>{command}</span>
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Copy className="size-4 text-neutral-500" />
      )}
    </button>
  );
}
