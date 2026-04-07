# HRPO v2 Implementation Plan

## Goal

The system should:

1. Generate one trajectory set at the start of an optimization session.
2. Keep that trajectory set fixed for the whole session.
3. Evaluate one prompt candidate per iteration on that same fixed set.
4. Use Tally as the source of truth for scoring each conversation.
5. Aggregate those conversation results into one candidate score.
6. Stop when the candidate score reaches the configured target threshold.

## v2 Core Rule
The architecture should be stated as plainly as possible:

`session -> fixed trajectory set -> candidate prompt -> Tally evaluation -> aggregated score -> mutate prompt -> run again`

Everything else is supporting machinery.

## v2 Design Decisions

### 1. Session-scoped data
- One optimization session generates one trajectory set.
- That trajectory set does not change during the session.
- Every candidate in the session is evaluated against the same generated conversations.

This is the comparison boundary for v2.

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
- Primary optimization objective: `OverallQuality`
- Candidate score: mean `OverallQuality` across all evaluated conversations in the fixed session set

For v2, keep this explicit:

`candidate_score = mean(OverallQuality for all completed conversations)`

### 5. Role of other evals
- Other evals are not the primary objective, overallQuality is the only optimization score
  used to rank candidates 
- They are used for diagnostics and used to detect failures, decide which prompt blocks 
  should be mutated and act as a guradrails when deciding whether a candidate is acceptable.
- They should not create a second competing scoring system, they should not be combined
  into global candidate score. Global candidate score will be overallQuality. 


### 6. Checkpoint meaning
- One checkpoint = one iteration snapshot.
- A checkpoint stores the prompt used, the evaluation results, the candidate score, and the accept/reject decision.
- It should be treated as plain iteration state, not a large abstraction layer.

### 7. Prompt representation
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
- prompts are made of named blocks   //??????????????????????????
- only mutable blocks can be edited
- unchanged blocks are carried forward from the parent candidate
- each candidate records which block ids changed


### 8. Buckets
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
2. Keep those exact generated conversation artifacts unchanged and reuse them for replay and evaluation purposes.
3. Store hashes of those conversation artifacts so later iterations can verify that the original frozen inputs are still unchanged.

### Phase 2. Run baseline
1. Evaluate the current prompt on the full fixed session set.
2. Store one Tally result per conversation.
3. Compute:
   - candidate score = mean `OverallQuality`
   - guardrail summaries for selected critical evals
4. Save checkpoint `0000`.

### Phase 3. Analyze failures
1. Read the Tally results for the checkpoint.
2. Collect failed step-level evals from single-turn evaluation.
3. Collect failed conversation-level evals from multi-turn evaluation.
4. Generate:
   - a per-turn summary across failed step-level evals
   - a conversation-level summary across failed multi-turn evals
5. Use those summaries to identify the prompt blocks most likely to need edits.
6. If there are no explicit failures, use low `OverallQuality` runs as fallback analysis input.


### Phase 4. Generate next candidate
1. Start from the last accepted prompt.
2. Mutate only the selected mutable blocks.
3. Record:
   - parent candidate
   - changed block ids
   - mutation rationale

For v2, generate one candidate per iteration.

### Phase 5. Re-evaluate
1. Run the new candidate on the same fixed session set.
2. Use the same Tally configuration.
3. Compute the new candidate score from `OverallQuality`.
4. Compare it against the current accepted checkpoint.

### Phase 6. Accept or reject
Accept the candidate only if all of the following are true:

1. `candidate_score >= baseline_score + min_delta `  //min_delta : minimum improvement    threshold 
2. no required conversations are missing
3. session hashes still match or the conversation artifacts used in this iteration are the same frozen session artifacts created at session start.
4. important guardrail evals do not drop beyond the allowed tolerance, even if OverallQuality improves
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
2. max iterations is reached
3. no useful mutations remain

If there are no clear failures but the threshold is not reached, use low-scoring conversations as the mutation input instead of treating it as an error.

## Minimal Stored Artifacts
v2 should store only what it needs:

### Session manifest
Stores:
- session id
- created time
- trajectory set location            //where the frozen session artifacts live 
- conversation artifact hashes       //checksums of those stored artifacts 
- configuration used for the session

### Checkpoint record
Stores:
- checkpoint id
- parent checkpoint id
- prompt version or hash
- changed block ids
- per-conversation Tally run references
- aggregated `OverallQuality`
- guardrail summaries
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


## v2 Non-Goals
Do not add these in v2:

- multiple candidates per iteration
- dynamic trajectory regeneration during a session
- distributed execution
- complex statistical testing
- bucket-aware scoring semantics              // bucket only help with parallel execution, bucket should not affect how a candidate is scored 
- a second optimizer-specific scoring model   // Do not invent another scoring criteria, the main score stays mean(overallQuality) with guradrails used seperately for acceptance checks
- complex weighting across eval layers    // Don't create formulas that weight step-level evals, conversation-level evals and final scores against each other 

## Implementation Order
1. Create `packages/hrpo` with session, prompt, evaluate, analyze, and accept
2. Add session creation that generates one trajectory set and stores replayable artifacts plus hashes.
3. Add baseline evaluation and checkpoint persistence.
4. Add simple failure analysis based on Tally outputs.
5. Add block-based prompt mutation for one candidate per iteration.
6. Add accept/reject logic using mean `OverallQuality` plus guardrails.
7. Add loop control for threshold, max iterations, and replay.

## Bottom Line
v2 should keep the architecture opinionated and easy to explain:

- one session
- one fixed trajectory set
- one candidate per iteration
- one primary objective: `OverallQuality`
- one decision rule: aggregate conversation scores
- one simple prompt model: named mutable blocks
- one simple analysis path: failed step-level and conversation-level evals guide block mutation

That keeps the good technical corrections from v1, but removes the extra architectural weight that `critique-1` pushed back on.
