# Contains

Checks whether the output contains a reference string.

Input: configuration for a code-based single-turn metric that checks substring presence.

Output: a Tally single-turn metric definition that returns a boolean raw value.

Contains:
checks whether a required substring appears in the output.
It returns 1.0 if the reference string is found and 0.0 otherwise.
Example:
input: “What is the capital of France?” 
reference substring: “Paris” 
output: “The capital of France is Paris.” → pass; 
output: “France is in Europe.” → fail. 


Input type:

```ts
interface ContainsMetricOptions {
  reference: string;
  caseSensitive?: boolean;
}
```

Output type:

```ts
type ContainsMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<boolean, TContainer>;
```

Code snippet:

```ts
const metric = createContainsMetric({
  reference: "world",
});
```
