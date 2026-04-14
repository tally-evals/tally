# ContextPrecision

Measures how precisely the output uses the provided context.

Input: configuration for an LLM-based single-turn metric that judges whether the answer uses the retrieved context precisely.

Output: a Tally single-turn metric definition that returns a numeric raw value.

ContextPrecision:

 checks how precisely the answer aligns with the provided context and expected output. It rewards answers that stay tightly grounded in the retrieved evidence and avoid unsupported extras. 

 Example: 

 input: “What is the capital of France?” 

 expected output: “Paris” 

 context: “France is a country in Europe. Its capital is Paris.” 

 output: “Paris” → high precision; 
 
 output: “Paris is the capital of France and has 20 million residents.” → lower precision if that extra claim is not supported by the provided context. 

Input type:

```ts
interface ContextPrecisionOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type ContextPrecisionMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createContextPrecisionMetric({
  provider,
});
```
