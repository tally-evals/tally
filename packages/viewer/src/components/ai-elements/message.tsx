import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Message({ from, className, ...props }: { from: string } & ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group flex w-full max-w-[95%] flex-col gap-2',
        from === 'user'
          ? 'is-user ml-auto justify-end'
          : from === 'tool'
            ? 'is-tool'
            : 'is-assistant',
        className
      )}
      data-message-from={from}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm',
        'group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground',
        // Assistant responses: light grey bubble to distinguish from page background
        'group-[.is-assistant]:rounded-lg group-[.is-assistant]:bg-muted/30 group-[.is-assistant]:px-4 group-[.is-assistant]:py-3 group-[.is-assistant]:text-foreground',
        // Tool messages: keep neutral; tools have their own card UI
        'group-[.is-tool]:w-full group-[.is-tool]:bg-transparent group-[.is-tool]:p-0',
        className
      )}
      {...props}
    />
  );
}

export function MessageResponse({
  className,
  children,
  ...props
}: ComponentProps<'div'> & { children?: ReactNode }) {
  return (
    <div className={cn('whitespace-pre-wrap break-words', className)} {...props}>
      {children}
    </div>
  );
}
