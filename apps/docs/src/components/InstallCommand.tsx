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
    <div className="relative group">
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 opacity-25 group-hover:opacity-40 transition-opacity blur" />
      <div className="relative flex items-center justify-between p-6 rounded-xl bg-background border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-4 text-left">
          <Terminal className="size-5 text-muted-foreground shrink-0" />
          <code className="text-sm md:text-base font-mono break-all">{command}</code>
        </div>
        <button
          onClick={onCopy}
          className="ml-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
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
    </div>
  );
}
