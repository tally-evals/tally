import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type ConversationContextValue = {
  isAtBottom: boolean;
  scrollToBottom: () => void;
};

type ConversationCompoundProps = {
  children?:
    | ReactNode
    | ((context: ConversationContextValue) => ReactNode);
} & Omit<ComponentProps<"div">, "children">;

function useRenderChildren(
  children: ConversationCompoundProps["children"],
  context: ConversationContextValue
) {
  if (typeof children === "function") return children(context);
  return children;
}

export function Conversation({ children, className, ...props }: ConversationCompoundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      // within ~8px of bottom counts as "at bottom"
      const threshold = 8;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      setIsAtBottom(atBottom);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-stick to bottom when new content arrives *if* user is already at bottom.
  const lastScrollHeightRef = useRef<number>(0);
  const hasMountedRef = useRef(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Do not auto-scroll on initial mount; only follow new content after first paint.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastScrollHeightRef.current = el.scrollHeight;
      return;
    }
    const prev = lastScrollHeightRef.current;
    const next = el.scrollHeight;
    lastScrollHeightRef.current = next;
    if (isAtBottom && next !== prev) scrollToBottom();
  });

  const context = useMemo<ConversationContextValue>(
    () => ({ isAtBottom, scrollToBottom }),
    [isAtBottom, scrollToBottom]
  );

  return (
    <div className={cn("relative h-full min-h-0", className)} {...props}>
      <div
        ref={containerRef}
        className="h-full min-h-0 overflow-y-auto overscroll-contain"
        data-conversation-container
      >
        {useRenderChildren(children, context)}
      </div>
    </div>
  );
}

export function ConversationContent({ children, className, ...props }: ConversationCompoundProps) {
  // This component is mostly layout; it doesn't need access to the container ref.
  // We keep it to mirror the AI Elements API.
  return (
    <div className={cn("flex flex-col gap-4 p-4", className)} {...props}>
      {typeof children === "function"
        ? // No context here; keep parity but avoid leaking internals.
          children({ isAtBottom: true, scrollToBottom: () => {} })
        : children}
    </div>
  );
}

export function ConversationEmptyState({
  title,
  description,
  icon,
  className,
  children,
  ...props
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
} & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon ? <div className="mb-2 text-muted-foreground">{icon}</div> : null}
      {title ? <div className="text-base font-semibold text-foreground">{title}</div> : null}
      {description ? <div className="max-w-md text-sm">{description}</div> : null}
      {children}
    </div>
  );
}

export function ConversationScrollButton({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children" | "onClick">) {
  // Find the nearest conversation container and compute "at bottom" from scroll state.
  // This avoids having to thread context through every child.
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const btn = document.querySelector("[data-conversation-scroll-button]");
    if (!btn) return;
    const root = btn.closest("[data-conversation-container]") as HTMLElement | null;
    if (!root) return;
    containerRef.current = root;

    const onScroll = () => {
      const threshold = 8;
      const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight <= threshold;
      setVisible(!atBottom);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const onClick = () => {
    const root = containerRef.current;
    if (!root) return;
    root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onClick}
      className={cn("absolute bottom-4 right-4 shadow", className)}
      data-conversation-scroll-button
      {...props}
    >
      Scroll to bottom
    </Button>
  );
}

