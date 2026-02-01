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
      "relative rounded-xl border transition-all duration-500",
      light ? "bg-white border-slate-200 shadow-xl" : "bg-neutral-950 border-neutral-800 shadow-2xl",
      className
    )}>
      <div className={cn(
        "flex items-center justify-between px-5 py-3 border-b",
        light ? "bg-slate-50 border-slate-200" : "bg-neutral-900 border-neutral-800"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-neutral-700" />
            <div className="size-3 rounded-full bg-neutral-700" />
            <div className="size-3 rounded-full bg-neutral-700" />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest font-mono",
            light ? "text-slate-400" : "text-neutral-500"
          )}>{title}</span>
        </div>
      </div>
      <div className={cn(
        "p-6 font-mono text-sm leading-relaxed overflow-x-auto",
        light ? "text-slate-800" : "text-neutral-300"
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
      "group relative p-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 flex flex-col items-start text-left transition-all duration-300 hover:bg-neutral-900 hover:border-neutral-700 hover:-translate-y-1",
      className
    )}>
      {badge && (
        <span className="absolute top-6 right-6 px-2 py-0.5 rounded-full bg-[#FF7B00]/10 text-[#FF7B00] text-[10px] font-bold uppercase tracking-wider">
          {badge}
        </span>
      )}
      <div className="p-3 rounded-xl bg-[#FF7B00]/10 text-[#FF7B00] mb-6 group-hover:bg-[#FF7B00] group-hover:text-white transition-all duration-500">
        <Icon className="size-6" />
      </div>
      <h3 className="text-xl font-bold mb-3 tracking-tight text-white">{title}</h3>
      <p className="text-neutral-400 leading-relaxed text-sm md:text-base">
        {description}
      </p>
    </div>
  );
}
