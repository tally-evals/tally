import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from '@ai-sdk/google';
import { TallyStore, stepTracesToConversation } from '@tally-evals/core';
import {
  type FailureAnalysis,
  type OptimizationJobConfig,
  type RunOptimizationJobResult,
  analyzeFailures,
  createInMemoryOptimizationJobStore,
  runOptimizationJob,
} from '@tally-evals/hrpo';
import { type Eval, runAllTargets } from '@tally-evals/tally';
import { createTrajectory, runTrajectory, withMastraAgent } from '@tally-evals/trajectories';
import { generateText } from 'ai';
import { config as loadDotenv } from 'dotenv';
import { cashflowGoldenTrajectory } from '../../../tests/trajectories/cashflow/definitions';
import { createCashflowGoldenEvals } from '../../../tests/trajectories/cashflow/evals';
import {
  CASHFLOW_COPILOT_SYSTEM_PROMPT,
  createCashflowCopilotAgent,
} from '../agents/cashflow-copilot-agent';

// Used for evals, prompt optimisation (next-candidate generation), and other LLM calls in this runner.
const DEFAULT_MODEL_ID = 'models/gemini-3.1-flash-lite-preview';

/** Under `.tally/optimiser/` we write `agent/<evaluation name>/<jobId>/…`. */
const OPTIMISER_AGENT_SEGMENT = 'agent';
const OPTIMISER_EVALUATION_NAME = 'Cashflow';
type CycleFailureAnalysisRecord = {
  cycleOutputId: string;
  candidateAgentId: string;
  analysis: FailureAnalysis;
};
type PersistedRunCashflowOptimizationResult = RunOptimizationJobResult & {
  metadata: {
    generatedAt: string;
    maxCyclesConfigured: number;
    completedCycles: number;
    selectedCandidateAgentId: string;
    selectedCycleOutputId: string;
  };
  cycleFailureAnalyses: CycleFailureAnalysisRecord[];
};

export const DEFAULT_CASHFLOW_OPTIMIZATION_CONFIG: OptimizationJobConfig = {
  maxCycles: 3,
  acceptanceThreshold: 0.95, 
  evaluationPolicy: {
    evalWeights: {
      'Overall Quality': 0.25,
      'Role Adherence': 0.15,
      'Affordability Decision': 0.15,
      'Answer Relevance': 0.1,
      'Clarification Precision': 0.1,
      'Over Clarification': 0.1,
      Completeness: 0.05,
      'Context Precision': 0.05,
      'Context Recall': 0.05,
    },
    requiredEvals: ['Overall Quality', 'Role Adherence'],
  },
};

export type RunCashflowOptimizationOptions = {
  config?: OptimizationJobConfig;
  evals?: readonly Eval[];
  generateLogs?: boolean;
  initialPromptText?: string;
};

function getPackageRoot(): string {
  return resolve(fileURLToPath(new URL('../../..', import.meta.url)));
}

function loadEnv(): void {
  const pkgRoot = getPackageRoot();
  loadDotenv({ path: join(pkgRoot, '.env.local') });
  loadDotenv({ path: join(pkgRoot, '.env') });
}

function requireGoogleApiKey(): void {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY is required to run cashflow optimization with live trajectories and evals.'
    );
  }
}

function buildInitialPrompt(promptText: string) {
  return {
    candidateAgentId: crypto.randomUUID(),
    promptText,
    generationConfig: {
      model: DEFAULT_MODEL_ID,
      temperature: 0.2,
    },
    createdAt: new Date().toISOString(),
  };
}

function buildRunId(args: {
  optimizationJobId: string;
  trajectoryId: string;
  candidateAgentId: string;
}): string {
  return `${args.optimizationJobId}-${args.trajectoryId}-${args.candidateAgentId}`;
}

