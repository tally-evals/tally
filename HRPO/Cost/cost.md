# Optimizer Cost Model

## 1. The cost-driving parts are:

1. Phase 1: generating the fixed trajectory set, if that generation uses an LLM
2. Phase 2 / Phase 5: running the agent under evaluation on each frozen conversation
3. Phase 2.5: Tally evaluation, but only for LLM-backed metrics
4. Phase 3: failure analysis, if it is done with an LLM
5. Phase 4: candidate generation / mutation, if it is done with an LLM


## 2. Exact Runtime Cost Rule


```text
session_cost = sum(totalCost for every model-backed step in the session)
```

That means:

```text
session_cost
= trajectory_generation_cost
+ baseline_candidate_run_cost
+ baseline_tally_eval_cost
+ sum(for each optimization iteration:
     failure_analysis_cost
   + candidate_generation_cost
   + candidate_rerun_cost
   + candidate_tally_eval_cost)
```

If every model-backed step writes `totalCost`, this becomes exact and does not need estimation later.



## 3. LLM-backed metrics cost 

LLM-backed evaluator uses `gemini-2.5-flash-lite`.

LLM-backed metrics that can be used here are:

Tally built-ins:

- single-turn: `createAnswerRelevanceMetric`
- single-turn: `createCompletenessMetric`
- single-turn: `createToxicityMetric`
- multi-turn: `createRoleAdherenceMetric`
- multi-turn: `createGoalCompletionMetric`
- multi-turn: `createTopicAdherenceMetric`

HRPO-specific documented metrics not already implemented in Tally:

- single-turn: `Hallucination`
- single-turn: `GEval`
- single-turn: `Moderation`
- single-turn: `ContextPrecision`
- single-turn: `ContextRecall`

Not counted:

- `AnswerRelevance` in `HRPO/Metrics` is already covered by Tally's `createAnswerRelevanceMetric`
- `ConversationThreadMetric` is a generic multi-turn pattern, not one concrete metric

So if all of the above LLM-backed metrics are enabled without double-counting duplicates:

```text
Single-turn metrics = 8
Multi-turn metrics = 3
```

That means each conversation evaluation uses:

```text
LLM judge calls per conversation
= 8 * number_of_steps_per_conversation + 3
```

## 4. Main takeaways

- The dominant recurring cost in this architecture is the repeated candidate execution plus repeated LLM-based evaluation on the same frozen session set.
- LLM-based evaluation cost grows with the number of conversations, the number of steps per conversation, and the number of optimization iterations.
- The cleanest implementation is to store `totalCost` for every model-backed step and compute the full session cost by summing those step costs.
