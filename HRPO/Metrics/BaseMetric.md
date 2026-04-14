# BaseMetric



It is the shared definition that all metrics start from. In other words, before you create a specific metric, you first define its basic identity and output type through this base shape.

A metric system needs some common structure for every metric, whether that metric is rule-based or LLM-based. BaseMetric gives you that common structure.


Code-based metrics:   

Equals, Contains, RegexMatch, IsJson, and LevenshteinRatio 


LLM-based metrics: LLM-judge style metrics that evaluate meaning, safety, or grounding rather than just string shpae:
 Hallucination, GEval, Moderation, AnswerRelevance, ContextPrecision, and ContextRecall 


Input: a base metric configuration object used before building a single-turn or multi-turn metric.


Output: a Tally base metric definition object.


What all metrics have in common is that they need at least:
a name,
a value type,
an optional description,
optional metadata,
and optional normalization rules.

Input type:

```ts

// MetricScalar: metric result is expected to be one simple scalar value.
type MetricScalar = number | boolean | string;

interface DefineBaseMetricArgs<TMetricValue extends MetricScalar> {
  name: string;                                            // metric name 
  valueType: BaseMetricDef<TMetricValue>["valueType"];    // what type of scalar the metric returns; number, boolean, or string 
  description?: string;      //optionsl explanation of what the metric measures 
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
