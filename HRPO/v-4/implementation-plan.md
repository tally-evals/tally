# HRPO v4 Implementation Plan

## Goal

The system should:

1. Generate one fixed session trajectory set at the start of an optimization session.
2. Keep those session trajectories fixed for the whole session.
3. Evaluate one prompt candidate per iteration against that same fixed trajectory set.
4. Use Tally as the source of truth for scoring completed candidate runs.
5. Compute one candidate score from the per-conversation results only after every required run for every trajectory in the fixed session workload has completed.
6. Stop when the configured target threshold is reached or the iteration budget is exhausted.

## v4 Core Rule

Keep the architecture simple and keep the loop explicit:

`session -> fixed trajectory set -> candidate prompt -> candidate runs -> Tally evaluation -> aggregated score -> mutate prompt -> run again`

The loop is still small. `v4` only sharpens the contract for what is fixed, what changes per iteration, and how acceptance works.

## v4 Design Decisions

### 1. Frozen boundary

Freeze exactly these things at session start:

- session id
- trajectory definitions for the fixed session trajectory set
- replay inputs needed to rerun those trajectories
- Tally evaluation configuration
- baseline prompt snapshot

Do **not** freeze candidate runs.

Candidate runs are prompt-dependent outputs and are expected to change on every iteration. They belong to checkpoints, not to the frozen session manifest.

### 2. Session contract

The fixed session workload is:

- a fixed list of trajectory ids
- fixed replay inputs for those trajectories
- a fixed run plan for each trajectory

Every iteration must evaluate the same trajectory list with the same run plan or equivalent deterministic workload identity.

Within one session:

- fixed: trajectory ids, replay inputs, run plan, Tally config, baseline prompt snapshot
- changes per iteration: candidate prompt, candidate runs, Tally results, aggregate score, accept/reject outcome

### 3. Buckets and prompt scope

- Buckets are execution partitions only.
- Buckets exist so trajectories can run in parallel.
- A bucket does not own its own prompt candidate.
- One iteration has one candidate prompt.
- That same candidate prompt is used for every run in every bucket for that iteration.

So if the fixed workload contains multiple trajectories and each trajectory has multiple runs, all of those runs still belong to the same candidate checkpoint as long as they were executed in the same iteration.

### 4. Source of truth

- Trajectories define the fixed session workload.
- Candidate execution fans one candidate prompt out across all buckets.
- Each trajectory then produces one or more candidate-specific runs according to the fixed run plan.
- Tally evaluates those candidate-specific runs.
- `TallyRunArtifact` remains the canonical evaluation record for completed runs.
- Optimizer summaries are derived views over Tally outputs plus iteration metadata.

### 5. Evaluation granularity

Each trajectory in the fixed session workload may produce one or more runs for the current candidate, depending on the fixed run plan.

Tally produces:

1. Step-level evals
2. Conversation-level evals
3. Final `OverallQuality`

The optimizer uses:

- `OverallQuality` as the only scalar objective
- selected non-primary evals as explicit acceptance gates

### 6. Candidate scoring

The comparison set is the full fixed session workload, never a surviving subset.

The score is:

`candidate_score = mean(OverallQuality across all required runs in the fixed session workload)`

That score is valid only if the iteration produced a completed Tally-evaluated result for every required run in the fixed session workload.

If any required run is missing, failed before evaluation, timed out, or otherwise did not yield a required Tally result:

- mark the checkpoint as `incomplete`
- reject the candidate for acceptance purposes
- do not treat a partial-subset mean as comparable to the active baseline

This prevents fake improvement from partial coverage.

### 7. Guardrails are part of the acceptance contract

Guardrails are not a second blended score, but they are part of the actual decision rule.

So they must be configured explicitly at session start.

Use a simple config shape:

```ts
type GuardrailRule = {
  evalId: string
  scope: "step" | "conversation"
  comparator: "min_pass_rate" | "max_drop"
  threshold: number
}
```

Each session chooses a concrete list of guardrails. Avoid vague language like "important guardrails" during runtime.

### 8. Acceptance rule

Accept a candidate only if all of the following are true:

1. the checkpoint is complete for the full fixed session workload
2. `candidate_score >= active_score + min_delta`
3. every configured `GuardrailRule` passes
4. the session manifest hash matches the active session manifest hash

If accepted:

- the candidate becomes the new active prompt
- the next iteration compares against this new active checkpoint

If rejected:

- keep the previous active prompt
- still store the checkpoint for auditability

### 9. Integrity rule

Hash only the frozen session boundary:

- trajectory definitions / replay inputs
- run plan
- Tally config
- baseline prompt snapshot
- session manifest itself

Do not use candidate run hashes as session-integrity evidence.

Candidate runs are expected to differ between iterations and should be stored under checkpoints only.

### 10. Prompt mutation model

`v4` should stop pretending it has block-targeted mutation if the architecture is really whole-prompt mutation.

Use one mutable unit:

```ts
type PromptCandidate = {
  candidateId: string
  promptText: string
  parentCandidateId?: string
}
```

