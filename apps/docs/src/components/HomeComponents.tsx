import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function CodeWindow({ 
  children, 
  title = 'example.ts',
  className,
  light = false
}: { 
  children: ReactNode; 
  title?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl border transition-all duration-500",
      light ? "bg-white border-slate-200 shadow-xl" : "bg-slate-950 border-white/10 shadow-2xl",
      className
    )}>
      <div className={cn(
        "flex items-center justify-between px-5 py-3 border-b",
        light ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-500/30 border border-red-500/40" />
            <div className="size-3 rounded-full bg-amber-500/30 border border-amber-500/40" />
            <div className="size-3 rounded-full bg-emerald-500/30 border border-emerald-500/40" />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest font-mono",
            light ? "text-slate-400" : "text-white/40"
          )}>{title}</span>
        </div>
      </div>
      <div className={cn(
        "p-6 font-mono text-sm leading-relaxed overflow-x-auto",
        light ? "text-slate-800" : "text-indigo-100"
      )}>
        {children}
      </div>
    </div>
  );
}

export function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  className,
  badge
}: { 
  icon: LucideIcon; 
  title: string; 
  description: string;
  className?: string;
  badge?: string;
}) {
  return (
    <div className={cn(
      "group relative p-8 rounded-3xl border bg-fd-background/50 backdrop-blur-sm flex flex-col items-start text-left transition-all duration-300 hover:bg-fd-accent/5 hover:border-fd-primary/30 hover:-translate-y-2",
      className
    )}>
      {badge && (
        <span className="absolute top-6 right-6 px-2 py-0.5 rounded-full bg-fd-primary/10 text-fd-primary text-[10px] font-bold uppercase tracking-wider">
          {badge}
        </span>
      )}
      <div className="p-3 rounded-2xl bg-fd-primary/10 text-fd-primary mb-6 group-hover:bg-fd-primary group-hover:text-fd-primary-foreground transition-all duration-500 shadow-sm text-center">
        <Icon className="size-6" />
      </div>
      <h3 className="text-xl font-bold mb-3 tracking-tight">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed text-sm md:text-base">
        {description}
      </p>
    </div>
  );
}
