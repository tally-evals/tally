# GEval  (Generative Evaluation)
It is an LLM-as-a-judge 

Measures the output against custom evaluation criteria.

Input: configuration for an LLM-based single-turn metric with custom evaluation instructions.

Output: a Tally single-turn metric definition that returns a numeric raw value.

GEval:
 is a rubric-based LLM judge. You give it a task description and evaluation criteria, and it scores the output from 0.0 to 1.0 with a reason. 
 Example: 
 task introduction: “Evaluate whether the answer is clear and correct.” 
 criteria: “The answer should be factually correct, concise, and directly answer the question.” 
 output: “Paris is the capital of France.” → likely high score. This is useful when quality cannot be captured by exact string matching. 

Input type:

```ts
interface GEvalOptions {
  provider: LanguageModel; // in this project: google('models/gemini-2.5-flash-lite')
  taskIntroduction: string;
  evaluationCriteria: string;
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type GEvalMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createGEvalMetric({
  provider,
  taskIntroduction: "Evaluate whether the response is helpful.",
  evaluationCriteria: "Score higher when the response is direct and useful.",
});
```