Rules:

- the editable unit is the full prompt
- one new candidate is derived from the current active prompt per iteration
- store a short mutation rationale with each candidate

This keeps the prompt model honest and simple.

### 11. Failure analysis output

Failure analysis should not claim it can automatically locate the exact prompt region that caused a failure.

Instead it should produce a mutation brief:

- repeated step-level failures
- repeated conversation-level failures
- low `OverallQuality` runs
- concrete evidence snippets from those runs
- a short recommendation for what to change in the next whole-prompt revision
- optional "preserve these behaviors" notes from strong conversations

The output is guidance for the next mutation, not a claimed causal mapping from symptom to prompt block.

### 12. Comparability claim

The plan should stay honest:

- fixed trajectories and run plans improve comparability
- fixed Tally config improves comparability
- recorded hashes improve auditability

But they do not guarantee perfect determinism.

Model nondeterminism, tool side effects, environment drift, and evaluator changes can still affect results. `v4` should record those facts where possible, not pretend they disappear.

## Minimal Runtime Flow

### Phase 1. Start session

1. Build the fixed session trajectory set once.
2. Persist the replay inputs for those trajectories.
3. Persist the fixed run plan for each trajectory.
4. Persist the Tally config snapshot.
5. Persist the baseline prompt snapshot.
6. Write one session manifest that hashes the frozen boundary.

### Phase 2. Run baseline

1. Run the baseline prompt across the full fixed session workload.
2. Store one Tally result per completed run.
3. Verify full workload coverage.
4. Compute:
  - `candidate_score = mean(OverallQuality across all required runs in the session workload)` only if coverage is complete
  - configured guardrail outcomes
5. Save checkpoint `0000`.

### Phase 3. Analyze results

1. Read Tally results from the active checkpoint.
2. Collect failed step-level evals.
3. Collect failed conversation-level evals.
4. Identify low `OverallQuality` runs.
5. Produce one mutation brief for the next whole-prompt revision.

### Phase 4. Generate next candidate

1. Start from the current active prompt.
2. Apply one whole-prompt revision using the mutation brief.
3. Record:
  - parent candidate id
  - mutation rationale
  - prompt hash

### Phase 5. Re-evaluate

1. Run the new candidate on the same fixed session workload.
2. Use the same frozen Tally config.
3. Verify full workload coverage.
4. Compute the score only if coverage is complete.
5. Evaluate configured guardrails.

### Phase 6. Accept or reject

Apply the acceptance rule exactly as defined above.

### Phase 7. Stop condition

Stop when either:

1. `candidate_score >= target_threshold`
2. `max_iterations` is reached

Do not make "no useful mutations remain" an automatic architecture rule in `v4`. If an operator wants to stop early, that is a manual decision outside the optimizer contract.

## Minimal Stored Artifacts

### Session manifest

Stores:

- session id
- created time
- fixed trajectory ids
- replay input locations
- replay input hashes
- run plan
- Tally config snapshot or hash
- baseline prompt hash
- environment metadata worth recording for auditability

### Checkpoint record

Stores:

- checkpoint id
- parent checkpoint id
- candidate id
- prompt hash
- per-conversation Tally run references
- coverage status
- aggregated `OverallQuality` if coverage is complete
- configured guardrail results
- mutation rationale / mutation brief reference
- accept/reject decision

## Proposed Package Shape

Keep the package small:

- `session` - creates the fixed session workload and writes the manifest
- `prompts` - stores prompt candidates and whole-prompt revisions
- `evaluate` - runs candidates across the fixed session workload and collects Tally outputs
- `analyze` - produces mutation briefs from failures and low-scoring runs
- `accept` - checks completeness, score delta, guardrails, and manifest integrity

## v4 Non-Goals

Do not add these in `v4`:

- multiple candidates per iteration
- dynamic trajectory regeneration during a session
- distributed execution
- complex statistical testing
- bucket-aware scoring semantics
- a second optimizer-specific scoring model
- weighted formulas across eval layers
- block-targeted mutation logic
- automatic "stuck" detection logic dressed up as architecture

## Implementation Order

1. Define the frozen session manifest, trajectory identity contract, and run plan contract.
2. Add session creation that stores replay inputs, run plans, config snapshot, and manifest hashes.
3. Add baseline execution and checkpoint persistence with explicit workload coverage tracking.
4. Add score computation that only applies to full-workload coverage.
5. Add explicit configured guardrail rules and acceptance checks.
6. Add simple failure analysis that outputs a mutation brief.
7. Add whole-prompt candidate mutation and iteration looping.

## Bottom Line

`v4` keeps the same simple architecture, but it removes the soft wording that would let the implementation drift.

It stays disciplined by making five things explicit:

- the frozen boundary is session trajectories plus replay inputs and run plans, not candidate runs
- the score is defined on the full fixed session workload, not a partial subset
- guardrails are explicit acceptance rules, not side notes
- prompt mutation is whole-prompt, not pretend block-level targeting
- failure analysis produces a mutation brief, not a fake causal map

