# ConversationThreadMetric

Defines a metric that runs on an entire conversation container.

Input: a multi-turn metric configuration object for a metric that runs on the whole conversation.

Output: a Tally multi-turn metric definition object.

Input type:

```ts
interface DefineConversationMetricArgs<
  TMetricValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  TPromptVars extends VarsTuple = readonly []
> {
  base: BaseMetricDef<TMetricValue>;
  runOnContainer: MultiTurnMetricDef<TMetricValue, TContainer>["runOnContainer"];
  provider: LLMMetricFields<TMetricValue, TPromptVars>["provider"]; // in this project: google('models/gemini-2.5-flash-lite')
  prompt: LLMMetricFields<TMetricValue, TPromptVars>["prompt"];
  rubric?: LLMMetricFields<TMetricValue, TPromptVars>["rubric"];
  postProcessing?: LLMMetricFields<TMetricValue, TPromptVars>["postProcessing"];
  normalization?: MetricNormalization<
    TMetricValue,
    NormalizationContextFor<TMetricValue>
  >;
  metadata?: Record<string, unknown>;
}
```

Output type:

```ts
type ConversationMetric<TMetricValue extends MetricScalar> =
  MetricDef<TMetricValue, MultiTurnContainer>;
```

Code snippet:

```ts
const metric = defineMultiTurnLLM<number>({
  base,
  provider,
  runOnContainer: async (conversation) => ({
    stepCount: conversation.steps.length,
  }),
  prompt,
});
```
