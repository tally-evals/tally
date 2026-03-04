'use client';

import { Check, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex items-center justify-between px-6 py-4 rounded-xl bg-black border border-neutral-700 overflow-hidden">
      <div className="flex items-center gap-4 text-left">
        <Terminal className="size-5 text-neutral-500 shrink-0" />
        <code className="text-sm md:text-base font-mono text-neutral-300 break-all">{command}</code>
      </div>
      <button
        onClick={onCopy}
        className="ml-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-white transition-colors shrink-0"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
