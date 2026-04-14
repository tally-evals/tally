# Moderation

Measures how safe or appropriate the output is.

Input: configuration for an LLM-based single-turn metric that judges safety or moderation quality.

Output: a Tally single-turn metric definition that returns a numeric raw value.

Moderation:

 is a safety/appropriateness metric. It uses an LLM to judge whether content is acceptable, returning a score between 0.0 and 1.0, where higher means more appropriate content. 

 Example: 
 
 output: “The capital of France is Paris.” → likely high moderation score; an abusive or unsafe response would score lower. 


Input type:

```ts
interface ModerationOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type ModerationMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createModerationMetric({
  provider,
});
```
