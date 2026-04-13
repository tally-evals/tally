# BaseMetric

Creates the base definition shared by code-based and LLM-based metrics.

Code-based metrics:   
Equals, Contains, RegexMatch, IsJson, and LevenshteinRatio 

LLM-based metrics: LLM-judge style metrics that evaluate meaning, safety, or grounding rather than just string shpae:
 Hallucination, GEval, Moderation, AnswerRelevance, ContextPrecision, and ContextRecall 


Input: a base metric configuration object used before building a single-turn or multi-turn metric.

Output: a Tally base metric definition object.

Input type:

```ts
type MetricScalar = number | boolean | string;

interface DefineBaseMetricArgs<TMetricValue extends MetricScalar> {
  name: string;
  valueType: BaseMetricDef<TMetricValue>["valueType"];
  description?: string;
  metadata?: Record<string, unknown>;
  normalization?: MetricNormalization<
    TMetricValue,
    NormalizationContextFor<TMetricValue>
  >;
}
```

Output type:

```ts
type BaseMetric<TMetricValue extends MetricScalar> = BaseMetricDef<TMetricValue>;
```

Code snippet:

```ts
const base = defineBaseMetric({
  name: "relevance",
  valueType: "number",
  description: "Measures answer relevance",
});
```
