# Equals

Checks whether the output exactly matches a reference string.

Input: configuration for a code-based single-turn metric that compares output text with a reference text.

Output: a Tally single-turn metric definition that returns a boolean raw value.

Equals:

 checks whether the model output exactly matches the expected answer. It returns 1.0 for an exact match and 0.0 otherwise, with optional case-sensitive behavior. 

 Example: 

 input: “What is the capital of France?” 

 expected/reference: “Paris” 

 output: “Paris” → high score; 
 
 output: “The capital of France is Paris” → not an exact match, so it would fail under strict exact-match scoring. 


Input type:

```ts
interface EqualsMetricOptions {
  caseSensitive?: boolean;
  reference?: string;
}
```

Output type:

```ts
type EqualsMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<boolean, TContainer>;
```

Code snippet:

```ts
const metric = createEqualsMetric({
  caseSensitive: true,
  reference: "Hello, World!",
});
```