function formatSummary(result: RunOptimizationJobResult): string {
  const selectedCycleOutputId = result.finalDecision.selectedCycleOutputId;
  const lines = [
    '# Cashflow Optimization Summary',
    '',
    `Job: ${result.job.optimizationJobId}`,
    `Max cycles configured: ${result.job.config.maxCycles}`,
    `Cycles completed: ${result.cycleOutputs.length}`,
    `Stop reason: ${result.lastStop.reason}`,
    `Selected candidate: ${result.finalDecision.acceptedCandidateAgentId}`,
    `Selected cycle output: ${result.finalDecision.selectedCycleOutputId}`,
    `Selection reason: ${result.finalDecision.reason}`,
    '',
    '## Cycles',
  ];

  for (const [index, cycle] of result.cycleOutputs.entries()) {
    const isSelected = cycle.cycleOutputId === selectedCycleOutputId;
    const marker = isSelected ? ' [SELECTED]' : '';
    const analysis = analyzeFailures({ cycleOutput: cycle });
    lines.push(`- Cycle ${index + 1}${marker}`);
    lines.push(`  - Candidate: ${cycle.candidateAgentId}`);
    lines.push(`  - Cycle output id: ${cycle.cycleOutputId}`);
    lines.push(`  - Aggregated pass rate: ${cycle.aggregatedPassRate.toFixed(4)}`);
    lines.push(
      `  - Single-turn overview: ${cycle.evalSummaries.singleTurnOverview.summary || '(empty)'}`
    );
    lines.push(
      `  - Multi-turn overview: ${cycle.evalSummaries.multiTurnOverview.summary || '(empty)'}`
    );
    lines.push(`  - Failure analysis: ${analysis.failures.length} failure item(s)`);
    if (analysis.failures.length > 0) {
      lines.push(`  - Failure target blocks: ${analysis.targetBlocks.join(', ')}`);
      for (const failure of analysis.failures) {
        lines.push(
          `    - [${failure.level}] ${failure.eval}: ${failure.reason ?? 'failing or missing verdict'}`
        );
      }
    }
  }

  return lines.join('\n');
}

function buildPersistedResult(
  result: RunOptimizationJobResult
): PersistedRunCashflowOptimizationResult {
  return {
    ...result,
    metadata: {
      generatedAt: new Date().toISOString(),
      maxCyclesConfigured: result.job.config.maxCycles,
      completedCycles: result.cycleOutputs.length,
      selectedCandidateAgentId: result.finalDecision.acceptedCandidateAgentId,
      selectedCycleOutputId: result.finalDecision.selectedCycleOutputId,
    },
    cycleFailureAnalyses: result.cycleOutputs.map((cycleOutput) => ({
      cycleOutputId: cycleOutput.cycleOutputId,
      candidateAgentId: cycleOutput.candidateAgentId,
      analysis: analyzeFailures({ cycleOutput }),
    })),
  };
}

async function writeSummaryArtifacts(result: RunOptimizationJobResult): Promise<{
  summaryPath: string;
  resultPath: string;
  cycleOutputPaths: string[];
}> {
  const pkgRoot = getPackageRoot();
  // `.tally/optimiser/agent/Cashflow/<jobId>/` — short filenames below (summary.md, result.json, cycles/).
  const outputDir = join(
    pkgRoot,
    '.tally',
    'optimiser',
    OPTIMISER_AGENT_SEGMENT,
    OPTIMISER_EVALUATION_NAME,
    result.job.optimizationJobId
  );
  await mkdir(outputDir, { recursive: true });

  const summaryPath = join(outputDir, 'summary.md');
  const resultPath = join(outputDir, 'result.json');
  const persistedResult = buildPersistedResult(result);
  const summaryText = `${formatSummary(result)}\n`;
  const resultText = `${JSON.stringify(persistedResult, null, 2)}\n`;

  await writeFile(summaryPath, summaryText, 'utf8');
  await writeFile(resultPath, resultText, 'utf8');

  const cyclesDir = join(outputDir, 'cycles');
  await mkdir(cyclesDir, { recursive: true });
  const cycleOutputPaths: string[] = [];
  for (const [index, cycle] of result.cycleOutputs.entries()) {
    const fileName = `cycle-${String(index + 1).padStart(2, '0')}.json`;
    const cyclePath = join(cyclesDir, fileName);
    await writeFile(cyclePath, `${JSON.stringify(cycle, null, 2)}\n`, 'utf8');
    cycleOutputPaths.push(cyclePath);
  }

  return { summaryPath, resultPath, cycleOutputPaths };
}

