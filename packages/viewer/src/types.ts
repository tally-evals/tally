
export type UIMessagePart =
| { type: "text"; text: string }
| {
    type: "tool";
    toolCallId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
  };

export type UIMessage = {
  id: string;
  role: string;
  parts: UIMessagePart[];
};