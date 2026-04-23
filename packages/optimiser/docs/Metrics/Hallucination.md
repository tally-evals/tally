# Hallucination

Measures whether the output contains unsupported or hallucinated content.

Input: configuration for an LLM-based single-turn metric that judges whether the answer is grounded.

Output: a Tally single-turn metric definition that returns a numeric raw value.

Hallucination:

 is an LLM-as-a-judge metric that checks whether the answer contains unsupported or made-up information based on the input and context. it returns 1.0 if 
 hallucination is detected and 0.0 otherwise. 
 
 Example: 

 input: “What is the capital of France?” 

 context: “France is a country in Western Europe. Its capital is Paris.”

 output: “The capital of France is Paris, and it was founded in 1200 BC.” → likely flagged because the extra claim is unsupported by the given context. 

Input type:

```ts
interface HallucinationOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type HallucinationMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createHallucinationMetric({
  provider,
});
```
