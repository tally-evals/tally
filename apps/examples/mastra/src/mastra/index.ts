import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { cashflowCopilotAgent } from '~/agents/cashflow-copilot-agent';
import { travelPlannerAgent } from '~/agents/travel-planner-agent';
import { weatherAgent } from '~/agents/weather-agent';
import { weatherWorkflow } from '~/workflows/weather-workflow';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, travelPlannerAgent, cashflowCopilotAgent },
  storage: new LibSQLStore({
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
});
