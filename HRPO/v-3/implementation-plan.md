# HRPO v3 Implementation Plan

## Goal

The system should:

1. Generate one trajectory set at the start of an optimization session.
2. Keep that trajectory set fixed for the whole session.
3. Evaluate one prompt candidate per iteration on that same fixed set.
4. Use Tally as the source of truth for scoring each conversation.
5. Aggregate those conversation results into one candidate score.
6. Stop when the candidate score reaches the configured target threshold or `k` iterations are reached.

## v3 Core Rule

The architecture should be stated as plainly as possible:

`session -> fixed trajectory set -> candidate prompt -> Tally evaluation -> aggregated score -> mutate prompt -> run again`

## v3 Design Decisions

### 1. Session-scoped data

- One optimization session generates one trajectory set.
- That trajectory set does not change during the session.
- The original prompt is frozen as the baseline prompt.
- One baseline copy of the original conversations is frozen for comparison and audit.
- Every candidate in the session is evaluated on the same fixed session setup, but each candidate still generates its own conversation outputs.

### 2. Source of truth

- Trajectories generate conversations.
- Tally evaluates those conversations.
- `TallyRunArtifact` remains the canonical evaluation record.
- Any flattened optimizer rows are derived views, not the primary stored schema.

### 3. Evaluation granularity

Each trajectory execution produces one or more runs (conversations).

Each run contains multiple steps (turns).

Tally evaluates at three levels:

1. Step-level (single-turn)
  - evaluates each step independently
  - examples: relevance, completeness
  - each eval returns a score and pass/fail
2. Conversation-level (multi-turn)
  - evaluates the full conversation
  - examples: role adherence, knowledge retention
3. Final scoring
  - Tally produces `OverallQuality`
  - this is one scalar score per conversation

### 4. Candidate scoring

- Primary scalar objective: `OverallQuality`
- Candidate score: mean `OverallQuality` across all evaluated conversations in the fixed session set
- Candidate selection is not determined by that scalar alone; acceptance also depends on whether key non-primary evals remain within allowed bounds
- overallQulaity tells you whether the candidate improved on the main objective, other evals can still block acceptance if they regress too much

Example: 

```
Candidate A raises mean OverallQuality from 0.71 to 0.76
but Role Adherence drops badly
then candidate A is rejected, even though its main scalar score improved

```

v3, keep this explicit:

`candidate_score = mean(OverallQuality for all conversations)`

### 5. Eval importance weights

- Each eval should have a configured weight that shows how important it is.
- Higher-weight evals should matter more during failure review, checkpoint reflection, and acceptance decisions.
- These weights do not replace `OverallQuality` as the main scalar objective.

### 6. Role of other evals

- Other evals do not replace `OverallQuality` as the main scalar objective, but they still directly influence which candidates can be accepted
- They are used to detect failures, guide which prompt blocks should be mutated next, and enforce quality constraints during candidate selection
- They should not be collapsed into a second blended score; keep the global scalar score as `OverallQuality`, while treating selected eval outcomes as explicit acceptance conditions

### 7. Hyper parameters

- `baseline_prompt`: the original prompt frozen at session start
- `prompt`: the current prompt being evaluated or mutated
- `temperature`: controls response randomness
  - low temperature = more rigid and predictable
  - high temperature = more creative and less predictable

### 8. Checkpoint meaning

- One checkpoint = one iteration snapshot.
- A checkpoint stores the prompt used, the evaluation results, the candidate score, the accept/reject decision, and a reflection.
- Each new checkpoint should have access to previous checkpoint history so the optimizer knows what was already tried, what improved, and what should not be broken again.
- It should be treated as plain iteration state, not a large abstraction layer.

### 9. Prompt representation

Use a simple structured prompt model:

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

- prompts default to a single mutable block (`full-prompt`)
- editable unit is the full prompt but the intended mutation behaviour is selective refinement
within that full prompt. 
- each new candidate is derived from its parent candidate

### 10. Buckets

- Buckets are workload partitions only.
- They exist for parallel execution.
- They are not logical groups, scoring groups, or optimization boundaries.

## Failure Signals

The optimizer collects failures from Tally.

For each run:

- some step-level evals may pass or fail
- some conversation-level evals may pass or fail
- the run also has a final `OverallQuality` score

The optimizer should collect:

- failed step-level evals
- failed conversation-level evals

This is analysis input only. It does not change scoring logic.

## Failure Summaries

Generate two simple summaries from the failed evals:

### 1. Per-turn summary

- aggregates failures across steps
- helps detect issues like incorrect responses, missing information, or weak answers

### 2. Conversation-level summary

- aggregates failures across full runs
- helps detect issues like inconsistency, coherence problems, or poor role adherence

These summaries are used only to decide which prompt blocks should be edited next.

## Minimal Runtime Flow

### Phase 1. Start session

1. Generate the trajectory set once.
2. Freeze the original prompt as the session baseline, then generate and freeze one baseline copy of the resulting conversations for later comparison and audit.
3. Keep the session inputs and trajectory set fixed across iterations, while allowing each candidate prompt to generate its own conversation outputs against that same fixed session setup.

