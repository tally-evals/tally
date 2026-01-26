'use client';

import { Code2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

export function CodePopover({
  label = 'Show TypeScript',
  title,
  tsDef,
  example,
}: {
  label?: string;
  title: string;
  tsDef: string;
  example?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          buttonVariants({
            color: 'secondary',
            size: 'icon',
            className:
              'h-7 w-7 align-middle ms-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground',
          }),
        )}
      >
        <Code2 />
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] space-y-3">
        <div className="text-sm font-medium">{title}</div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-fd-muted-foreground">Type</div>
          <DynamicCodeBlock lang="ts" code={tsDef} />
        </div>

        {example ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-fd-muted-foreground">Example</div>
            <DynamicCodeBlock lang="ts" code={example} />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

