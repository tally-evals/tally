# HRPO v4 Architecture Graph

```mermaid
flowchart TD
    A[Phase 1: Start optimization job] --> B[Generate one fixed trajectory set]
    B --> E[Write optimization job setup]
    E --> F[Phase 2: Generate candidate runs on the fixed trajectory set]
    F --> G[Run the current candidate of the agent under evaluation on the full fixed trajectory set]
    G --> H[Tally evaluates each conversation]

    H --> J1[Single-turn evals]
    H --> J2[Multi-turn evals]
    H --> J3[OverallQuality per conversation]

    J1 --> K[Compute cycle outputs]
    J2 --> K
    J3 --> K

    K --> L1[candidate_score = mean OverallQuality]
    K --> L2[Guardrail summaries for selected critical evals]
    K --> L3[Weighted evals: more important evals have higher mutation and final-selection priority]
    L1 --> M[Save cycle output 0000 or current cycle output]
    L2 --> M
    L3 --> M

    M --> N[Phase 3: Analyze failures]
    N --> O[Collect failed step-level evals]
    N --> P[Collect failed conversation-level evals]
    O --> Q[Conversation-level summary]
    P --> R[Across all conversations summary]
    Q --> S[Cycle output record]
    R --> S
    S --> T[Use cycle output record as input to the next candidate prompt]
    T --> V[Prioritize edits using failure summaries plus weighted eval importance]

    V --> W[Phase 4: Generate next candidate prompt]
    W --> X[Start from latest generated candidate or another chosen parent from cycle history]
    X --> Y[Reflect on previous cycle outputs, strong candidates, and prior mutations]
    Y --> Z[Apply cycle output reflection and mutation logic]
    Z --> AA[Mutate only selected mutable prompt blocks]
    AA --> AB[Record parent candidate, changed block ids, and mutation rationale]
    AB --> AG[Store current cycle output in optimization job history]
    AB -.parallel execution only.-> AV[Buckets are workload partitions only]

    AG --> AQ{Phase 6: Stop if stopping criteria reached?}
    AQ -->|threshold score achieved| AR[Stop optimization job]
    AQ -->|k cycles reached| AR
    AQ -->|no useful mutations remain| AR
    AQ -->|continue| G

    AR --> AS2[Phase 7: Review all stored cycle outputs]
    AS2 --> AT2[Compare all candidates using OverallQuality plus weighted guardrails]
    AT2 --> AU2[Select final accepted candidate for the optimization job]

    E -.stores.-> AS[Optimization Job Metadata: optimization job id, trajectory location, trajectory artifact hashes, config used for the optimization job]
    E -.stores.-> AU[Hyper parameters: prompt, seed prompt, optimizer system prompt, temperature]
    M -.stores.-> AT[Cycle output record includes: cycle output id, parent id, prompt hash, changed block ids, run refs used in this cycle, aggregated OverallQuality, weighted guardrails, and reflection summary]
    AU2 -.stores.-> AV2[Final selection record: accepted candidate id, selected cycle output id, and selection rationale]
```

## Reading Guide

- Core rule: `agent under evaluation -> fixed trajectory set -> Tally evaluation -> aggregated score -> optimizer generates next candidate -> store cycle outputs -> stop -> select final candidate`
- The fixed trajectory set is created once per optimization job, then reused across all cycles
- The optimization job setup now separates `Optimization Job Metadata` from `Hyper parameters`
- `Optimization Job Metadata` explicitly stores `optimization job id`, `trajectory location`, `trajectory artifact hashes`, and the `config used for the optimization job`
- `Hyper parameters` explicitly store `prompt`, `seed prompt`, `optimizer system prompt`, and `temperature`
- Tally remains the source of truth, with step-level, conversation-level, and final `OverallQuality` outputs per conversation
- Primary scalar objective: `OverallQuality`
- Candidate score: mean `OverallQuality` across completed conversations in the fixed trajectory set for the optimization job
- Initial evaluation produces cycle output `0000`, and later cycle outputs remain plain cycle snapshots rather than a separate heavy abstraction
- Weighted evals are explicit: more important evals influence mutation priority, regression checks, and final selection more strongly while optimizing the agent under evaluation
- Failure analysis rolls the step-level and conversation-level summaries into the cycle output record, which then becomes the input to the next candidate prompt
- The candidate reads the runs used for the current cycle as readonly context; generating a new candidate does not modify those runs
- Cycle output records explicitly include `cycle output id`, `parent id`, `prompt hash`, `changed block ids`, run refs used in the cycle, aggregated `OverallQuality`, weighted guardrails, and reflection summary
- Candidate generation starts from the latest generated candidate, or another chosen parent from cycle history, and includes cycle output reflection over prior cycle outputs and mutation history so the optimizer does not repeat work or re-break earlier fixes
- Prompt mutation still defaults to a single mutable `full-prompt` block, with selective refinement happening inside that simple block model
- Stopping is loop control only: when the threshold is reached, `k` cycles are exhausted, or no useful mutations remain, candidate generation ends and the optimization job moves to final selection
- The loop is explicit: Phase 2 generate candidate runs on the fixed trajectory set -> Phase 3 analyze -> Phase 4 generate next candidate prompt -> store current cycle output -> Phase 6 stop or continue
- Stop when the stopping criteria are reached
- Final acceptance happens once, after the optimization job stops, by comparing all stored candidates and choosing the best-performing one under the configured guardrails
- Buckets are workload partitions for parallel execution only, not scoring groups or optimization boundaries
