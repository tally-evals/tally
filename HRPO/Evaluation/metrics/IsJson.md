# IsJson

Checks whether the output is valid JSON.

Input: no configuration is required for this code-based single-turn metric.

Output: a Tally single-turn metric definition that returns a boolean raw value.

IsJson:
 checks whether the output is valid JSON. It is useful when you want the model to respond in a structured machine-readable format. 
 Example: 
 input: “Return the capital of France as JSON” 
 output: {"capital":"Paris"} → pass; 
 output: “Paris” → fail because it is not valid JSON. 

Input type:

```ts
type IsJsonMetricOptions = undefined;
```

Output type:

```ts
type IsJsonMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<boolean, TContainer>;
```

Code snippet:

```ts
const metric = createIsJsonMetric();
```
