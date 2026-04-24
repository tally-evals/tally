import { PreviousCandidatePromptNotFoundError } from './errors';
import type { OptimizationJobStore } from './optimizationJobStore';
import type { CandidatePrompt, CandidatePromptInput } from './types';

const DEFAULT_SYSTEM = `You improve an agent's instruction text (system / full-prompt) using evaluation results.
You are given the previous instruction, the last cycle's Tally roll-up, and a structured failure list.
Write a single replacement instruction. Output only the new instruction text—no preface, no markdown code fences, no commentary.`;

/**
 * Injected LLM call. The consumer usually wraps `generateText` from the `ai` package and maps
 * `model` to a `LanguageModel`.
 */

// generates the next candidate prompt text 
export type GenerateNextCandidatePromptText = (args: {
  system: string;
  user: string;
  model: string;
  temperature?: number;
}) => Promise<string>;

export type CreateCandidatePromptOptions = {
  generateText: GenerateNextCandidatePromptText;
};

// builds the user prompt for the next candidate using the previous prompt text, the cycle output, and the analysis
function buildUserPromptForNextCandidate(
  input: CandidatePromptInput,
  previousPromptText: string
): string {
  const { cycleOutput, analysis } = input;
  return [
    '## Previous instruction',
    previousPromptText,
    '',
    '## Last cycle',
    `cycleOutputId: ${cycleOutput.cycleOutputId}`,
    `candidateAgentId: ${cycleOutput.candidateAgentId}`,
    `aggregatedPassRate: ${cycleOutput.aggregatedPassRate}`,
    '',
    '## Tally artifacts (refs)',
    JSON.stringify(cycleOutput.tallyArtifacts, null, 2),
    '',
    '## EvalSummaries (JSON)',
    JSON.stringify(
      {
        singleTurn: cycleOutput.evalSummaries.singleTurn,
        multiTurn: cycleOutput.evalSummaries.multiTurn,
      },
      null,
      2
    ),
    '',
    '## Overviews (short text)',
    'singleTurnOverview.summary:',
    cycleOutput.evalSummaries.singleTurnOverview.summary,
    '',
    'multiTurnOverview.summary:',
    cycleOutput.evalSummaries.multiTurnOverview.summary,
    '',
    '## Failure analysis',
    JSON.stringify(analysis, null, 2),
  ].join('\n');
}

/**
 * Produces the next `CandidatePrompt` from the latest cycle output and failure analysis.
 * Resolves the **previous** prompt from the store via `cycleOutput.candidateAgentId` (that candidate
 * must already be registered via `registerCandidate` with a `CandidatePrompt` that includes `promptText`).
 * Calls `options.generateText` with a built-in system + user template.
 */
export async function createCandidatePrompt(
  store: OptimizationJobStore,
  input: CandidatePromptInput,
  options: CreateCandidatePromptOptions
): Promise<CandidatePrompt> {
  const { cycleOutput, generationConfig } = input;
  const previous = store.getCandidatePrompt(
    cycleOutput.optimizationJobId,
    cycleOutput.candidateAgentId
  );
  if (!previous) {
    throw new PreviousCandidatePromptNotFoundError(
      cycleOutput.optimizationJobId,
      cycleOutput.candidateAgentId
    );
  }
 // generate the next candidate prompt text using the injected LLM call
  const { generateText } = options;
  const user = buildUserPromptForNextCandidate(input, previous.promptText);
  const promptText = await generateText({
    system: DEFAULT_SYSTEM,
    user,
    model: generationConfig.model,
    ...(generationConfig.temperature !== undefined
      ? { temperature: generationConfig.temperature }
      : {}),
  });

  return {
    candidateAgentId: crypto.randomUUID(),
    promptText: promptText.trim(),
    generationConfig,
    createdAt: new Date().toISOString(),
  };
}
