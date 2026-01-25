'use client';

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

export function CodeSnippet({
  lang = 'ts',
  code,
}: {
  lang?: string;
  code: string;
}) {
  return <DynamicCodeBlock lang={lang} code={code} />;
}

