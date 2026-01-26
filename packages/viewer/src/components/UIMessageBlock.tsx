import { cn } from '@/lib/utils';
import type { UIMessage as UIMessageType } from '@/types';
import { Message, MessageContent, MessageResponse } from './ai-elements/message';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './ai-elements/tool';

interface UIMessageBlockProps {
  message: UIMessageType;
}

export const UIMessageBlock = ({ message }: UIMessageBlockProps) => {
  return (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {message.parts.map((part, i) => {
          switch (part.type) {
            case 'text':
              return <MessageResponse key={`${message.id}-${i}`}>{part.text}</MessageResponse>;
            case 'tool':
              return (
                <Tool
                  key={`${message.id}-${i}`}
                  defaultOpen={false}
                  className={cn('mt-2', message.parts[i + 1]?.type === 'tool' && '-mb-2')}
                >
                  <ToolHeader
                    type={`tool-${part.toolName}`}
                    state={part.output !== undefined ? 'completed' : 'running'}
                  />
                  <ToolContent>
                    <ToolInput input={part.input} />
                    <ToolOutput
                      output={
                        <pre className="code-block overflow-x-auto">
                          {JSON.stringify(part.output ?? null, null, 2)}
                        </pre>
                      }
                    />
                  </ToolContent>
                </Tool>
              );
            default:
              return null;
          }
        })}
      </MessageContent>
    </Message>
  );
};
