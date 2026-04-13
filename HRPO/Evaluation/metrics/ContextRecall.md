# ContextRecall

Measures how well the output recalls relevant information from the provided context.

Input: configuration for an LLM-based single-turn metric that judges how much relevant context is recalled in the answer.

Output: a Tally single-turn metric definition that returns a numeric raw value.

ContextRecall:
 checks how well the answer uses the important information available in the provided context. It is more about coverage than strictness. 
 Example: 
 input: “What is the capital of France and what continent is it in?” 
 context: “France is a country in Europe. Its capital is Paris.” 
 expected output: “Paris, in Europe.” 
 output: “Paris” → lower recall because it missed relevant context-supported information; 
 output: “Paris, in Europe.” → higher recall. 

Input type:

```ts
interface ContextRecallOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type ContextRecallMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createContextRecallMetric({
  provider,
});
```
