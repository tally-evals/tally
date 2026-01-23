/**
 * @tally/types-lab
 *
 * Experimental package for exploring type-safe report patterns.
 *
 * Files:
 * - 01-problem.ts: Demonstrates the current type-safety problem
 * - 02-solution-mapped-types.ts: Solution using registry pattern
 * - 03-solution-builder.ts: Solution using builder pattern
 * - 04-solution-infer-from-array.ts: Array with as const
 * - 05-solution-auto-registry.ts: Auto registry from eval names
 * - 06-realistic-tally-types.ts: ⭐ RECOMMENDED - Full Tally structure alignment
 *
 * Run type-check to verify solutions work:
 *   bun tsc --noEmit
 */

// Re-export with namespaces to avoid conflicts
export * as Problem from "./01-problem";
export * as SolutionRegistry from "./02-solution-mapped-types";
export * as SolutionBuilder from "./03-solution-builder";
export * as SolutionArray from "./04-solution-infer-from-array";
export * as SolutionAutoRegistry from "./05-solution-auto-registry";
export * as RealisticTallyTypes from "./06-realistic-tally-types";
