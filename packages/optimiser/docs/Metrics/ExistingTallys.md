# Optimizer Metrics Reference

This folder primarily point to metrics that already exist in Tally and can be used by the Optimizer.


## Single-turn metrics

These run on one step at a time.

### `createAnswerRelevanceMetric`

- Scope: single-turn
- Type: LLM-based
- Use for Optimizer: detecting whether a response actually answers the user request

### `createAnswerSimilarityMetric`

- Scope: single-turn
- Type: code-based
- Use for Optimizer: comparing a response against an expected target response

### `createCompletenessMetric`

- Scope: single-turn
- Type: LLM-based
- Use for Optimizer: checking whether the response covers the expected points

### `createToxicityMetric`

- Scope: single-turn
- Type: LLM-based
- Use for Optimizer: safety and guardrail checks on individual responses

### `createToolCallAccuracyMetric`

- Scope: single-turn
- Type: code-based
- Use for Optimizer: checking whether expected tool calls were made correctly in a step

## Multi-turn metrics

These run on the full conversation.

### `createRoleAdherenceMetric`

- Scope: multi-turn
- Type: LLM-based
- Use for Optimizer: checking whether the agent stays in the intended role across the conversation

### `createGoalCompletionMetric`

- Scope: multi-turn
- Type: LLM-based
- Use for Optimizer: checking whether the agent successfully completes the overall conversation goal

### `createTopicAdherenceMetric`

- Scope: multi-turn
- Type: LLM-based
- Use for Optimizer: checking whether the agent stays on the intended topic through the conversation

### `createToolCallAccuracyMultiTurnMetric`

- Scope: multi-turn
- Type: code-based
- Use for Optimizer: checking tool call behavior across the full conversation

## Recommended usage

For Optimizer v4, a practical default split is:

- Primary candidate score: mean `OverallQuality`
- Single-turn analysis: `createAnswerRelevanceMetric`, `createCompletenessMetric`, `createToxicityMetric`, `createToolCallAccuracyMetric`
- Multi-turn analysis and guardrails: `createRoleAdherenceMetric`, `createGoalCompletionMetric`, `createTopicAdherenceMetric`, `createToolCallAccuracyMultiTurnMetric`

