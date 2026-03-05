import { defineConfig } from "@tally-evals/core";

export default defineConfig({
  defaults: {
    maxRetries: 3,
    temperature: 0,
  },
  trajectories: {
    maxTurns: 10,
    generateLogs: true,
    loopDetection: {
      maxConsecutiveSameStep: 3,
    },
  },
  evaluation: {
    parallelism: 5,
    timeout: 30000,
  },
  storage: {
    backend: "local",
    autoCreate: true,
    path: ".tally",
  }
})