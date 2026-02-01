'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Home, Grid, X } from 'lucide-react';
import { TallyLogo } from '@/components/Logo';
import { CodeBlock } from '@/components/CodeBlock';

// Slide data structure
interface Slide {
  id: string;
  section: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  content?: React.ReactNode;
  code?: string;
  note?: string;
}

const slides: Slide[] = [
  // ============================================
  // TITLE
  // ============================================
  {
    id: 'title',
    section: 'Introduction',
    title: 'From Vibes to Verdicts',
    subtitle: 'Engineering Reliable AI Agents with Tally',
    note: 'The Evaluation Stack for Reliable Agents',
  },

  // ============================================
  // PART 1: THE WHY
  // ============================================
  {
    id: 'why-intro',
    section: 'The Why',
    title: "You wouldn't ship code without tests.",
    subtitle: 'Why ship agents with just vibes?',
  },
  {
    id: 'the-problem',
    section: 'The Why',
    title: 'The 80/20 Problem',
    bullets: [
      'Building a chatbot that works 80% of the time is easy',
      'Closing the last 20% is where projects fail',
    ],
  },
  {
    id: 'time-cost',
    section: 'The Why',
    title: 'The Time Cost',
    bullets: [
      'Agents take 3-4 seconds per response',
      '10-turn conversation = 30-40 seconds minimum',
      '5 scenarios × 5 personas = 25 conversations',
      '~15-20 minutes per iteration',
    ],
    note: 'And that\'s just for a quick sanity check',
  },
  {
    id: 'objectivity',
    section: 'The Why',
    title: 'The Objectivity Problem',
    bullets: [
      'Hard to stay objective within a single run',
      'Even harder across multiple runs',
      '"This feels better..." — Confirmation bias',
    ],
  },
  {
    id: 'consistency',
    section: 'The Why',
    title: 'The Consistency Problem',
    bullets: [
      'Hand-writing conversation logs is tedious and brittle',
      'How do you test with different personas?',
      'How do you ensure coverage across edge cases?',
    ],
  },
  {
    id: 'different-testing',
    section: 'The Why',
    title: 'Agents Need Different Testing',
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="text-center p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800">
          <p className="text-neutral-500 text-sm uppercase tracking-widest mb-4">Traditional API</p>
          <p className="text-3xl font-mono text-white">Request → Response</p>
          <p className="text-neutral-500 mt-4">Stateless</p>
        </div>
        <div className="text-center p-8 rounded-2xl bg-[#FF7B00]/5 border border-[#FF7B00]/30">
          <p className="text-[#FF7B00] text-sm uppercase tracking-widest mb-4">Agents</p>
          <p className="text-2xl font-mono text-white">Conversation → State → Context → Decisions</p>
          <p className="text-neutral-400 mt-4">Multi-turn memory, tool usage, goal completion</p>
        </div>
      </div>
    ),
  },
  {
    id: 'row-by-row',
    section: 'The Why',
    title: 'The Row-by-Row Fallacy',
    subtitle: 'Grading single responses ignores the conversation.',
    bullets: [
      'An agent can be polite, relevant, and completely fail to solve the problem',
      'Every response scored 0.9+ on relevance...',
      '...but the flight was never booked.',
    ],
  },
  {
    id: 'univariate',
    section: 'The Why',
    title: 'The Univariate Blindspot',
    subtitle: 'Real quality is multi-dimensional.',
    content: (
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {['Accuracy', 'Tone', 'Completeness', 'Tool Usage', 'Safety', 'Goal Completion'].map((dim) => (
          <div key={dim} className="px-6 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800 text-xl text-neutral-300">
            {dim}
          </div>
        ))}
      </div>
    ),
    note: 'A single "Relevance" score can\'t capture trade-offs',
  },
  {
    id: 'simulation-gap',
    section: 'The Why',
    title: 'The Simulation Gap',
    subtitle: 'You can\'t test edge cases without simulating edge case users.',
    content: (
      <div className="flex justify-center gap-6 mt-8">
        <div className="px-8 py-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center">
          <span className="text-4xl">😤</span>
          <p className="text-neutral-300 mt-2">Impatient</p>
        </div>
        <div className="px-8 py-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center">
          <span className="text-4xl">😕</span>
          <p className="text-neutral-300 mt-2">Confused</p>
        </div>
        <div className="px-8 py-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center">
          <span className="text-4xl">😈</span>
          <p className="text-neutral-300 mt-2">Adversarial</p>
        </div>
      </div>
    ),
    note: 'Production finds bugs you didn\'t test for',
  },

  // ============================================
  // PART 2: WHY TALLY
  // ============================================
  {
    id: 'why-tally-intro',
    section: 'Why Tally',
    title: 'Why Tally?',
    subtitle: 'Filling the gaps in the ecosystem',
  },
  {
    id: 'typescript-gap',
    section: 'Why Tally',
    title: 'The TypeScript Gap',
    bullets: [
      'TypeScript is the most used language for agent development',
      'No native multi-turn evaluation solution for the TS ecosystem',
      'Most solutions are Python-first',
    ],
  },
  {
    id: 'terminology',
    section: 'Why Tally',
    title: 'Clear Terminology',
    content: (
      <div className="space-y-8 mt-8">
        <div className="text-center p-6 rounded-2xl bg-red-500/10 border border-red-500/30">
          <p className="text-2xl text-neutral-500 line-through">Metrics ≈ Scorers ≈ Verdicts ≈ Evals</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-2xl bg-[#FF7B00]/10 border border-[#FF7B00]/30">
            <p className="text-[#FF7B00] text-sm uppercase tracking-widest mb-2">Metrics</p>
            <p className="text-2xl text-white font-bold">Measure</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-[#FF7B00]/10 border border-[#FF7B00]/30">
            <p className="text-[#FF7B00] text-sm uppercase tracking-widest mb-2">Scorers</p>
            <p className="text-2xl text-white font-bold">Combine</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-[#FF7B00]/10 border border-[#FF7B00]/30">
            <p className="text-[#FF7B00] text-sm uppercase tracking-widest mb-2">Evals</p>
            <p className="text-2xl text-white font-bold">Decide</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'type-safety',
    section: 'Why Tally',
    title: 'Compile-Time Safety',
    subtitle: 'If it builds, it runs.',
    bullets: [
      'No runtime errors in eval configs',
      'Full autocomplete and type hints',
      'If a metric is missing, your code won\'t build',
    ],
  },
  {
    id: 'primitives',
    section: 'Why Tally',
    title: 'Clear Primitives',
    code: `const relevance = createAnswerRelevanceMetric({
  provider: model,
})

const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: relevance,
  verdict: thresholdVerdict(0.7),
})`,
  },
  {
    id: 'single-multi',
    section: 'Why Tally',
    title: 'Single-Turn + Multi-Turn',
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800">
          <p className="text-neutral-500 text-sm uppercase tracking-widest mb-4">Single-Turn</p>
          <p className="text-2xl text-white">"Was this response safe and relevant?"</p>
        </div>
        <div className="p-8 rounded-2xl bg-[#FF7B00]/5 border border-[#FF7B00]/30">
          <p className="text-[#FF7B00] text-sm uppercase tracking-widest mb-4">Multi-Turn</p>
          <p className="text-2xl text-white">"Did the agent book the flight by step 5?"</p>
        </div>
      </div>
    ),
  },
  {
    id: 'composable',
    section: 'Why Tally',
    title: 'Composable Scorers',
    subtitle: 'Define "Quality" as a weighted balance of factors.',
    code: `const qualityScorer = createWeightedAverageScorer({
  inputs: [
    { metric: relevance, weight: 0.5 },
    { metric: correctness, weight: 0.3 },
    { metric: brevity, weight: 0.2 },
  ]
})`,
  },
  {
    id: 'decoupled',
    section: 'Why Tally',
    title: 'Decoupled Policy',
    subtitle: 'Same metrics. Different rules per environment.',
    content: (
      <div className="space-y-4 mt-8 max-w-xl mx-auto">
        <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
          <span className="text-neutral-500 text-xl">Dev</span>
          <code className="text-green-400 text-2xl font-mono">score {'>'} 0.6</code>
          <span className="text-neutral-500">Iterate fast</span>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
          <span className="text-neutral-500 text-xl">Staging</span>
          <code className="text-yellow-400 text-2xl font-mono">score {'>'} 0.8</code>
          <span className="text-neutral-500">Catch regressions</span>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
          <span className="text-neutral-500 text-xl">Prod</span>
          <code className="text-red-400 text-2xl font-mono">score {'>'} 0.95</code>
          <span className="text-neutral-500">Safety gates</span>
        </div>
      </div>
    ),
    note: 'Zero code duplication',
  },
  {
    id: 'ecosystem',
    section: 'Why Tally',
    title: 'The Tally Ecosystem',
    content: (
      <div className="space-y-6 mt-8 max-w-2xl mx-auto">
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex items-center gap-6">
          <div className="text-4xl">🎯</div>
          <div>
            <p className="text-[#FF7B00] font-mono text-lg">@tally-evals/trajectories</p>
            <p className="text-neutral-400">The Producer: Generates realistic multi-turn data</p>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex items-center gap-6">
          <div className="text-4xl">⚡</div>
          <div>
            <p className="text-[#FF7B00] font-mono text-lg">@tally-evals/tally</p>
            <p className="text-neutral-400">The Processor: Runs evals and computes scores</p>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex items-center gap-6">
          <div className="text-4xl">🖥️</div>
          <div>
            <p className="text-[#FF7B00] font-mono text-lg">tally-cli</p>
            <p className="text-neutral-400">The Interface: TUI and Dev Server for visualization</p>
          </div>
        </div>
      </div>
    ),
  },

  // ============================================
  // PART 3: TUTORIAL
  // ============================================
  {
    id: 'tutorial-intro',
    section: 'Tutorial',
    title: 'Live Demo',
    subtitle: 'Travel Planner Agent',
    content: (
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {['✈️ Flights', '🏨 Hotels', '🚗 Vehicles', '🍽️ Restaurants', '🌤️ Weather'].map((tool) => (
          <div key={tool} className="px-6 py-4 rounded-xl bg-neutral-900/50 border border-neutral-800 text-xl text-neutral-300">
            {tool}
          </div>
        ))}
      </div>
    ),
    note: 'A multi-tool agent for testing multi-turn evaluation',
  },
  {
    id: 'what-to-test',
    section: 'Tutorial',
    title: 'What We Want to Test',
    bullets: [
      'Does the agent gather required information?',
      'Does it use tools correctly?',
      'Does it remember context across turns?',
      'Does it complete the user\'s goal?',
    ],
  },
  {
    id: 'manual-problem',
    section: 'Tutorial',
    title: 'The Manual Approach',
    subtitle: 'Hand-writing conversation JSON is painful.',
    code: `// Manual conversation data... 😩
const conversation = {
  steps: [
    { input: { role: 'user', content: 'Hi' },
      output: [{ role: 'assistant', content: '...' }] },
    // ... 20 more steps
  ]
}`,
    note: 'Tedious. Brittle. Doesn\'t scale.',
  },
  {
    id: 'trajectories',
    section: 'Tutorial',
    title: 'Introducing Trajectories',
    subtitle: 'AI-as-user simulation',
    bullets: [
      'Define a persona and a step graph',
      'Let the LLM generate realistic conversations',
      'Test with different user types automatically',
    ],
  },
  {
    id: 'persona',
    section: 'Tutorial',
    title: 'Define a Persona',
    code: `persona: {
  name: 'Travel Enthusiast',
  description: 'You are planning a trip...',
  guardrails: [
    'Provide information naturally',
    'Answer clarifying questions',
    'Express preferences when relevant',
  ],
}`,
  },
  {
    id: 'steps',
    section: 'Tutorial',
    title: 'Define Steps',
    code: `steps: {
  steps: [
    { id: 'step-1', instruction: 'Express interest in trip to SF' },
    { id: 'step-2', instruction: 'Provide origin city (New York)' },
    { id: 'step-3', instruction: 'Provide departure date' },
    { id: 'step-4', instruction: 'Confirm round trip needed' },
    { id: 'step-5', instruction: 'Review flight options' },
    // ...
  ],
  start: 'step-1',
  terminals: ['step-18'],
}`,
  },
  {
    id: 'run-trajectory',
    section: 'Tutorial',
    title: 'Run the Trajectory',
    code: `const { conversation } = await runCase({
  trajectory: travelPlannerGoldenTrajectory,
  agent: travelPlannerAgent,
  conversationId: 'travel-planner-golden',
})

// Real multi-turn data!
console.log(conversation.steps.length) // 18+ turns`,
  },
  {
    id: 'curve-ball',
    section: 'Tutorial',
    title: 'Curve Ball: Edge Cases',
    subtitle: 'Same agent, different test scenario.',
    code: `persona: {
  name: 'Indecisive Traveler',
  guardrails: [
    'Provide incomplete information',
    'Change destinations mid-conversation',
    'Be ambiguous about preferences',
    'Backtrack on decisions',
  ],
}`,
  },
  {
    id: 'metrics',
    section: 'Tutorial',
    title: 'Define Metrics',
    code: `const answerRelevance = createAnswerRelevanceMetric({
  provider: model 
})

const completeness = createCompletenessMetric({
  provider: model 
})

const roleAdherence = createRoleAdherenceMetric({
  expectedRole: 'travel planning assistant',
  provider: model,
})`,
  },
  {
    id: 'scorer',
    section: 'Tutorial',
    title: 'Create a Scorer',
    code: `const qualityScorer = createWeightedAverageScorer({
  name: 'OverallQuality',
  output: overallQuality,
  inputs: [
    defineInput({ metric: answerRelevance, weight: 0.3 }),
    defineInput({ metric: roleAdherence, weight: 0.3 }),
    defineInput({ metric: knowledgeRetention, weight: 0.25 }),
    defineInput({ metric: completeness, weight: 0.15 }),
  ],
})`,
  },
  {
    id: 'evals',
    section: 'Tutorial',
    title: 'Define Evals',
    code: `const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: answerRelevance,
  verdict: thresholdVerdict(0.7),
})

const roleEval = defineMultiTurnEval({
  name: 'Role Adherence',
  metric: roleAdherence,
  verdict: thresholdVerdict(0.8),
})`,
  },
  {
    id: 'run-tally',
    section: 'Tutorial',
    title: 'Run Tally',
    code: `const tally = createTally({
  data: [conversation],
  evals: [
    answerRelevanceEval,
    completenessEval,
    roleAdherenceEval,
    overallQualityEval,
  ],
})

const report = await tally.run()`,
  },
  {
    id: 'results',
    section: 'Tutorial',
    title: 'Type-Safe Results',
    code: `const view = report.view()

// Access by step
for (const step of view.steps()) {
  console.log(\`Step \${step.index}: \${step['Answer Relevance'].outcome.verdict}\`)
}

// Access conversation-level
const overall = view.conversation()['Overall Quality']
expect(overall.outcome.verdict).toBe('pass')`,
  },
  {
    id: 'ci',
    section: 'Tutorial',
    title: 'CI Integration',
    subtitle: 'Run evaluations in your PR workflow.',
    content: (
      <div className="mt-8 p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 font-mono text-lg text-center">
        <div className="text-neutral-500">┌─────────────────────────────────────┐</div>
        <div className="text-white">│ Answer Relevance    Pass Rate: 94%  │</div>
        <div className="text-white">│ Role Adherence      Score: 0.87     │</div>
        <div className="text-green-400">│ Overall Quality     ✓ PASS          │</div>
        <div className="text-neutral-500">└─────────────────────────────────────┘</div>
      </div>
    ),
    note: 'Catch regressions before production',
  },

  // ============================================
  // WRAP-UP
  // ============================================
  {
    id: 'takeaways',
    section: 'Wrap-Up',
    title: 'Key Takeaways',
    bullets: [
      'Agent testing is different — multi-turn matters',
      'Simulate realistic users with Trajectories',
      'Compose: Metrics → Scorers → Evals',
      'Get type-safe, actionable results for CI',
    ],
  },
  {
    id: 'get-started',
    section: 'Wrap-Up',
    title: 'Get Started',
    content: (
      <div className="space-y-6 mt-8">
        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 font-mono text-2xl text-center">
          <span className="text-neutral-500">$</span> bun add @tally-evals/tally
        </div>
        <div className="flex justify-center gap-6 mt-12">
          <Link 
            href="/docs/tally/getting-started" 
            className="px-8 py-4 bg-[#FF7B00] hover:bg-[#FF8C1A] text-white font-bold text-xl rounded-xl transition-colors"
          >
            Read the Docs
          </Link>
          <Link 
            href="https://github.com/tally-evals/tally" 
            className="px-8 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xl rounded-xl transition-colors"
          >
            GitHub
          </Link>
        </div>
      </div>
    ),
  },
  {
    id: 'thanks',
    section: 'Wrap-Up',
    title: 'Thank You',
    content: (
      <div className="text-center space-y-8">
        <TallyLogo size={80} className="text-white mx-auto" />
        <p className="text-4xl">
          From <span className="text-neutral-500">vibes</span> to <span className="text-[#FF7B00] font-bold">verdicts</span>.
        </p>
        <p className="text-neutral-500 text-xl">
          github.com/tally-evals/tally
        </p>
      </div>
    ),
  },
];

// Get unique sections
const sections = [...new Set(slides.map(s => s.section))];

export default function TalkPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const slide = slides[currentSlide];

  const goToSlide = useCallback((index: number) => {
    if (index === currentSlide || index < 0 || index >= slides.length) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsTransitioning(false);
    }, 150);
  }, [currentSlide]);

  const goToPrevious = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const goToNext = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showOverview) {
        if (e.key === 'Escape') setShowOverview(false);
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          setShowOverview(true);
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(slides.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, showOverview, goToPrevious, goToNext, goToSlide]);

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Minimal header - appears on hover */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/80 to-transparent">
        <Link href="/" className="flex items-center gap-3 text-neutral-400 hover:text-white transition-colors">
          <Home className="size-5" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-neutral-500 text-sm font-mono">
            {currentSlide + 1} / {slides.length}
          </span>
          <button 
            onClick={() => setShowOverview(true)}
            className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
            title="Overview (Esc)"
          >
            <Grid className="size-5" />
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-900 z-40">
        <div 
          className="h-full bg-[#FF7B00] transition-all duration-300 ease-out"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Main slide content */}
      <main 
        className={`flex-1 flex items-center justify-center p-8 md:p-16 transition-opacity duration-150 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={(e) => {
          // Click to advance (except on links/buttons)
          if ((e.target as HTMLElement).tagName !== 'A' && (e.target as HTMLElement).tagName !== 'BUTTON') {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) {
              goToPrevious();
            } else {
              goToNext();
            }
          }
        }}
      >
        <div className="max-w-5xl w-full mx-auto text-center">
          {/* Section badge */}
          <div className="mb-8">
            <span className="inline-block px-4 py-2 rounded-full bg-[#FF7B00]/10 text-[#FF7B00] text-sm font-bold uppercase tracking-widest">
              {slide.section}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] mb-6">
            {slide.title}
          </h1>

          {/* Subtitle */}
          {slide.subtitle && (
            <p className="text-2xl md:text-3xl text-neutral-400 mb-8">
              {slide.subtitle}
            </p>
          )}

          {/* Bullets */}
          {slide.bullets && (
            <div className="max-w-3xl mx-auto mt-12">
              <ul className="space-y-6 text-left">
                {slide.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl md:text-2xl text-neutral-300">
                    <span className="text-[#FF7B00] mt-1">●</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Custom content */}
          {slide.content && (
            <div className="mt-8">
              {slide.content}
            </div>
          )}

          {/* Code block */}
          {slide.code && (
            <div className="mt-12 max-w-3xl mx-auto text-left">
              <CodeBlock code={slide.code} lang="typescript" />
            </div>
          )}

          {/* Note */}
          {slide.note && (
            <p className="mt-12 text-neutral-500 text-lg italic">
              {slide.note}
            </p>
          )}
        </div>
      </main>

      {/* Navigation hints */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-neutral-600 text-sm opacity-0 hover:opacity-100 transition-opacity">
        <span>← Previous</span>
        <span>|</span>
        <span>Next →</span>
        <span>|</span>
        <span>Esc for overview</span>
      </div>

      {/* Navigation arrows (visible on hover at edges) */}
      <button
        onClick={goToPrevious}
        disabled={currentSlide === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-neutral-900/50 hover:bg-neutral-800 disabled:opacity-0 opacity-0 hover:opacity-100 transition-all text-white"
        style={{ opacity: currentSlide === 0 ? 0 : undefined }}
      >
        <ChevronLeft className="size-8" />
      </button>
      <button
        onClick={goToNext}
        disabled={currentSlide === slides.length - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-neutral-900/50 hover:bg-neutral-800 disabled:opacity-0 opacity-0 hover:opacity-100 transition-all text-white"
        style={{ opacity: currentSlide === slides.length - 1 ? 0 : undefined }}
      >
        <ChevronRight className="size-8" />
      </button>

      {/* Overview modal */}
      {showOverview && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 overflow-y-auto p-8"
          onClick={() => setShowOverview(false)}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Slide Overview</h2>
              <button 
                onClick={() => setShowOverview(false)}
                className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="size-6" />
              </button>
            </div>
            
            {sections.map((section) => (
              <div key={section} className="mb-8">
                <h3 className="text-sm font-bold text-[#FF7B00] uppercase tracking-widest mb-4">
                  {section}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {slides
                    .filter((s) => s.section === section)
                    .map((s) => {
                      const index = slides.findIndex((sl) => sl.id === s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            goToSlide(index);
                            setShowOverview(false);
                          }}
                          className={`
                            p-4 rounded-xl text-left transition-all
                            ${index === currentSlide 
                              ? 'bg-[#FF7B00]/20 border-2 border-[#FF7B00]' 
                              : 'bg-neutral-900 border border-neutral-800 hover:border-neutral-700'
                            }
                          `}
                        >
                          <div className="text-xs text-neutral-500 mb-1">
                            {index + 1}
                          </div>
                          <div className="text-sm font-medium text-white line-clamp-2">
                            {s.title}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
