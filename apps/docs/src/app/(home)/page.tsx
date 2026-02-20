import Link from 'next/link';
import { 
  ArrowRight, 
  Shield, 
  Workflow, 
  Target, 
  Zap, 
  Cpu, 
  Search, 
  Activity, 
  Github, 
  Play, 
  Layers, 
  MessageSquare, 
  TestTube, 
  FileText,
  History,
  TrendingUp,
  Terminal,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { InstallCommand } from '@/components/InstallCommand';
import { CopyButton } from '@/components/CopyButton';
import { CodeWindow, FeatureCard } from '@/components/HomeComponents';
import { TallyLogo } from '@/components/Logo';

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1 relative bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-32 bg-black">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-8">
            <TallyLogo size={64} className="text-white" />
          </div>

          {/* Beta Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 mb-12">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-white text-sm font-medium">Tally v0.1 Public Beta</span>
          </div>
          
          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tight mb-8 text-white">
            Make your Agents<br />Reliable.
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-neutral-400 max-w-3xl mb-6 leading-relaxed font-medium">
            Traditional eval frameworks are built for prompts.<br />
            <span className="text-white">Tally is built for Agents.</span>
          </p>
          <p className="text-base md:text-lg text-neutral-500 max-w-2xl mb-12 leading-relaxed">
            Stop grading prompts. Start testing behavior. Turn "it feels better" into verifiable, regression-proof confidence.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/docs/tally/getting-started"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg bg-[#FF7B00] hover:bg-[#FF8C1A] text-white font-semibold text-base transition-colors"
            >
              Get Started
            </Link>
            <CopyButton command="bun add @tally-evals/tally" />
          </div>
        </div>
      </section>

      {/* Multi-Turn Native Section */}
      <section className="py-32 px-6 border-y border-neutral-900 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FF7B00]/10 text-[#FF7B00] text-xs font-bold uppercase tracking-wider mb-6">
                <Layers className="size-3" />
                The Tally Advantage
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight leading-tight text-white">
                Multi-Turn <br />
                <span className="text-[#FF7B00]">Native Evaluation.</span>
              </h2>
              <p className="text-lg text-neutral-400 mb-10 leading-relaxed">
                Grading single responses ignores the conversation. An agent can be polite, relevant, and <span className="text-white font-medium">completely fail</span> to solve the user's problem. Tally evaluates tool usage, message history, and state transitions as first-class citizens.
              </p>
              
              <div className="space-y-6">
                {[
                  { 
                    title: 'Beyond Row-by-Row', 
                    desc: 'Evaluate the full trajectory, not just individual responses in isolation.',
                    icon: History 
                  },
                  { 
                    title: 'Step-Level Precision', 
                    desc: 'Pinpoint exactly which turn or tool call caused an evaluation failure.',
                    icon: Target 
                  },
                  { 
                    title: 'Conversation Verdicts', 
                    desc: '"Did the agent actually book the flight by step 5?" — not just "was this response polite?"',
                    icon: TrendingUp 
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="size-10 rounded-xl bg-[#FF7B00]/10 text-[#FF7B00] flex items-center justify-center shrink-0">
                      <item.icon className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-bold tracking-tight text-white">{item.title}</h4>
                      <p className="text-sm text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 bg-[#FF7B00]/5 rounded-full blur-3xl" />
              <div className="relative space-y-4">
                {/* Visualizing a conversation trace being evaluated */}
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm shadow-sm flex items-center gap-4 translate-x-4">
                  <div className="size-8 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-white">U</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-24 bg-neutral-700 rounded" />
                    <div className="h-2 w-32 bg-neutral-800 rounded" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-[#FF7B00]/30 bg-[#FF7B00]/5 backdrop-blur-sm shadow-md flex items-center gap-4 scale-105 z-10 relative">
                  <div className="size-8 rounded-full bg-[#FF7B00] text-white flex items-center justify-center text-[10px] font-bold">A</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-40 bg-[#FF7B00]/40 rounded" />
                    <div className="h-2 w-20 bg-[#FF7B00]/20 rounded" />
                  </div>
                  <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold tracking-tighter border border-emerald-500/20">
                    RELEVANCE: 0.94
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm shadow-sm flex items-center gap-4 -translate-x-4 opacity-60">
                  <div className="size-8 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-white">T</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-16 bg-neutral-700 rounded" />
                    <div className="h-2 w-24 bg-neutral-800 rounded" />
                  </div>
                </div>
                
                <div className="pt-8 flex justify-center">
                  <div className="px-6 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 font-black text-sm tracking-tight shadow-xl text-white">
                    CONVERSATION VERDICT: <span className="text-[#FF7B00] italic">PASS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trajectories Section */}
      <section className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 bg-[#FF7B00]/5 rounded-[2.5rem] blur-2xl" />
            <CodeWindow 
              title="trajectory.ts"
              lang="typescript"
              code={`const trajectory = createTrajectory({
  goal: 'Test edge case for payment',
  persona: { description: 'Angry customer' },
  steps: {
    steps: [
      { id: 'start', instruction: 'Ask for refund' },
      { id: 'final', instruction: 'Confirm receipt' }
    ],
    start: 'start',
    terminals: ['final']
  },
  userModel: google('gemini-2.0-flash'),
}, myAgent);

const result = await runTrajectory(trajectory);`}
            />
          </div>
          <div className="space-y-8 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FF7B00]/10 text-[#FF7B00] text-xs font-bold uppercase tracking-wider">
              <TestTube className="size-3" />
              Generation
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-white">
              Don't wait for users. <br />
              <span className="text-[#FF7B00]">Generate your data.</span>
            </h2>
            <p className="text-lg text-neutral-400 leading-relaxed">
              Hand-writing multi-turn conversation logs is tedious and brittle. Use <code className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-sm">@tally-evals/trajectories</code> to simulate impatient, confused, or adversarial users at scale. Works with <span className="text-white">any agent framework</span>.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: 'User Personas', icon: MessageSquare },
                { title: 'Step-Graph Paths', icon: Workflow },
                { title: 'Stress Testing', icon: Shield },
                { title: 'Framework Agnostic', icon: Cpu }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#FF7B00]/10 text-[#FF7B00] flex items-center justify-center">
                    <item.icon className="size-4" />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-white">{item.title}</span>
                </div>
              ))}
            </div>
            <Link 
              href="/docs/trajectories" 
              className="inline-flex items-center gap-2 text-sm font-black text-[#FF7B00] hover:gap-3 transition-all"
            >
              Learn about Trajectories <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-y border-neutral-900 bg-black">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.3em] mb-12">
            Works natively with your stack
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-12">
             <div className="flex items-center gap-3">
               <img src="/vercel-ai.png" alt="AI SDK" className="size-10" />
               <span className="text-2xl font-black tracking-tighter text-white">AI SDK</span>
             </div>
             <div className="flex items-center gap-3">
               <img src="/mastra.png" alt="Mastra" className="size-10" />
               <span className="text-2xl font-black tracking-tighter text-white">Mastra</span>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight leading-tight text-white">Everything you need.</h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Engineering primitives, not just scripts. A complete reliability stack with debugging tools built in.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Terminal}
            title="TUI & Dev Server"
            description="Visualize traces, debug failures, and analyze results in a beautiful terminal interface or local dev server."
            badge="Developer Experience"
          />
          <FeatureCard 
            icon={CheckCircle2}
            title="Compile-Time Safety"
            description="Catch misconfigured metrics and missing scorers before runtime. If it builds, it runs."
            badge="Type-Safe"
          />
          <FeatureCard 
            icon={SlidersHorizontal}
            title="Decoupled Policy"
            description="Same metrics, different thresholds. Pass at 0.6 in dev, 0.8 in staging, 0.95 in prod. Zero code duplication."
            badge="Flexible"
          />
          <FeatureCard 
            icon={Search}
            title="Composable Metrics"
            description="Mix LLM-based graders with code assertions. Metrics → Scorers → Evals, all reusable TypeScript objects."
            badge="Modular"
          />
          <FeatureCard 
            icon={Activity}
            title="Aggregator Engine"
            description="Statistical summaries for your entire dataset. Mean, Pass Rate, Percentiles, and custom aggregators."
            badge="Analytics"
          />
          <FeatureCard 
            icon={Shield}
            title="CI/CD Ready"
            description="Lightweight and fast. Run evaluations in your PR workflow to catch regressions before your users do."
            badge="Production"
          />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-40 px-6 relative overflow-hidden bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="relative p-12 md:p-24 rounded-[3rem] bg-neutral-900 border border-neutral-800 text-white text-center overflow-hidden">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 size-[30rem] bg-[#FF7B00]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-[30rem] bg-[#FF7B00]/5 rounded-full blur-3xl" />
            
            <h2 className="text-5xl md:text-7xl font-black mb-10 tracking-tight relative leading-[1.1]">
              Start measuring <br />what matters.
            </h2>
            <p className="text-xl md:text-2xl text-neutral-400 mb-16 max-w-xl mx-auto relative font-medium leading-relaxed">
              From vibes to verdicts. Deploy on Friday, sleep on Saturday.
            </p>
            
            <div className="max-w-md mx-auto relative mb-16">
              <InstallCommand command="bun add @tally-evals/tally" />
            </div>

            <div className="flex flex-wrap justify-center gap-6 relative z-10">
              <Link
                href="/docs/tally/getting-started"
                className="inline-flex items-center gap-3 px-12 py-6 rounded-xl bg-[#FF7B00] hover:bg-[#FF8C1A] text-white font-semibold text-lg transition-colors"
              >
                Go to Docs
                <ArrowRight className="size-6" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer-ish */}
      <footer className="py-20 text-center bg-black">
        <div className="flex justify-center gap-8 text-sm font-bold uppercase tracking-[0.2em] mb-4 text-neutral-500">
          <Link href="/docs/tally" className="hover:text-[#FF7B00] transition-colors">Tally</Link>
          <Link href="/docs/trajectories" className="hover:text-[#FF7B00] transition-colors">Trajectories</Link>
          <Link href="/docs/core" className="hover:text-[#FF7B00] transition-colors">Core</Link>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
          The Evaluation Stack for Reliable Agents.
        </p>
      </footer>
    </main>
  );
}
