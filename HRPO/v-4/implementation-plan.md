# HRPO v4 Implementation Plan

## Goal

The system should optimize the **agent under evaluation**.

The system should:

1. Generate one fixed trajectory set at the start of an optimization session for the agent under evaluation.
2. Keep that trajectory set fixed for the whole session.
3. Evaluate one prompt candidate of the agent under evaluation per iteration on that same fixed set.
4. Use Tally as the source of truth for scoring each conversation produced by the agent under evaluation.
5. Aggregate those conversation results into one candidate score.
6. Use the optimizer to generate the next candidate for the agent under evaluation.
7. Stop when the candidate score reaches the configured target threshold.

## v3 Core Rule

The architecture should be stated as plainly as possible:

`agent under evaluation -> fixed trajectory set -> Tally evaluation -> aggregated score -> optimizer generates next candidate -> re-run agent under evaluation`

The optimizer does not optimize Tally.

The optimizer does not optimize the fixed trajectory set.

The optimizer uses the fixed trajectories, Tally outputs, checkpoint history, and optimizer hyper parameters to improve the **agent under evaluation**.

## v4 Design Decisions

### 1. What is being optimized

The object being optimized in HRPO v3 is the **agent under evaluation**.

More specifically:

* the optimizer evaluates the current version of the agent under evaluation
* the optimizer reads Tally outputs for that agent
* the optimizer analyzes failures and regressions for that agent
* the optimizer generates the next candidate for that agent
* the optimizer re-runs that updated agent on the same fixed trajectory set

The fixed trajectory set is evaluation input.

Tally is evaluation machinery.

The optimizer is the component that proposes changes.

The **agent under evaluation** is the thing being optimized.

### 2. Session-scoped data

* One optimization session generates one fixed trajectory set.
* That trajectory set does not change during the session.
* Every candidate of the agent under evaluation in the session is evaluated against the same generated conversations.
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
* Candidate score: mean `OverallQuality` across all evaluated conversations in the fixed session set
* This candidate score belongs to the current candidate of the **agent under evaluation**
* Candidate selection is not determined by that scalar alone; acceptance also depends on whether key non-primary evals remain within allowed bounds
* `OverallQuality` tells you whether the candidate improved on the main objective, other evals can still block acceptance if they regress too much

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
* They still directly influence which candidates of the agent under evaluation can be accepted
* They are used to detect failures, guide which prompt blocks should be mutated next, and enforce quality constraints during candidate selection
* They should not be collapsed into a second blended score
* Keep the global scalar score as `OverallQuality`, while treating selected eval outcomes as explicit acceptance conditions
* Certain evals are more important than others, so each eval should have an explicit importance level or weightage that indicates how strongly it should influence candidate acceptance, mutation priority, and regression checks

### 7. Checkpoint meaning

* One checkpoint = one iteration snapshot
* A checkpoint stores the candidate of the agent under evaluation, the evaluation results, the candidate score, and the accept/reject decision
* It should be treated as plain iteration state, not a large abstraction layer
* A new checkpoint should have knowledge of previous checkpoints, so the LLM knows the previous history
* It should know which step it has already gone through, so it does not repeat those again
* If something was fixed previously, the new checkpoint should help ensure those things are not broken again after further changes
* The new checkpoint will do a reflection on previous checkpoints, prior mutations, accepted fixes, rejected changes, and failure summaries before generating the next candidate for the agent under evaluation

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
* baseline prompt: the current active version of the agent under evaluation used as the comparison reference
* optimizer system prompt: the system prompt used by the optimizer when generating candidate updates
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

### Phase 1. Start session

1. Generate the fixed trajectory set once for the agent under evaluation.
2. Keep those exact generated conversation artifacts unchanged and reuse them for replay and evaluation purposes.
3. Store hashes of those conversation artifacts so later iterations can verify that the original frozen inputs are still unchanged.
4. Record the optimizer configuration and hyper parameters used to optimize the agent under evaluation.

### Phase 2. Run baseline

1. Run the current version of the agent under evaluation on the full fixed session set.
2. Store one Tally result per conversation.
3. Compute:

   * candidate score = mean `OverallQuality`
   * guardrail summaries for selected critical evals
4. Save checkpoint `0000`.

### Phase 3. Analyze failures

1. Read the Tally results for the checkpoint.
2. Collect failed step-level evals from single-turn evaluation.
3. Collect failed conversation-level evals from multi-turn evaluation.
4. Generate:

   * a per-turn summary across failed step-level evals
   * a conversation-level summary across failed multi-turn evals
5. Use those summaries to identify the prompt blocks of the agent under evaluation most likely to need edits.
6. If there are no explicit failures, use low `OverallQuality` runs as fallback analysis input.

### Phase 4. Generate next candidate

