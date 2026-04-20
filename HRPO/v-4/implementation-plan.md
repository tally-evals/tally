# HRPO v4 Implementation Plan

## Goal

The system should optimize the **agent under evaluation**.

The system should:

1. Generate one fixed trajectory set at the start of an optimization job for the agent under evaluation.
2. Keep that trajectory set fixed for the whole optimization job.
3. Evaluate one prompt candidate of the agent under evaluation per cycle on that same fixed set.
4. Use Tally as the source of truth for scoring each conversation produced by the agent under evaluation.
5. Aggregate those conversation results into one candidate score.
6. Use the optimizer to generate the next candidate for the agent under evaluation.
7. Stop when the configured stopping criteria are reached.
8. After the optimization job stops, compare all generated candidates and accept the one that performed best.

## v3 Core Rule

The architecture should be stated as plainly as possible:

`agent under evaluation -> fixed trajectory set -> Tally evaluation -> aggregated score -> stop check -> optimizer generates next candidate -> store cycle outputs -> select final candidate`

The optimizer does not optimize Tally.

The optimizer does not optimize the fixed trajectory set.

The optimizer uses the fixed trajectories, Tally outputs, cycle output history, and optimizer hyper parameters to improve the **agent under evaluation**.

## v4 Design Decisions

### 1. What is being optimized

The object being optimized in HRPO v3 is the **agent under evaluation**.

More specifically:

* the optimizer evaluates the current version of the agent under evaluation
* the optimizer reads Tally outputs for that agent
* the optimizer analyzes failures and regressions for that agent
* the optimizer generates the next candidate for that agent
* the optimizer evaluates each generated candidate on the same fixed trajectory set

The fixed trajectory set is evaluation input.

Tally is evaluation machinery.

The optimizer is the component that proposes changes.

The **agent under evaluation** is the thing being optimized.

### 2. Optimization job-scoped data

* One optimization job generates one fixed trajectory set.
* That trajectory set does not change during the optimization job.
* Every candidate of the agent under evaluation in the optimization job is evaluated against the same generated conversations.
* This ensures that changes in score come from changes to the agent under evaluation, not from changes to the evaluation input.

### 3. Source of truth

* Trajectories generate conversations for the agent under evaluation.
* The agent under evaluation produces outputs on those trajectories.
* Tally evaluates those conversations.
* `TallyRunArtifact` remains the canonical evaluation record.
* Any flattened optimizer rows are derived views, not the primary stored schema.

### 4. Evaluation granularity

Each trajectory execution by the agent under evaluation produces one or more runs (conversations).

Each run contains multiple steps (turns).

Tally evaluates at three levels:

1. Step-level (single-turn)

   * evaluates each step independently
   * examples: relevance, completeness
   * each eval returns a score and pass/fail

2. Conversation-level (multi-turn)

   * evaluates the full conversation
   * examples: role adherence, knowledge retention

3. Final scoring

   * Tally produces `OverallQuality`
   * this is one scalar score per conversation

### 5. Candidate scoring

* Primary scalar objective: `OverallQuality`
* Candidate score: mean `OverallQuality` across all evaluated conversations in the fixed trajectory set for the optimization job
* This candidate score belongs to the current candidate of the **agent under evaluation**
* Candidate selection is not determined by that scalar alone; the final choice also depends on whether key non-primary evals remain within allowed bounds
* `OverallQuality` tells you whether a candidate improved on the main objective, while other evals help decide which stored candidate should be finally accepted after the optimization job ends

Example:

```text
Candidate A for the agent under evaluation raises mean OverallQuality from 0.71 to 0.76
but Role Adherence drops badly
then Candidate A is rejected, even though its main scalar score improved
```

v3, keep this explicit:

`candidate_score = mean(OverallQuality for all conversations)`

### 6. Role of other evals

* Other evals do not replace `OverallQuality` as the main scalar objective
* They still directly influence which candidates of the agent under evaluation can be selected at the end
* They are used to detect failures, guide which prompt blocks should be mutated next, and enforce quality constraints during final candidate selection
* They should not be collapsed into a second blended score
* Keep the global scalar score as `OverallQuality`, while treating selected eval outcomes as explicit final-selection conditions
* Certain evals are more important than others, so each eval should have an explicit importance level or weightage that indicates how strongly it should influence final candidate selection, mutation priority, and regression checks

### 7. Cycle output meaning

