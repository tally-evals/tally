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
  TrendingUp
} from 'lucide-react';
import { InstallCommand } from '@/components/InstallCommand';
import { CodeWindow, FeatureCard } from '@/components/HomeComponents';

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1 relative">
      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-fd-background [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#3b82f6_100%)] opacity-20" />
      <div className="fixed inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <Link 
            href="/docs/tally/getting-started"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fd-primary/10 text-fd-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-12 border border-fd-primary/20 hover:bg-fd-primary/20 transition-all duration-300 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fd-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-fd-primary"></span>
            </span>
            Tally v0.1 Public Beta
          </Link>
          
          <h1 className="text-6xl md:text-[7.5rem] font-black leading-[0.9] tracking-tighter mb-10 bg-gradient-to-b from-fd-foreground to-fd-foreground/40 bg-clip-text text-transparent">
            Make your <br /> Agents Reliable.
          </h1>
          
          <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mb-14 leading-relaxed font-medium">
            Tally is a **typesafe and composable** LLM evaluation framework. 
            Separate evaluation policy from domain measures. Measure multi-turn trajectories. Build production-grade agents with confidence.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 mb-32">
            <Link
              href="/docs/tally/getting-started"
              className="group inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-fd-primary hover:bg-fd-primary/90 text-fd-primary-foreground font-black shadow-2xl shadow-fd-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="https://github.com/tally-evals/tally"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-fd-background/50 hover:bg-fd-secondary/80 text-fd-secondary-foreground font-black border border-fd-border/50 backdrop-blur-md shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Github className="size-5" />
              Github
            </Link>
          </div>

          {/* Hero Interactive Area */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center text-left">
            <div className="space-y-8 pr-0 lg:pr-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                <Play className="size-3 fill-current" />
                Live Demo
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Composable by value. <br />
                <span className="text-fd-primary">Typesafe by design.</span>
              </h2>
              <p className="text-fd-muted-foreground leading-relaxed">
                Decouple evaluation policy from domain measures. Compose metrics, scorers, and evaluators as first-class TypeScript objects.
              </p>
              <ul className="space-y-4">
                {[
                  'Typesafe object composition',
                  'Phased 5-step execution pipeline',
                  'Support for single and multi-turn targets',
                  'Deterministic, reproducible results'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-semibold">
                    <div className="size-5 rounded-full bg-fd-primary/10 text-fd-primary flex items-center justify-center shrink-0">
                      <Zap className="size-3 fill-current" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 bg-fd-primary/10 rounded-[2.5rem] blur-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
              <CodeWindow title="evaluator.ts">
                <pre className="text-fd-primary/90">
                  <code>{`import { createTally, createEvaluator } from '@tally/core';
import { relevanceMetric } from './metrics';

// Compose by value, not by name
const evaluator = createEvaluator({
  name: 'Agent Quality',
  metrics: [relevanceMetric],
  scorer: createWeightedScorer({
    inputs: [{ metric: relevanceMetric, weight: 1.0 }]
  }),
});

const tally = createTally({ data, evaluators });
const report = await tally.run();`}</code>
                </pre>
              </CodeWindow>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Turn Native Section */}
      <section className="py-32 px-6 border-y bg-fd-muted/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-fd-primary/10 text-fd-primary text-xs font-bold uppercase tracking-wider mb-6">
                <Layers className="size-3" />
                The Tally Advantage
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight leading-tight">
                Multi-Turn <br />
                <span className="text-fd-primary">Native Evaluation.</span>
              </h2>
              <p className="text-lg text-fd-muted-foreground mb-10 leading-relaxed">
                Most frameworks treat LLMs as single-turn completions. Tally is built for the complexity of **agentic trajectories**, evaluating tool usage, message history, and state transitions as first-class citizens.
              </p>
              
              <div className="space-y-6">
                {[
                  { 
                    title: 'Trajectory Context', 
                    desc: 'Metrics have full access to conversation history and metadata.',
                    icon: History 
                  },
                  { 
                    title: 'Step-Level Precision', 
                    desc: 'Pinpoint exactly which turn or tool call caused an evaluation failure.',
                    icon: Target 
                  },
                  { 
                    title: 'Automatic Rollups', 
                    desc: 'Seamlessly aggregate step-level scores into conversation-wide verdicts.',
                    icon: TrendingUp 
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="size-10 rounded-xl bg-fd-primary/5 text-fd-primary flex items-center justify-center shrink-0">
                      <item.icon className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-bold tracking-tight">{item.title}</h4>
                      <p className="text-sm text-fd-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 bg-fd-primary/5 rounded-full blur-3xl" />
              <div className="relative space-y-4">
                {/* Visualizing a conversation trace being evaluated */}
                <div className="p-4 rounded-2xl border bg-fd-background/80 backdrop-blur-sm shadow-sm flex items-center gap-4 translate-x-4">
                  <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">U</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-24 bg-fd-muted rounded" />
                    <div className="h-2 w-32 bg-fd-muted/50 rounded" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-fd-primary/30 bg-fd-primary/5 backdrop-blur-sm shadow-md flex items-center gap-4 scale-105 z-10 relative">
                  <div className="size-8 rounded-full bg-fd-primary text-fd-primary-foreground flex items-center justify-center text-[10px] font-bold">A</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-40 bg-fd-primary/40 rounded" />
                    <div className="h-2 w-20 bg-fd-primary/20 rounded" />
                  </div>
                  <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold tracking-tighter border border-emerald-500/20">
                    RELEVANCE: 0.94
                  </div>
                </div>
                <div className="p-4 rounded-2xl border bg-fd-background/80 backdrop-blur-sm shadow-sm flex items-center gap-4 -translate-x-4 opacity-60">
                  <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">T</div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-16 bg-fd-muted rounded" />
                    <div className="h-2 w-24 bg-fd-muted/50 rounded" />
                  </div>
                </div>
                
                <div className="pt-8 flex justify-center">
                  <div className="px-6 py-3 rounded-2xl bg-fd-secondary border border-fd-border font-black text-sm tracking-tight shadow-xl">
                    CONVERSATION VERDICT: <span className="text-fd-primary italic">PASS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trajectories Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 bg-fd-primary/5 rounded-[2.5rem] blur-2xl" />
            <CodeWindow title="trajectory.ts">
              <pre className="text-fd-primary/90">
                <code>{`const trajectory = createTrajectory({
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

const result = await runTrajectory(trajectory);`}</code>
              </pre>
            </CodeWindow>
          </div>
          <div className="space-y-8 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-fd-primary/10 text-fd-primary text-xs font-bold uppercase tracking-wider">
              <TestTube className="size-3" />
              Generation
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
              Don't wait for users. <br />
              <span className="text-fd-primary">Generate your data.</span>
            </h2>
            <p className="text-lg text-fd-muted-foreground leading-relaxed">
              Use `@tally-evals/trajectories` to simulate multi-turn interactions. Test your agent against personas, goals, and step-graphs before going to production.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: 'Simulate Personas', icon: MessageSquare },
                { title: 'Step-Graph Logic', icon: Workflow },
                { title: 'Adversarial Tests', icon: Shield },
                { title: 'AI SDK Native', icon: Cpu }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                    <item.icon className="size-4" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">{item.title}</span>
                </div>
              ))}
            </div>
            <Link 
              href="/docs/trajectories" 
              className="inline-flex items-center gap-2 text-sm font-black text-fd-primary hover:gap-3 transition-all"
            >
              Learn about Trajectories <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-y bg-fd-muted/20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-fd-muted-foreground uppercase tracking-[0.3em] mb-12 opacity-60">
            Works natively with your stack
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-12 opacity-40 grayscale group hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center gap-3"><div className="size-8 rounded bg-fd-foreground" /><span className="text-2xl font-black tracking-tighter">AI SDK</span></div>
             <div className="flex items-center gap-3"><div className="size-8 rounded-full bg-fd-foreground" /><span className="text-2xl font-black tracking-tighter">Mastra</span></div>
             <div className="flex items-center gap-3"><div className="size-8 border-2 border-fd-foreground" /><span className="text-2xl font-black tracking-tighter">LangChain</span></div>
             <div className="flex items-center gap-3"><div className="size-8 rounded rotate-45 bg-fd-foreground" /><span className="text-2xl font-black tracking-tighter">LlamaIndex</span></div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight leading-tight">Everything you need.</h2>
          <p className="text-xl text-fd-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            A comprehensive toolkit designed for the modern LLM engineer.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Workflow}
            title="Durable Context"
            description="Tally maintains state through every measurement. Caching, resolution, and normalization are handled out of the box."
            badge="Infrastructure"
          />
          <FeatureCard 
            icon={Target}
            title="Branded Scores"
            description="Strict type-safety for measurement results. Tally enforces [0, 1] Score invariants through the entire pipeline."
            badge="Type-Safe"
          />
          <FeatureCard 
            icon={Cpu}
            title="Multi-Turn Native"
            description="Designed for conversation steps, not just prompts. Evaluate tool calls, message history, and state changes."
            badge="Advanced"
          />
          <FeatureCard 
            icon={Search}
            title="Flexible Metrics"
            description="Mix LLM-based graders with code-based assertions. Re-use MetricDefs across multiple scorers and datasets."
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
            title="CI/CD Optimized"
            description="Lightweight and fast. Run evaluations as part of your PR workflow to prevent regression in agent performance."
            badge="Production"
          />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 [background:radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-fd-primary/10 opacity-50" />
        <div className="max-w-5xl mx-auto">
          <div className="relative p-12 md:p-24 rounded-[4rem] bg-fd-primary text-fd-primary-foreground text-center overflow-hidden shadow-[0_0_100px_-20px_rgba(99,102,241,0.5)]">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 size-[30rem] bg-white/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-[30rem] bg-black/20 rounded-full blur-3xl" />
            
            <h2 className="text-5xl md:text-7xl font-black mb-10 tracking-tighter relative leading-[0.9]">
              Start measuring <br />what matters.
            </h2>
            <p className="text-xl md:text-2xl opacity-90 mb-16 max-w-xl mx-auto relative font-medium leading-relaxed">
              Tally is the foundation for your evaluation pipeline. Get started with the beta today.
            </p>
            
            <div className="max-w-md mx-auto relative mb-16 shadow-2xl rounded-2xl">
              <InstallCommand command="pnpm add @tally-evals/tally" />
            </div>

            <div className="flex flex-wrap justify-center gap-6 relative z-10">
              <Link
                href="/docs/tally/getting-started"
                className="inline-flex items-center gap-3 px-12 py-6 rounded-2xl bg-white text-blue-600 font-black text-lg hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 shadow-xl"
              >
                Go to Docs
                <ArrowRight className="size-6" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer-ish */}
      <footer className="py-20 text-center opacity-40">
        <div className="flex justify-center gap-8 text-sm font-bold uppercase tracking-[0.2em] mb-4">
          <Link href="/docs/tally" className="hover:text-fd-primary transition-colors">Tally</Link>
          <Link href="/docs/trajectories" className="hover:text-fd-primary transition-colors">Trajectories</Link>
          <Link href="/docs/core" className="hover:text-fd-primary transition-colors">Core</Link>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-fd-muted-foreground">
          Built for the next generation of LLM Agents.
        </p>
      </footer>
    </main>
  );
}
