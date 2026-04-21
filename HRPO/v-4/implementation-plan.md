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

## v4 Core Rule

The architecture should be stated as plainly as possible:

`agent under evaluation -> fixed trajectory set -> Tally evaluation -> Check evals pass rate -> stop check -> optimizer generates next candidate -> store cycle outputs -> select final candidate`

The optimizer does not optimize Tally.

The optimizer does not optimize the fixed trajectory set.

The optimizer uses the fixed trajectories with different runs for every new candidate, Tally outputs, cycle output, and optimizer hyper parameters to improve the **agent under evaluation**.

## v4 Design Decisions

### 1. What is being optimized

More specifically:

* the optimizer evaluates the current version of the agent under evaluation
* the optimizer reads Tally outputs for that agent
* the optimizer analyzes failures for that agent
* the optimizer generates the next candidate for that agent
* the optimizer evaluates each generated candidate on the same fixed trajectory set

The fixed trajectory set is evaluation input.

Tally is evaluation machinery.

The optimizer is the component that proposes changes.

The **agent under evaluation** is the thing being optimized.

### 2. Optimization job-scoped data

* One optimization job generates one fixed trajectory set.
* That trajectory set does not change during the optimization job.
* Every candidate of the agent under evaluation in the optimization job is evaluated against different runs generated in the same trajectory.
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
* Candidate selection is not determined by the weightedevals, overallQuality, evals pass rate.  


### 6. Cycle output meaning

* One cycle output = one cycle snapshot
* A cycle output stores the candidate of the agent under evaluation, the evaluation results, and the candidate score
* It should be treated as plain cycle state, not a large abstraction layer
* A new cycle output should have knowledge of previous cycle outputs, so the LLM knows the previous cycle history
* The next candidate should reflect on previous cycle output, failure summaries before generating another version of the agent under evaluation

Rules:

* prompts default to a single mutable block (`full-prompt`)
* each new candidate is derived from previous candidate candidate

### 8. Hyper Parameters

Define the optimizer hyper parameters explicitly.

These hyper parameters are used by the optimizer to generate the next candidate for the **agent under evaluation**.

They should include:

* temperature: handles LLM creativity and response randomness during candidate generation

These hyper parameters are part of the optimization process.

They are not the evaluation target themselves.

They are used to optimize the **agent under evaluation**.


## Failure Summaries

Generate two simple summaries from the failed evals of the **agent under evaluation**.

### 1. Per-turn summary

* aggregates failures across steps
* helps detect issues like incorrect responses, missing information, or weak answers

### 2. Conversation-level summary

* aggregates failures across full runs
* helps detect issues like inconsistency, coherence problems, or poor role adherence

These summaries are used only to decide which prompt blocks of the **agent under evaluation** should be edited next.


Define stopping criteria explicitly:

* stop when the maximum number of cycles `k` has been reached
* stop when one candidate score reaches the configured target threshold
* stop when no useful mutations remain
* stop when all evals are passing 


If stopping criteria are met, skip generating another candidate and proceed to final selection 


### Optimization Job manifest


## v4 Non-Goals

Do not add these in v4:

* multiple candidates per cycle
* complex statistical testing
* bucket-aware scoring semantics

