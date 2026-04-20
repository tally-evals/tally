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

    J1 --> N[Phase 3: Analyze failures]
    J2 --> N
    J3 --> N

    J1 --> M[Save cycle output 0000 or current cycle output]
    J2 --> M
    J3 --> M
    N --> O[Collect failed step-level evals]
    N --> P[Collect failed conversation-level evals]
    O --> Q[Conversation-level summary]
    P --> R[Across all conversations summary]
    Q --> S[Failure analysis summary]
    R --> S
    S --> T[Use failure analysis summary as context for stop check and next candidate prompt]
    T --> V[Prioritize edits using failure summaries plus weighted eval importance]

    V --> AQ{Phase 6: Stop if stopping criteria reached?}
    AQ -->|threshold score achieved| AR[Stop optimization job]
    AQ -->|max cycles reached| AR
    AQ -->|no useful mutations remain| AR
    AQ -->|continue| W[Phase 4: Generate next candidate prompt]

    W --> X[Start from latest generated candidate; context = prior candidate + cycle output]
    X --> Y[Reflect on previous cycle outputs, strong candidates, and prior mutations]
    Y --> Z[Apply cycle output reflection and mutation logic]
    Z --> AA[Mutate only selected mutable prompt blocks]
    AA --> AB[Record parent candidate, changed block ids, and mutation rationale]
    AB --> AG[Store current cycle output in optimization job history]

    AG --> F

    AR --> AS2[Phase 7: Review all stored cycle outputs]
    AS2 --> AT2[Compare all candidates using OverallQuality plus weighted guardrails]
    AT2 --> AU2[Select final accepted candidate for the optimization job]

    E -.stores.-> AS[Optimization Job Metadata: optimization job id, trajectory location, config used for the optimization job]
    E -.stores.-> AU[Hyper parameters: seed prompt, temperature]
    M -.stores.-> AT[Cycle output record includes: cycle output id, parent id, prompt hash, changed block ids, run refs used in this cycle, aggregated OverallQuality, weighted guardrails, and reflection summary]
    AU2 -.stores.-> AV2[Final selection record: accepted candidate id, selected cycle output id, and selection rationale]
```

## Reading Guide

- Core rule: `agent under evaluation -> fixed trajectory set -> Tally evaluation -> aggregated score -> stop check -> generate next candidate -> store cycle outputs -> loop or final selection`
- The fixed trajectory set is created once per optimization job, then reused across all cycles
- The optimization job setup now separates `Optimization Job Metadata` from `Hyper parameters`
- `Optimization Job Metadata` explicitly stores `optimization job id`, `trajectory location`, and the `config used for the optimization job`
- `Hyper parameters` explicitly store `seed prompt` and `temperature`
- Tally remains the source of truth, with step-level, conversation-level, and final `OverallQuality` outputs per conversation
- Phase 3 reads **single-turn, multi-turn, and OverallQuality** results directly from Tally; there is no separate “cycle outputs” aggregation box before analysis (candidate score, guardrails, and weights are still derived from those same layers for persistence)
- Primary scalar objective: `OverallQuality`
- Candidate score: mean `OverallQuality` across completed conversations in the fixed trajectory set for the optimization job
- Initial evaluation produces cycle output `0000`, and later cycle outputs remain plain cycle snapshots rather than a separate heavy abstraction
- Weighted evals are explicit: more important evals influence mutation priority, regression checks, and final selection more strongly while optimizing the agent under evaluation
- Failure analysis rolls the step-level and conversation-level summaries into the **failure analysis summary**, which informs the stop check, mutation priority, and the next candidate prompt (and is persisted with the cycle output)
- The candidate reads the runs used for the current cycle as readonly context; generating a new candidate does not modify those runs
- Cycle output records explicitly include `cycle output id`, `parent id`, `prompt hash`, `changed block ids`, run refs used in the cycle, aggregated `OverallQuality`, weighted guardrails, and reflection summary
- Candidate generation uses the latest generated candidate plus cycle output (including failure analysis) as context; APIs reserve parent and history fields for future lookback even when the implementation always starts from the latest candidate today
- Prompt mutation still defaults to a single mutable `full-prompt` block, with selective refinement happening inside that simple block model
- Stopping is loop control only: when the threshold is reached, `k` cycles are exhausted, or no useful mutations remain, candidate generation ends and the optimization job moves to final selection
- The loop is explicit: Phase 2 generate candidate runs on the fixed trajectory set -> Phase 3 analyze -> **Phase 6 stop or continue** -> Phase 4 generate next candidate prompt -> store current cycle output -> Phase 2 again, or exit to Phase 7
- Stop when the stopping criteria are reached
- Final acceptance happens once, after the optimization job stops, by comparing all stored candidates and choosing the best-performing one under the configured guardrails
