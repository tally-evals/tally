import type { ComponentProps, ReactNode } from "react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type ToolState = "pending" | "running" | "completed" | "error";

function getStatusBadge(state: ToolState) {
  const labels: Record<ToolState, string> = {
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    error: "Error",
  };

  const icons: Record<ToolState, ReactNode> = {
    pending: <CircleIcon className="size-4" />,
    running: <ClockIcon className="size-4 animate-pulse" />,
    completed: <CheckCircleIcon className="size-4 text-green-600" />,
    error: <XCircleIcon className="size-4 text-red-600" />,
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
      {icons[state]}
      {labels[state]}
    </span>
  );
}

export function Tool({
  defaultOpen,
  className,
  ...props
}: { defaultOpen?: boolean } & ComponentProps<"details">) {
  return (
    <details
      open={defaultOpen}
      className={cn("group mb-4 w-full rounded-md border border-border bg-background", className)}
      {...props}
    />
  );
}

export function ToolHeader({
  title,
  type,
  state = "running",
  className,
  ...props
}: {
  title?: string;
  type?: string;
  state?: ToolState;
} & ComponentProps<"summary">) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {title ?? (type ? type.split("-").slice(1).join("-") : "tool")}
        </span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
  );
}

export function ToolContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-t border-border", className)} {...props} />;
}

export function ToolInput({
  input,
  className,
  ...props
}: { input?: unknown } & ComponentProps<"div">) {
  return (
    <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">
        <pre className="code-block overflow-x-auto p-3 text-xs">
          {JSON.stringify(input ?? null, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export function ToolOutput({
  output,
  errorText,
  className,
  ...props
}: { output?: ReactNode; errorText?: string } & ComponentProps<"div">) {
  if (!(output || errorText)) return null;

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground"
        )}
      >
        {errorText ? <div className="p-3">{errorText}</div> : null}
        <div className="p-3">{output ?? <span>null</span>}</div>
      </div>
    </div>
  );
}

