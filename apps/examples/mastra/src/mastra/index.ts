
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from '~/workflows/weather-workflow';
import { weatherAgent } from '~/agents/weather-agent';
import { travelPlannerAgent } from '~/agents/travel-planner-agent';
import { cashflowCopilotAgent } from '~/agents/cashflow-copilot-agent';


export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, travelPlannerAgent, cashflowCopilotAgent },
  storage: new LibSQLStore({
    url: ":memory:",
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
