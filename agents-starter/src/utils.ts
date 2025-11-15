// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type {
  UIMessage,
  UIMessageStreamWriter,
  ToolSet,
  ToolCallOptions
} from "ai";
import { convertToModelMessages, isToolUIPart } from "ai";
import { APPROVAL } from "./shared";

function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T
): key is K & keyof T {
  return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 */
export async function processToolCalls<Tools extends ToolSet>({
  dataStream,
  messages,
  executions
}: {
  tools: Tools; // used for type inference
  dataStream: UIMessageStreamWriter;
  messages: UIMessage[];
  executions: Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: needs a better type
    (args: any, context: ToolCallOptions) => Promise<unknown>
  >;
}): Promise<UIMessage[]> {
  // Process all messages, not just the last one
  const processedMessages = await Promise.all(
    messages.map(async (message) => {
      const parts = message.parts;
      if (!parts) return message;

      const processedParts = await Promise.all(
        parts.map(async (part) => {
          // Only process tool UI parts
          if (!isToolUIPart(part)) return part;

          const toolName = part.type.replace(
            "tool-",
            ""
          ) as keyof typeof executions;

          // Only process tools that require confirmation (are in executions object) and are in 'input-available' state
          if (!(toolName in executions) || part.state !== "output-available")
            return part;

          let result: unknown;

          if (part.output === APPROVAL.YES) {
            // User approved the tool execution
            if (!isValidToolName(toolName, executions)) {
              return part;
            }

            const toolInstance = executions[toolName];
            if (toolInstance) {
              result = await toolInstance(part.input, {
                messages: convertToModelMessages(messages),
                toolCallId: part.toolCallId
              });
            } else {
              result = "Error: No execute function found on tool";
            }
          } else if (part.output === APPROVAL.NO) {
            result = "Error: User denied access to tool execution";
          } else {
            // If no approval input yet, leave the part as-is for user interaction
            return part;
          }

          // Forward updated tool result to the client.
          dataStream.write({
            type: "tool-output-available",
            toolCallId: part.toolCallId,
            output: result
          });

          // Return updated tool part with the actual result.
          return {
            ...part,
            output: result
          };
        })
      );

      return { ...message, parts: processedParts };
    })
  );

  return processedMessages;
}

/**
 * Clean up incomplete tool calls from messages before sending to API
 * Prevents API errors from interrupted or failed tool executions
 * Also converts tool errors to proper format so the model can see them
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  const cleaned = messages.map((message) => {
    if (!message.parts) return message;

    // Filter out messages with tool calls that are still streaming
    const hasStreamingToolCall = message.parts.some((part) => {
      if (!isToolUIPart(part)) return false;
      return part.state === "input-streaming";
    });

    if (hasStreamingToolCall) {
      return null; // Filter out this message
    }

    // Process tool parts to convert errors to proper format
    const processedParts = message.parts.map((part) => {
      // Convert tool errors to have the error as output so the model can see it
      if (isToolUIPart(part) && part.state === "output-error") {
        // Extract error text from the part
        const errorText = (part as any).errorText || "An error occurred while executing the tool";
        // Convert to output-available state with error as output
        // Remove errorText property since it's not allowed in output-available state
        const { errorText: _, ...partWithoutErrorText } = part as any;
        return {
          ...partWithoutErrorText,
          state: "output-available" as const,
          output: errorText
        };
      }
      return part;
    });

    // For assistant messages with tool calls, remove empty text parts
    // Empty text parts before tool calls can cause the model to think it's done
    if (message.role === "assistant" && processedParts) {
      const hasToolCall = processedParts.some((part) => isToolUIPart(part));
      if (hasToolCall) {
        const cleanedParts = processedParts.filter((part) => {
          // Remove empty text parts that come before tool calls
          if (part.type === "text" && (!part.text || part.text.trim().length === 0)) {
            return false;
          }
          return true;
        });
        return { ...message, parts: cleanedParts };
      }
    }

    return { ...message, parts: processedParts };
  }).filter((msg): msg is UIMessage => msg !== null);

  return cleaned;
}