* One cycle output = one cycle snapshot
* A cycle output stores the candidate of the agent under evaluation, the evaluation results, and the candidate score
* It should be treated as plain cycle state, not a large abstraction layer
* A new cycle output should have knowledge of previous cycle outputs, so the LLM knows the previous history
* It should know which step it has already gone through, so it does not repeat those again
* If something was fixed previously, later cycle outputs should help ensure those things are not broken again after further changes
* The next candidate should reflect on previous cycle outputs, prior mutations, failure summaries, and strong-performing candidates before generating another version of the agent under evaluation

### 8. Prompt representation

Use a simple structured prompt model for the **agent under evaluation**:

```ts
type PromptBlock = {
  blockId: string
  content: string
  mutable: boolean
}

type PromptTemplate = {
  templateId: string
  blocks: PromptBlock[]
}
```

Rules:

* prompts default to a single mutable block (`full-prompt`)
* editable unit is the full prompt but the intended mutation behaviour is selective refinement within that full prompt
* each new candidate is derived from its parent candidate
* the mutated prompt blocks belong to the **agent under evaluation**

### 9. Hyper Parameters

Define the optimizer hyper parameters explicitly.

These hyper parameters are used by the optimizer to generate the next candidate for the **agent under evaluation**.

They should include:

* current prompt candidate: the current version of the agent under evaluation being evaluated
* temperature: handles LLM creativity and response randomness during candidate generation

Temperature meaning:

* low temperature -> more rigid, conservative, and predictable LLM behaviour
* high temperature -> more creative, less predictable LLM behaviour

These hyper parameters are part of the optimization process.

They are not the evaluation target themselves.

They are used to optimize the **agent under evaluation**.

### 10. Buckets

* Buckets are workload partitions only
* They exist for parallel execution
* They are not logical groups, scoring groups, or optimization boundaries

## Failure Signals

The optimizer collects failures from Tally for the **agent under evaluation**.

For each run:

* some step-level evals may pass or fail
* some conversation-level evals may pass or fail
* the run also has a final `OverallQuality` score

The optimizer should collect:

* failed step-level evals
* failed conversation-level evals

This is analysis input only. It does not change scoring logic.

## Failure Summaries

Generate two simple summaries from the failed evals of the **agent under evaluation**.

### 1. Per-turn summary

* aggregates failures across steps
* helps detect issues like incorrect responses, missing information, or weak answers

### 2. Conversation-level summary

* aggregates failures across full runs
* helps detect issues like inconsistency, coherence problems, or poor role adherence

These summaries are used only to decide which prompt blocks of the **agent under evaluation** should be edited next.

## Minimal Runtime Flow

The v4 architecture graph orders the main loop as: **Phase 3 (analyze) → Phase 6 (stop condition) → Phase 4 (generate next candidate) → store cycle output → Phase 2 (next candidate runs)**. The subsection titles below follow implementation steps; **stop before generating the next candidate** matches diagram Phase 6 before Phase 4.

### Phase 1. Start Optimization Job

1. Generate the fixed trajectory set once for the agent under evaluation.
2. Keep those exact generated conversation artifacts unchanged and reuse them for replay and evaluation purposes.
3. Store hashes of those conversation artifacts so later cycles can verify that the original frozen inputs are still unchanged.
4. Record the optimizer configuration and hyper parameters used to optimize the agent under evaluation.

### Phase 2. Run initial candidate

1. Run the current version of the agent under evaluation on the full fixed trajectory set for the optimization job.
2. Store one Tally result per conversation.
3. Compute:

   * candidate score = mean `OverallQuality`
   * guardrail summaries for selected critical evals
4. Save cycle output `0000`.

### Phase 3. Analyze failures

1. Read the Tally results for the cycle output.
2. Collect failed step-level evals from single-turn evaluation.
3. Collect failed conversation-level evals from multi-turn evaluation.
4. Generate:

   * a per-turn summary across failed step-level evals
   * a conversation-level summary across failed multi-turn evals
5. Use those summaries to identify the prompt blocks of the agent under evaluation most likely to need edits.
6. If there are no explicit failures, use low `OverallQuality` runs as fallback analysis input.

### Stop condition (v4 diagram: Phase 6)

Stop when either:

1. `candidate_score >= target_threshold`
2. max cycles is reached
3. no useful mutations remain

Define stopping criteria explicitly:

* stop when the maximum number of cycles `k` has been reached
* stop when one candidate score reaches the configured target threshold
* stop when no useful mutations remain

If there are no clear failures but the threshold is not reached, use low-scoring conversations as the mutation input instead of treating it as an error.

Reaching a stopping criterion ends candidate generation. It does not mean the latest candidate is automatically accepted.

