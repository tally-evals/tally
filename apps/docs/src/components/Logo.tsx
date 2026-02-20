import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  size?: number;
}

export function TallyLogo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
    >
      <path d="M6 0V48" stroke="currentColor" strokeWidth="3" />
      <path d="M18 0V48" stroke="currentColor" strokeWidth="3" />
      <path d="M30 0V48" stroke="currentColor" strokeWidth="3" />
      <path d="M42 0V48" stroke="currentColor" strokeWidth="3" />
      <rect
        x="0.7"
        y="3.24"
        width="3"
        height="63.66"
        transform="rotate(-43 0.7 3.24)"
        fill="#FF7B00"
        stroke="black"
      />
    </svg>
  );
}

export function TallyLogoWithText({ className, size = 32 }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <TallyLogo size={size} />
      <span className="text-xl font-bold tracking-tight">Tally</span>
    </div>
  );
}
