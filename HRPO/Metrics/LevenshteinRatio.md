# LevenshteinRatio

Measures string similarity between the output and a reference string.

Input: configuration for a code-based single-turn metric that computes edit-distance similarity.

Output: a Tally single-turn metric definition that returns a numeric raw value.

LevenshteinRatio:
 measures string similarity rather than exact equality. It gives a score between 0.0 and 1.0, where higher means the output is more similar to the reference string. 
Example: 
reference: “Paris” 
output: “Pariss” → high but not perfect score; 
output: “London” → much lower score. This is helpful when near-matches should get partial credit. 

Input type:

```ts
interface LevenshteinRatioMetricOptions {
  caseSensitive?: boolean;
  reference?: string;
  aggregators?: NumericAggregatorDef[];
}
```

Output type:

```ts
type LevenshteinRatioMetric<TContainer extends SingleTurnContainer = SingleTurnContainer> =
  SingleTurnMetricDef<number, TContainer>;
```

Code snippet:

```ts
const metric = createLevenshteinRatioMetric({
  caseSensitive: true,
  reference: "Hello, World",
});
```