export async function runCashflowOptimization(
  options: RunCashflowOptimizationOptions = {}
): Promise<RunOptimizationJobResult> {
  loadEnv();
  requireGoogleApiKey();

  const pkgRoot = getPackageRoot();
  const tallyStore = await TallyStore.open({
    cwd: pkgRoot,
    config: {
      storage: {
        backend: 'local',
        path: '.tally/optimiser',
      },
    },
  });

  const evalProvider = google(DEFAULT_MODEL_ID);
  const evals = options.evals ?? createCashflowGoldenEvals({ provider: evalProvider });
  const store = createInMemoryOptimizationJobStore();
  const config = options.config ?? DEFAULT_CASHFLOW_OPTIMIZATION_CONFIG;
  const initialCandidatePrompt = buildInitialPrompt(
    options.initialPromptText ?? CASHFLOW_COPILOT_SYSTEM_PROMPT
  );

  const result = await runOptimizationJob({
    store,
    config,
    trajectories: [cashflowGoldenTrajectory],
    initialCandidatePrompt,
    evals,
    context: runAllTargets(),
    createJobOptions: {
      evalNames: evals.map((evaluation) => evaluation.name),
    },
    runCandidateOnTrajectorySet: async ({ optimizationJobId, attached, candidatePrompt }) => {
      const runs = await Promise.all(
        attached.trajectories.map(async (trajectory, index) => {
          const trajectoryId = attached.trajectoryIds[index] ?? `trj-${index}`;
          const runId = buildRunId({
            optimizationJobId,
            trajectoryId,
            candidateAgentId: candidatePrompt.candidateAgentId,
          });

          const agent = createCashflowCopilotAgent({
            instructions: candidatePrompt.promptText,
          });
          const mastraAgentLike = {
            generate: agent.generate.bind(agent),
          };
          const wrappedAgent = withMastraAgent(
            mastraAgentLike as Parameters<typeof withMastraAgent>[0]
          );
          const trajectoryInstance = createTrajectory(
            {
              ...trajectory,
              conversationId: runId,
            },
            wrappedAgent
          );
          const execution = await runTrajectory(trajectoryInstance, {
            generateLogs: options.generateLogs ?? true,
            trajectoryId: runId,
            store: tallyStore,
          });
          const conversation = stepTracesToConversation(execution.steps, runId);

          return {
            trajectoryId,
            trajectory,
            conversation,
            runId,
          };
        })
      );

      return {
        optimizationJobId,
        candidateAgentId: candidatePrompt.candidateAgentId,
        runs,
      };
    },
    createCandidatePromptOptions: {
      generateText: async ({ system, user, model, temperature }) => {
        const result = await generateText({
          model: google(model),
          system,
          prompt: user,
          ...(temperature !== undefined ? { temperature } : {}),
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingLevel: 'high',
              },
            },
          },
        });
        return result.text;
      },
    },
    // Persist each per-trajectory Tally artifact to the same `.tally` conversation as the run.
    // This makes the optimiser’s evidence browseable in the CLI/viewer.
    persistArtifact: async ({ runId, artifact }) => {
      const conversationId = runId;
      const convRef =
        (await tallyStore.getConversation(conversationId)) ??
        (await tallyStore.createConversation(conversationId));
      const runRef = await convRef.createRun({ type: 'tally', runId: artifact.runId });
      await runRef.save(artifact as never);
      return `.tally/optimiser/conversations/${conversationId}/runs/tally/${artifact.runId}.json`;
    },
  });

  return result;
}

if (import.meta.main) {
  const result = await runCashflowOptimization();
  const artifacts = await writeSummaryArtifacts(result);
  console.log(`Cashflow optimization summary written to ${artifacts.summaryPath}`);
  console.log(`Cashflow optimization result written to ${artifacts.resultPath}`);
  console.log(
    `Wrote ${artifacts.cycleOutputPaths.length} cycle output file(s) under ${join(getPackageRoot(), '.tally', 'optimiser', OPTIMISER_AGENT_SEGMENT, OPTIMISER_EVALUATION_NAME, result.job.optimizationJobId, 'cycles')}`
  );
}