If stopping criteria are met, skip generating another candidate and proceed to final selection (see Phase 7 below).

### Phase 4. Generate next candidate

Run only if the stopping criteria above were **not** met.

1. Start from the latest generated version of the agent under evaluation. APIs should allow an explicitly chosen parent from history for future lookback; the initial implementation may always use the latest candidate.
2. Mutate only the selected mutable blocks of the agent under evaluation.
3. Use optimizer controls such as temperature, cycle output reflection, and mutation logic.
4. Record:

   * parent candidate
   * changed block ids
   * mutation rationale

Generate one candidate per cycle for the **agent under evaluation**.

### Phase 5. Evaluate candidate

1. Run the new candidate of the agent under evaluation on the same fixed trajectory set for the optimization job.
2. Use the same Tally configuration.
3. Compute the new candidate score from `OverallQuality`.
4. Save the evaluation as a new cycle output in the optimization job history.

### Phase 6. Record cycle output

For each cycle, record the result without making the final acceptance decision yet:

1. store the candidate of the agent under evaluation
2. store the evaluation results and candidate score
3. keep the parent relationship and mutation rationale
4. keep optimization job hashes and frozen artifact references auditable

What is allowed to change across cycles:

* the candidate of the agent under evaluation
* the evaluation results
* the candidate score

What is not supposed to change within the same optimization job:

* the optimization job identity
* the frozen trajectory/conversation set
* the hashes for those frozen artifacts

### Phase 7. Select final candidate

After the optimization job stops:

1. Gather all stored cycle outputs, including the initial candidate and every generated candidate.
2. Compare candidates using `OverallQuality` plus the selected guardrail evals.
3. Prefer the candidate that performs best overall without unacceptable regressions on important evals.
4. Record the final accepted candidate, the selected cycle output, and the selection rationale.

## Minimal Stored Artifacts

v3 should store only what it needs.

### Optimization Job manifest

Stores:

* optimization job id
* created time
* trajectory set location
* configuration used for the optimization job
* defined optimizer hyper parameters, including temperature
* identifier of the agent under evaluation being optimized in that optimization job
* final accepted candidate id
* selected cycle output id
* final selection rationale

### Cycle output record

Stores:

* cycle output id
* parent cycle output id
* prompt version or hash for the agent under evaluation
* changed block ids
* per-conversation Tally run references
* aggregated `OverallQuality`
* guardrail summaries
* cycle output reflection summary from previous cycle outputs

This is enough for replay and auditing without building a heavy registry system first.

## Proposed Package Shape

Keep the implementation small.

`packages/hrpo` should start with:

* `optimization-job` - creates and validates the fixed trajectory set for the optimization job
* `prompts` - loads prompt templates and applies block mutations to the agent under evaluation
* `evaluate` - runs Tally over all conversations in the optimization job produced by the agent under evaluation
* `analyze` - summarizes failures and low-scoring conversations for the agent under evaluation
* `select` - compares stored cycle outputs and chooses the final accepted candidate after the optimization job stops
* `optimize` - generates the next candidate for the agent under evaluation using optimizer controls such as temperature

## v3 Non-Goals

Do not add these in v3:

* multiple candidates per cycle
* dynamic trajectory regeneration during an optimization job
* distributed execution
* complex statistical testing
* bucket-aware scoring semantics
* a second optimizer-specific scoring model
* complex weighting across eval layers

## Implementation Order

1. Create `packages/hrpo` with `optimization-job`, `prompt`, `evaluate`, `analyze`, `select`, and `optimize`
2. Add optimization job creation that generates one fixed trajectory set and stores replayable artifacts plus hashes
3. Add initial candidate evaluation of the agent under evaluation and cycle output persistence
4. Add simple failure analysis based on Tally outputs
5. Add block-based prompt mutation for one candidate per cycle of the agent under evaluation
6. Add final candidate selection logic using mean `OverallQuality` plus guardrails over all stored cycle outputs
7. Add loop control for target threshold, max cycles, and stopping criteria

## Bottom Line

v3 should keep the architecture opinionated and easy to explain:

* one agent under evaluation
* one optimizer that improves that agent
* one optimization job
* one fixed trajectory set
* one candidate per cycle
* one primary objective: `OverallQuality`
* one final selection step after the loop ends
* one simple prompt model: named mutable blocks
* one simple analysis path: failed step-level and conversation-level evals guide block mutation
* one cycle output history that remembers previous cycle outputs and reflects before the next mutation

That keeps the good technical corrections from v1, but removes the extra architectural weight that `critique-1` pushed back on. 
