/**
 * Demand Letter Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete demand letter creation flow
 */
export const demandLetterGoldenTrajectory: Trajectory = {
  goal: 'Create a demand letter for an unpaid invoice successfully',
  persona: {
    name: 'Business Owner',
    description:
      'You need to create a legal demand letter. You provide information as the agent guides you through the process. You are professional and want to ensure all required information is included.',
    guardrails: [
      'Answer each agent question succinctly and accurately',
      'Do not volunteer extra topics; follow the questionnaire order',
      'When offered options, pick exactly one of the listed options verbatim',
      'If unsure, say you are unsure',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction:
          'When the agent asks about the dispute type (Q1), answer "Goods bought or sold".',
      },
      {
        id: 'step-2',
        instruction:
          'When asked who you\'re representing (Q2), answer "Myself".',
      },
      {
        id: 'step-3',
        instruction:
          'Provide your name (Q3). Use a realistic business owner name like "John Smith".',
      },
      {
        id: 'step-4',
        instruction:
          'When asked for the recipient name (Q7), provide a business name like "Acme Corp".',
      },
      {
        id: 'step-5',
        instruction:
          'Explain your relationship with the other party (Q8). Be concise, e.g., "They are my supplier".',
      },
      {
        id: 'step-6',
        instruction:
          'Tell your side of the story (Q9). Provide a clear, professional account of the dispute, including specific details about what happened.',
      },
      {
        id: 'step-7',
        instruction:
          'Add key events and dates (Q10). Provide specific dates when relevant events occurred, e.g., "Invoice issued on January 15, 2025; payment due February 15, 2025".',
      },
      {
        id: 'step-8',
        instruction:
          'When asked if the other party owes money (Q11), answer "Yes".',
      },
      {
        id: 'step-9',
        instruction:
          'Provide the amount owed (Q12). Give a specific currency amount, e.g., "$5,000".',
      },
      {
        id: 'step-10',
        instruction:
          'State when payment was due (Q13). Provide a date or timeframe, e.g., "February 15, 2025".',
      },
      {
        id: 'step-11',
        instruction:
          'Describe negative impacts (Q14). Explain how the non-payment has affected you, e.g., "Cash flow problems and inability to pay my own suppliers".',
      },
      {
        id: 'step-12',
        instruction:
          'Propose a fair resolution (Q15). Suggest a specific outcome, e.g., "Payment of the full invoice amount of $5,000 within 10 days".',
      },
      {
        id: 'step-13',
        instruction:
          'When asked if you discussed this before (Q16), answer "No".',
      },
      {
        id: 'step-14',
        instruction:
          'Provide additional context (Q18). Add any other relevant information, e.g., "I have email records of the agreement".',
      },
      {
        id: 'step-15',
        instruction:
          'When asked for a response deadline (Q19), provide a reasonable timeframe, e.g., "Within 14 days".',
      },
      {
        id: 'step-16',
        instruction:
          'Provide your email address (Q20). Use a professional email format, e.g., "john.smith@business.com".',
      },
      {
        id: 'step-17',
        instruction:
          'Provide the recipient\'s email address (Q21). Use a business email format, e.g., "billing@acmecorp.com".',
      },
      {
        id: 'step-18',
        instruction:
          'Review the generated demand letter preview and confirm it looks good.',
      },
    ],
    start: 'step-1',
    terminals: ['step-18'],
  },
  maxTurns: 50,
  storage: {
    strategy: 'local',
    conversationId: 'demand-letter-golden',
  },
  userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Incomplete information, changing requirements, edge cases
 */
export const demandLetterCurveTrajectory: Trajectory = {
  goal: 'Test agent handling of incomplete information and changing requirements',
  persona: {
    name: 'Uncertain Business Owner',
    description:
      'You need a demand letter but sometimes provide incomplete information or change your mind about details. You might forget important information or be vague.',
    guardrails: [
      'Answer the current question, but sometimes omit details or provide vague responses',
      'If a question is unclear, ask for clarification',
      'Provide corrections when you realize earlier answers were wrong',
      'When offered options, pick exactly one of the listed options verbatim (even if you might change it later)',
      'Sometimes provide minimal information first, then elaborate when prompted',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction:
          'When the agent asks about the dispute type (Q1), answer "Something else" to be vague.',
      },
      {
        id: 'step-2',
        instruction:
          'When asked who you\'re representing (Q2), answer "A business".',
      },
      {
        id: 'step-3',
        instruction:
          'When asked for business name (Q4), provide a vague response first, e.g., "My company". Later, clarify it if asked.',
      },
      {
        id: 'step-4',
        instruction:
          'When asked for recipient name (Q7), initially give an incomplete answer like a first name only, then provide full name if the agent asks for clarification.',
      },
      {
        id: 'step-5',
        instruction:
          'Explain relationship (Q8) vaguely at first, e.g., "We know each other". When pressed, elaborate slightly.',
      },
      {
        id: 'step-6',
        instruction:
          'Tell your side of the story (Q9) with minimal details. Later correct or add details if the agent questions you.',
      },
      {
        id: 'step-7',
        instruction:
          'Skip adding key events and dates (Q10) by saying "Not really applicable" or similar.',
      },
      {
        id: 'step-8',
        instruction:
          'When asked if the other party owes money (Q11), hesitate and then answer "Yes".',
      },
      {
        id: 'step-9',
        instruction:
          'Provide an amount (Q12) but be uncertain about it, e.g., "I think around $3,000, maybe $3,500?".',
      },
      {
        id: 'step-10',
        instruction:
          "When asked about payment due date (Q13), say you're not sure or provide a vague timeframe.",
      },
      {
        id: 'step-11',
        instruction:
          'When asked about negative impacts (Q14), say "Not really any major ones" or downplay them.',
      },
      {
        id: 'step-12',
        instruction:
          'Propose a resolution (Q15) that is vague or changes, e.g., "I want them to fix things" instead of specific monetary terms.',
      },
      {
        id: 'step-13',
        instruction: 'When asked if discussed before (Q16), answer "Yes".',
      },
      {
        id: 'step-14',
        instruction:
          'Describe previous discussion (Q17) vaguely, e.g., "We talked about it but it didn\'t go well".',
      },
      {
        id: 'step-15',
        instruction:
          "When asked for other information (Q18), say there's nothing else or provide something marginally relevant.",
      },
      {
        id: 'step-16',
        instruction:
          'For response deadline (Q19), give an unclear answer like "Soon" or "ASAP".',
      },
      {
        id: 'step-17',
        instruction:
          'Provide your email (Q20) but double-check it or ask if it needs to be professional.',
      },
      {
        id: 'step-18',
        instruction:
          'Provide recipient email (Q21) with hesitation or uncertainty about the correct address.',
      },
      {
        id: 'step-19',
        instruction:
          'Review the preview and express uncertainty about whether all details are correct.',
      },
    ],
    start: 'step-1',
    terminals: ['step-19'],
  },
  maxTurns: 50,
  storage: {
    strategy: 'local',
    conversationId: 'demand-letter-curve',
  },
  userModel: google('models/gemini-2.5-flash-lite'),
};
