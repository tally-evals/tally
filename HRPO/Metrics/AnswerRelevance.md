# AnswerRelevance

Measures how relevant the output is to the input query.

Input: configuration for an LLM-based single-turn metric that judges answer relevance.

Output: a Tally single-turn metric definition that returns a numeric raw value.

AnswerRelevance:
 checks whether the answer is relevant and appropriate for the question, optionally using context. It does not mainly judge exact correctness; it judges whether the response actually addresses the user’s question. 

 Example: 

 input: “What is the capital of France?” 

 output: “The capital of France is Paris.” → high relevance; 
 
 output: “France is known for wine and fashion.” → lower relevance because it does not answer the question directly. 

Input type:

```ts
interface AnswerRelevanceOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  partialWeight?: number; 
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type AnswerRelevanceMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createAnswerRelevanceMetric({
  provider,
  partialWeight: 0.3,
});
```
