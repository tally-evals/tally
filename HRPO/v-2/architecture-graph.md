# HRPO v2 Architecture Graph

```mermaid
flowchart TD
    A[Phase 1: Start session] --> B[Generate one trajectory set]
    B --> C[Persist replayable conversations and record hashes]
    C --> D[Write session manifest]
    D --> E[Phase 2: Run baseline or current active prompt]
    E --> F[Tally evaluates each conversation]

    F --> G1[Single-turn evals]
    F --> G2[Multi-turn evals]
    F --> G3[OverallQuality per conversation]

    G1 --> H[Compute checkpoint outputs]
    G2 --> H
    G3 --> H

    H --> I[candidate_score = mean OverallQuality]
    H --> J[guardrail summaries]
    I --> K[Save checkpoint]
    J --> K

    K --> L[Phase 3: Analyze failures]
    L --> M[Collect failed step-level evals]
    L --> N[Collect failed conversation-level evals]
    M --> O[Per-turn summary]
    N --> P[Conversation-level summary]
    O --> Q{Any explicit failures?}
    P --> Q
    Q -->|Yes| R[Identify prompt blocks to edit]
    Q -->|No| S[Use low OverallQuality runs as fallback]
    S --> R

    R --> T[Phase 4: Generate next candidate]
    T --> U[Mutate only selected mutable blocks]
    U --> V[Record parent candidate, changed block ids, rationale]

    V --> W[Phase 5: Re-evaluate candidate]
    W --> X[Run same fixed session set with same Tally config]
    X --> Y[Recompute candidate score from OverallQuality]
    Y --> Z{Phase 6: Accept candidate?}

    Z -->|Yes| AA[Candidate becomes active prompt]
    Z -->|No| AB[Keep previous active prompt]
    AA --> AC[Store accepted checkpoint]
    AB --> AD[Store rejected checkpoint]

    AC --> AE{Phase 7: Stop condition?}
    AD --> AE
    AE -->|target reached| AF[Stop session]
    AE -->|max iterations| AF
    AE -->|no useful mutations| AF
    AE -->|continue| L
```

## Reading Guide

- Core rule: `session -> fixed trajectory set -> candidate prompt -> Tally evaluation -> aggregated score -> mutate prompt -> run again`
- Tally is the source of truth, with step-level, conversation-level, and final `OverallQuality` outputs per conversation
- Primary objective: `OverallQuality`
- Candidate score: mean `OverallQuality` across completed conversations in the fixed session set
- Failure analysis uses failed step-level and conversation-level evals; if none exist, it falls back to low `OverallQuality` runs
- Checkpoints are plain iteration snapshots, not a separate heavy abstraction
- Buckets are execution partitions only, not scoring boundaries
- `Session manifest`, `checkpoint record`, and acceptance gates are supporting machinery around the main loop
