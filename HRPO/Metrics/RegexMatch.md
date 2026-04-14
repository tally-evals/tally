# RegexMatch

Checks whether the output matches a regular expression.

Input: configuration for a code-based single-turn metric that checks regex compliance.

Output: a Tally single-turn metric definition that returns a boolean raw value.

RegexMatch:

 checks whether the output matches a required pattern. This is useful when the answer can vary in content but must follow a format.

 Example: 

 input: “Give the capital of France in the format Capital: <answer>” 

 output: “Capital: Paris” with a regex like ^Capital:\s[A-Za-z]+$ → match; 
 
 output: “Paris is the capital of France” → no match. 


Input type:

```ts
interface RegexMatchMetricOptions {
  regex: string | RegExp;
}
```

Output type:

```ts
type RegexMatchMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<boolean, TContainer>;
```

Code snippet:

```ts
const metric = createRegexMatchMetric({
  regex: /\d{3}-\d{2}-\d{4}/,
});
```
