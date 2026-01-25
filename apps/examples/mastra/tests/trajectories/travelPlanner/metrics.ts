import { Conversation, defineMultiTurnLLM, defineBaseMetric, MultiTurnMetricDef } from "@tally-evals/tally";
import { extractTextFromMessage } from "@tally-evals/tally/metrics";
import { createMinMaxNormalizer } from "@tally-evals/tally/normalization";
import { LanguageModel } from "ai";

export interface KnowledgeRetentionOptions {
  /**
   * Tracked parameters (optional)
   * Pieces of information that the assistant should track throughout the conversation
   */
  parameters?: string[];
  /**
   * LLM provider for goal completion analysis (required)
   */
  provider: LanguageModel;
}

// Custom Knowledge Retention Metric for Travel Planner
export const createKnowledgeRetentionMetric = (
  options: KnowledgeRetentionOptions,
) => {
  const { parameters, provider } = options;

  const base = defineBaseMetric({
    name: 'knowledgeRetention',
    valueType: 'number',
    description:
      'Measures how well the assistant retains and uses information from earlier parts of the conversation',
  });

  const metric = defineMultiTurnLLM<number>({
    base,
    provider,
    runOnContainer: async (conversation) => {
      const conversationText = conversation.steps
        .map((step, index) => {
          const userText = extractTextFromMessage(step.input);
          const assistantText = step.output
            .map(extractTextFromMessage)
            .filter((text) => text.length > 0)
            .join('\n\n');
          return `Turn ${index + 1
            }:\nUser: ${userText}\nAssistant: ${assistantText}`;
        })
        .join('\n\n');

      return {
        conversationText,
        stepCount: conversation.steps.length,
      };
    },
    prompt: {
      instruction: `You are evaluating knowledge retention in a travel planning conversation.

      **Parameters to Track:** ${parameters
          ? parameters.join(', ')
          : 'Things like (destination, dates, preferences) if they are brought up'
        }

      For each parameter, analyze the ENTIRE conversation and:
      1. Identify when the parameter value is first established
      2. Find all subsequent mentions or uses of that parameter
      3. Check for contradictions or inconsistencies
      4. Identify cases where the assistant asks for information already provided
      5. Verify the assistant uses retained information when relevant
      6. If the parameter is never mentioned, provide a reason why it was not needed and exclude it from the analysis

      Full Conversation:
      {{conversationText}}

      For each tracked parameter, provide:
      - First mentioned: [turn number and value]
      - Consistency: [any contradictions?]
      - Unnecessary re-asks: [did assistant ask for this again?]
      - Proper usage: [did assistant use this info appropriately in later turns?]

      Then score overall retention 0-5 based on accuracy and consistency across ALL turns.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate knowledge retention based on:
1. Information Recall: Does the assistant remember key details (${parameters
          ? `SPECIFICALLY ${parameters.join(', ')}`
          : 'destinations, dates, preferences'
        }) mentioned earlier?
2. Reference Quality: When the assistant references earlier information, are the references accurate and helpful?
3. Consistency: Are details about the same trip elements consistent across the conversation?
4. Integration: How well does the assistant integrate earlier information into new responses?
5. Efficiency: Does the assistant avoid asking for information already provided?`,
      scale:
        '0-5 scale where 5 = excellent knowledge retention, 0 = poor retention',
      examples: [
        {
          score: 5,
          reasoning:
            'Assistant perfectly remembers all key details, references them appropriately, maintains consistency, and builds upon earlier information without repetition',
        },
        {
          score: 4,
          reasoning:
            'Assistant remembers most key details and references them well, with minor inconsistencies or occasional missed opportunities to use earlier information',
        },
        {
          score: 3,
          reasoning:
            'Assistant remembers some key details but may miss others or be inconsistent in how it uses earlier information',
        },
        {
          score: 2,
          reasoning:
            'Assistant remembers few key details and frequently asks for information already provided or shows inconsistencies',
        },
        {
          score: 1,
          reasoning:
            'Assistant remembers very little from earlier conversation and often contradicts or ignores previously established information',
        },
        {
          score: 0,
          reasoning:
            'Assistant shows no memory of earlier conversation and treats each turn as completely independent',
        },
      ],
    },
    normalization: {
      normalizer: createMinMaxNormalizer({
        min: 0,
        max: 5,
        clip: true,
      }),
    },
  });

  return metric as MultiTurnMetricDef<number, Conversation>;
};