1. Start from the last accepted version of the agent under evaluation.
2. Mutate only the selected mutable blocks of the agent under evaluation.
3. Use optimizer controls such as optimizer system prompt, temperature, checkpoint reflection, and mutation logic.
4. Record:

   * parent candidate
   * changed block ids
   * mutation rationale

Generate one candidate per iteration for the **agent under evaluation**.

### Phase 5. Re-evaluate

1. Run the new candidate of the agent under evaluation on the same fixed session set.
2. Use the same Tally configuration.
3. Compute the new candidate score from `OverallQuality`.
4. Compare it against the current accepted checkpoint.

### Phase 6. Accept or reject

Accept the candidate only if all of the following are true:

1. `candidate_score >= baseline_score + min_delta`
   `min_delta`: minimum improvement threshold
   `baseline_score`: the score of the current active version of the agent under evaluation

2. session hashes still match or the conversation artifacts used in this iteration are the same frozen session artifacts created at session start

What is allowed to change across iterations:

* the candidate of the agent under evaluation
* the evaluation results
* the candidate score
* the accept/reject decision

What is not supposed to change within the same session:

* the session identity
* the frozen trajectory/conversation set
* the hashes for those frozen artifacts

3. important guardrail evals do not drop beyond the allowed tolerance, even if `OverallQuality` improves

Example: if a guardrail pass rate was 0.92 and the allowed tolerance is 0.02, then a drop to 0.91 may still be acceptable, but a drop to 0.86 would cause the candidate to be rejected.

If accepted:

* the candidate becomes the new active version of the agent under evaluation
* the next checkpoint uses this candidate as the baseline

If rejected:

* keep the previous active version of the agent under evaluation
* still store the rejected checkpoint for auditability

### Phase 7. Stop condition

Stop when either:

1. `candidate_score >= target_threshold`
2. max iterations is reached
3. no useful mutations remain

Define stopping criteria explicitly:

* stop when the maximum number of iterations `k` has been reached
* stop when the candidate score of the agent under evaluation reaches the configured target threshold
* stop when no useful mutations remain

If there are no clear failures but the threshold is not reached, use low-scoring conversations as the mutation input instead of treating it as an error.

## Minimal Stored Artifacts

v3 should store only what it needs.

### Session manifest

Stores:

* session id
* created time
* trajectory set location
* conversation artifact hashes
* configuration used for the session
* defined optimizer hyper parameters, including baseline prompt, optimizer system prompt, and temperature
* identifier of the agent under evaluation being optimized in that session

### Checkpoint record

Stores:

* checkpoint id
* parent checkpoint id
* prompt version or hash for the agent under evaluation
* changed block ids
* per-conversation Tally run references
* aggregated `OverallQuality`
* guardrail summaries
* accept/reject decision
* checkpoint reflection summary from previous checkpoints

This is enough for replay and auditing without building a heavy registry system first.

## Proposed Package Shape

Keep the implementation small.

`packages/hrpo` should start with:

* `session` - creates and validates the fixed session trajectory set for the agent under evaluation
* `prompts` - loads prompt templates and applies block mutations to the agent under evaluation
* `evaluate` - runs Tally over all session conversations produced by the agent under evaluation
* `analyze` - summarizes failures and low-scoring conversations for the agent under evaluation
* `accept` - computes aggregate score and applies guardrails
* `optimize` - generates the next candidate for the agent under evaluation using optimizer controls such as optimizer system prompt and temperature

## v3 Non-Goals

Do not add these in v3:

* multiple candidates per iteration
* dynamic trajectory regeneration during a session
* distributed execution
* complex statistical testing
* bucket-aware scoring semantics
* a second optimizer-specific scoring model
* complex weighting across eval layers

## Implementation Order

1. Create `packages/hrpo` with session, prompt, evaluate, analyze, accept, and optimize
2. Add session creation that generates one fixed trajectory set and stores replayable artifacts plus hashes
3. Add baseline evaluation of the agent under evaluation and checkpoint persistence
4. Add simple failure analysis based on Tally outputs
5. Add block-based prompt mutation for one candidate per iteration of the agent under evaluation
6. Add accept/reject logic using mean `OverallQuality` plus guardrails
7. Add loop control for target threshold, max iterations, and stopping criteria

## Bottom Line

v3 should keep the architecture opinionated and easy to explain:

* one agent under evaluation
* one optimizer that improves that agent
* one session
* one fixed trajectory set
* one candidate per iteration
* one primary objective: `OverallQuality`
* one decision rule: aggregate conversation scores
* one simple prompt model: named mutable blocks
* one simple analysis path: failed step-level and conversation-level evals guide block mutation
* one checkpoint flow that remembers previous checkpoints and reflects before the next mutation

That keeps the good technical corrections from v1, but removes the extra architectural weight that `critique-1` pushed back on. 
