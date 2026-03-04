'use client';

import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  code: string;
  lang?: string;
  className?: string;
}

export function CodeBlock({ code, lang = 'typescript', className = '' }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    codeToHtml(code, {
      lang,
      theme: 'github-dark',
    }).then((result) => {
      if (!cancelled) {
        setHtml(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    // Fallback while loading
    return (
      <pre className={`p-6 md:p-8 rounded-2xl bg-neutral-900/80 border border-neutral-800 overflow-x-auto ${className}`}>
        <code className="text-sm md:text-base lg:text-lg font-mono text-neutral-300 whitespace-pre">
          {code}
        </code>
      </pre>
    );
  }

  return (
    <div 
      className={`shiki-wrapper rounded-2xl overflow-hidden border border-neutral-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