### Phase 2. Run baseline

1. Evaluate the current prompt on the full fixed session set.
2. Store one Tally result per conversation.
3. Compute:
  - candidate score = mean `OverallQuality`
  - weighted eval importance view for review
  - guardrail summaries for selected critical evals
4. Save checkpoint `0000`.

### Phase 3. Analyze failures

1. Read the Tally results for the checkpoint.
2. Collect failed step-level evals from single-turn evaluation.
3. Collect failed conversation-level evals from multi-turn evaluation.
4. Generate:
  - a per-turn summary across failed step-level evals
  - a conversation-level summary across failed multi-turn evals
5. Use those summaries plus eval importance weights to decide what should be edited next.
6. If there are no explicit failures, use low `OverallQuality` runs as fallback analysis input.

### Phase 4. Generate next candidate

1. Start from the last accepted prompt.
2. Mutate only the selected mutable blocks.
3. Read previous checkpoint history before mutating so the next candidate does not repeat already-tried changes and does not re-break previously improved behavior.
4. Record:
  - parent candidate
  - changed block ids
  - mutation rationale
  - checkpoint reflection

generate one candidate per iteration.

### Phase 5. Re-evaluate

1. Run the new candidate on the same fixed session set.
2. Use the same Tally configuration.
3. Compute the new candidate score from `OverallQuality`.
4. Compare it against the current accepted checkpoint.

### Phase 6. Accept or reject

Accept the candidate only if all of the following are true:

1. `candidate_score >= baseline_score + min_delta`   //min_delta : minimum improvement    threshold. baseline_score = the score of the current active prompt(the one you're comparing against)
2. session hashes still match or the conversation artifacts used in this iteration are the same frozen session artifacts created at session start.
3. higher-weight guardrail evals do not drop beyond the allowed tolerance, even if `OverallQuality` improves

Example: if a guardrail pass rate was 0.92 and the allowed tolerance is 0.02, then a drop to 0.91 may still be acceptable, but a drop to 0.86 would cause the candidate to be rejected.

If accepted:

- the candidate becomes the new active prompt
- the next checkpoint uses this candidate as the baseline

If rejected:

- keep the previous active prompt
- still store the rejected checkpoint for auditability

### Phase 7. Stop condition

Stop when either:

1. `candidate_score >= target_threshold`
2. `k` iterations are reached

## Minimal Stored Artifacts

v3 should store only what it needs:

### Session manifest

Stores:

- session id
- created time
- baseline prompt
- baseline conversation copy
- temperature
- trajectory set location            //where the frozen session artifacts live 
- conversation artifact hashes       //checksums of those stored artifacts 
- configuration used for the session

### Checkpoint record

Stores:

- checkpoint id
- parent checkpoint id
- checkpoint history references
- prompt version or hash
- changed block ids
- per-conversation Tally run references
- aggregated `OverallQuality`
- eval weights
- guardrail summaries
- checkpoint reflection
- accept/reject decision

This is enough for replay and auditing without building a heavy registry system first.

## Proposed Package Shape

Keep the implementation small.

`packages/hrpo` should start with:

- `session` - creates and validates the fixed session trajectory set
- `prompts` - loads prompt templates and applies block mutations
- `evaluate` - runs Tally over all session conversations
- `analyze` - summarizes failures and low-scoring conversations
- `accept` - computes aggregate score and applies guardrails

## v3 Non-Goals

Do not add these in v3:

- multiple candidates per iteration
- dynamic trajectory regeneration during a session
- distributed execution
- complex statistical testing
- bucket-aware scoring semantics              // bucket only help with parallel execution, bucket should not affect how a candidate is scored 
- a second optimizer-specific scoring model   // Do not invent another scoring criteria, the main score stays mean(overallQuality) with guradrails used seperately for acceptance checks
- complex weighting across eval layers    // eval weights express importance, but do not create a blended cross-layer scoring formula

## Implementation Order

1. Create `packages/hrpo` with session, prompt, evaluate, analyze, and accept
2. Add session creation that generates one trajectory set and stores the baseline prompt, baseline conversation copy, temperature, and hashes.
3. Add baseline evaluation and checkpoint persistence with checkpoint history and reflection.
4. Add simple failure analysis based on Tally outputs and eval importance weights.
5. Add block-based prompt mutation for one candidate per iteration.
6. Add accept/reject logic using mean `OverallQuality` plus guardrails.
7. Add loop control for target threshold and `k` iterations.

## Bottom Line

v3 should keep the architecture opinionated and easy to explain:

- one session
- one fixed trajectory set
- one candidate per iteration
- one primary objective: `OverallQuality`
- one decision rule: aggregate conversation scores
- one simple prompt model: named mutable blocks
- one simple analysis path: failed step-level and conversation-level evals guide block mutation

That keeps the good technical corrections from v1, but removes the extra architectural weight that `critique-1` pushed back on.