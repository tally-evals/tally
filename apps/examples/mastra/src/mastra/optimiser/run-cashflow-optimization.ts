import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from '@ai-sdk/google';
import { stepTracesToConversation } from '@tally-evals/core';
import {
  type OptimizationJobConfig,
  type RunOptimizationJobResult,
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

const DEFAULT_MODEL_ID = 'models/gemini-3.1-flash-lite-preview';
type MastraAgentLike = Parameters<typeof withMastraAgent>[0];

export const DEFAULT_CASHFLOW_OPTIMIZATION_CONFIG: OptimizationJobConfig = {
  maxCycles: 3,
  acceptanceThreshold: 0.85,
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

function loadEnv(): void {
  const pkgRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
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

function printSummary(result: RunOptimizationJobResult): void {
  console.log('\nCashflow optimization complete.');
  console.log(`Job: ${result.job.optimizationJobId}`);
  console.log(`Cycles: ${result.cycleOutputs.length}`);
  console.log(`Stop reason: ${result.lastStop.reason}`);
  console.log(
    `Selected candidate: ${result.finalDecision.acceptedCandidateAgentId} (${result.finalDecision.selectedCycleOutputId})`
  );

  for (const [index, cycle] of result.cycleOutputs.entries()) {
    console.log(
      `Cycle ${index + 1}: candidate=${cycle.candidateAgentId} aggregatedPassRate=${cycle.aggregatedPassRate.toFixed(4)}`
    );
  }
}

export async function runCashflowOptimization(
  options: RunCashflowOptimizationOptions = {}
): Promise<RunOptimizationJobResult> {
  loadEnv();
  requireGoogleApiKey();

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
          const mastraAgentLike: MastraAgentLike = {
            generate: agent.generate.bind(agent),
          };
          const wrappedAgent = withMastraAgent(mastraAgentLike);
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
        });
        return result.text;
      },
    },
  });

  return result;
}

if (import.meta.main) {
  const result = await runCashflowOptimization();
  printSummary(result);
}
