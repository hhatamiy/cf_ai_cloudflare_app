import { routeAgentRequest, type Schedule } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet,
  isToolUIPart,
  type UIMessage
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          // Clean up incomplete tool calls to prevent API errors
          const cleanedMessages = cleanupMessages(this.messages);
          
          // Log message state for debugging
          const lastCleanedMessage = cleanedMessages[cleanedMessages.length - 1];
          if (lastCleanedMessage?.role === "assistant") {
            const hasToolCall = lastCleanedMessage.parts?.some(part => 
              part.type.startsWith("tool-")
            );
            const hasEmptyText = lastCleanedMessage.parts?.some(part => 
              part.type === "text" && (!part.text || part.text.trim().length === 0)
            );
            if (hasToolCall && hasEmptyText) {
              console.warn("Detected assistant message with tool call and empty text - model may have stopped prematurely");
            }
          }

          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          let processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions
          });

          // CRITICAL FIX: Check if the last message is an assistant message with tool call but no text response
          // The model MUST always generate text after calling a tool, but sometimes it doesn't
          // If so, we need to add a system message to prompt the model to respond
          const lastProcessedMessage = processedMessages[processedMessages.length - 1];
          if (lastProcessedMessage?.role === "assistant" && lastProcessedMessage.parts) {
            // Check if there's any completed tool call
            const hasCompletedToolCall = lastProcessedMessage.parts.some((part) => {
              if (!isToolUIPart(part)) return false;
              const toolPart = part as any;
              return toolPart.state === "output-available";
            });
            
            // Check if there's any meaningful text content
            const hasNoTextContent = !lastProcessedMessage.parts.some((part) => 
              part.type === "text" && part.text && part.text.trim().length > 0
            );
            
            // If we have a tool call result but no text response, force the model to continue
            if (hasCompletedToolCall && hasNoTextContent) {
              console.warn("Tool call completed without text response - adding continuation prompt");
              
              // Check if the tool had an error
              const hasToolError = lastProcessedMessage.parts.some((part) => {
                if (!isToolUIPart(part)) return false;
                const toolPart = part as any;
                if (toolPart.state !== "output-available") return false;
                const output = typeof toolPart.output === "string" ? toolPart.output.toLowerCase() : "";
                return output.includes("error") || output.includes("invalid") || output.includes("failed");
              });
              
              // Add a user message to prompt the model to explain the tool result
              const promptText = hasToolError 
                ? "[System: The tool call failed with an error. Please explain to the user what went wrong and how they can provide the correct input format.]"
                : "[System: The tool call completed successfully. Please explain the result to the user in a natural, conversational way.]";
              
              processedMessages = [
                ...processedMessages,
                {
                  id: generateId(),
                  role: "user",
                  parts: [{
                    type: "text",
                    text: promptText
                  }],
                  metadata: {
                    createdAt: new Date()
                  }
                } as UIMessage
              ];
            }
          }

          // Create Workers AI instance with Llama 3.3 70B model
          const workersai = createWorkersAI({ binding: this.env.AI });
          // Use Llama 3.3 70B instruct model (fp8-fast variant for better performance)
          const model = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any);

          // Debug logging to see what messages are being sent
          console.log("Messages being sent to model:", JSON.stringify(processedMessages.slice(-3), null, 2));

          const result = streamText({
            system: `You are a helpful AI assistant. When users ask questions, you must ALWAYS provide a complete text answer.

CRITICAL RULE: NEVER stop without providing a text response. Even after using a tool, you MUST explain the result to the user in your own words.

Your process:
1. When a user asks a question, decide if you need a tool
2. If you need a tool (like getLocalTime, searchWeb, etc.), call it
3. After getting the tool result, IMMEDIATELY write a natural response explaining the result
4. NEVER end your turn without generating explanatory text

Example correct behavior:
- User: "What time is it in London?"
- You call getLocalTime tool → Get result: "Saturday, November 15, 2025 at 07:02:24 AM GMT"
- You MUST then write: "It's currently 7:02 AM on Saturday, November 15th in London."

Example WRONG behavior (NEVER do this):
- User: "What time is it in London?"
- You call getLocalTime tool → Get result
- You stop without explaining ❌ WRONG!

Available tools:
- getLocalTime: Get current time in any city
- getWeatherInformation: Get weather for any city
- searchWeb: Search the web for information
- scheduleTask: Schedule a task
- getScheduledTasks: List scheduled tasks
- cancelScheduledTask: Cancel a task

MANDATORY: After every tool call, write a conversational response. The tool result is not enough - explain it naturally.

Current date: ${new Date().toLocaleDateString()}

Be concise, friendly, and helpful.`,

            messages: convertToModelMessages(processedMessages),
            model,
            tools: allTools,
            // Note: Response length is controlled by the system prompt instructing concise responses
            // and by limiting tool output sizes (web search, scheduled tasks, etc.)
            // Type boundary: streamText expects specific tool types, but base class uses ToolSet
            // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
            onFinish: onFinish as unknown as StreamTextOnFinishCallback<
              typeof allTools
            >
          });

          // Merge the result stream - this handles tool calls and waits for results
          await writer.merge(result.toUIMessageStream());
          
          // CRITICAL FIX: After stream completes, check if we got a tool result but no text explanation
          // Wait a moment for messages to be saved, then check the actual messages
          await new Promise(resolve => setTimeout(resolve, 100));
          const currentMessages = this.messages;
          const lastMessage = currentMessages[currentMessages.length - 1];
          
          if (lastMessage?.role === "assistant" && lastMessage.parts) {
            // Check if there's a completed tool call
            const toolPart = lastMessage.parts.find((part) => {
              if (!isToolUIPart(part)) return false;
              const tp = part as any;
              return tp.state === "output-available";
            }) as any;
            
            // Check if there's no text content
            const hasNoTextContent = !lastMessage.parts.some((part) => 
              part.type === "text" && part.text && part.text.trim().length > 0
            );
            
            // If we have a tool result but no text, manually write a response
            if (toolPart && hasNoTextContent && toolPart.output) {
              console.warn("Tool completed but no text response - manually generating explanation");
              
              // Extract the tool output
              const toolOutput = typeof toolPart.output === "string" ? toolPart.output : JSON.stringify(toolPart.output);
              const toolName = toolPart.type.replace("tool-", "");
              
              // Generate a simple explanation based on the tool output
              let explanation = "";
              if (toolOutput.toLowerCase().includes("not found") || toolOutput.toLowerCase().includes("error")) {
                explanation = `I encountered an issue: ${toolOutput}`;
              } else if (toolName === "getLocalTime") {
                // Extract time from output like "Current time in London:\nSaturday, November 15, 2025 at 07:02:24 AM GMT"
                const timeMatch = toolOutput.match(/at (.+)$/m);
                if (timeMatch) {
                  explanation = `It's currently ${timeMatch[1]} in ${toolPart.input?.location || "that location"}.`;
                } else {
                  explanation = toolOutput;
                }
              } else if (toolName === "getWeatherInformation") {
                explanation = `Here's the weather information: ${toolOutput}`;
              } else {
                explanation = toolOutput;
              }
              
              // Write the explanation to the stream
              try {
                const textId = generateId();
                // Write text start, delta, and end
                await writer.write({
                  type: "text-start",
                  id: textId
                });
                await writer.write({
                  type: "text-delta",
                  delta: explanation,
                  id: textId
                });
                await writer.write({
                  type: "text-end",
                  id: textId
                });
              } catch (writeError) {
                // If stream is already closed, update the message directly
                console.warn("Stream closed, updating message directly:", writeError);
                try {
                  // Update the last message to include the text explanation
                  const updatedMessages = [...currentMessages];
                  const lastIndex = updatedMessages.length - 1;
                  if (updatedMessages[lastIndex]?.role === "assistant") {
                    updatedMessages[lastIndex] = {
                      ...updatedMessages[lastIndex],
                      parts: [
                        ...(updatedMessages[lastIndex].parts || []),
                        {
                          type: "text",
                          text: explanation
                        }
                      ]
                    };
                    await this.saveMessages(updatedMessages);
                  }
                } catch (saveError) {
                  console.error("Error updating message directly:", saveError);
                }
              }
            }
          }
        } catch (error) {
          // Handle stream errors gracefully
          console.error("Stream execution error:", error);
          console.error("Error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          
          // Only try to write to the stream if it's not already errored
          // Check if the error is about an already-errored stream
          const isStreamErrored = error instanceof Error && 
            (error.message.includes("errored readable stream") || 
             error.message.includes("Cannot close"));
          
          // Check for specific error types to provide better user feedback
          const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          let userMessage = "I apologize, but I encountered an error processing your request. Please try again.";
          
          if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
            userMessage = "I've hit a rate limit. Please wait a moment and try again.";
          } else if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
            userMessage = "The request timed out. Please try again with a simpler query.";
          } else if (errorMessage.includes("too large") || errorMessage.includes("payload") || errorMessage.includes("size")) {
            userMessage = "The response was too large. Please try a more specific query.";
          }
          
          if (!isStreamErrored) {
            try {
              // Try to write an error message to the stream
              await writer.write({
                type: "text-delta",
                delta: userMessage,
                id: generateId()
              });
            } catch (writeError) {
              // If writing fails, the stream is likely already closed/errored
              // This is expected and can be safely ignored - the error is from the agents library
              // trying to close an already-errored stream, which is a known non-critical issue
              console.error("Error writing to stream (stream may be closed):", writeError);
            }
          } else {
            // Stream is already errored, don't try to write to it
            console.warn("Stream is already errored, skipping error message write");
          }
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Check if Workers AI binding is available
    if (url.pathname === "/health") {
      return await Response.json({
        success: !!env.AI,
        aiAvailable: !!env.AI
      });
    }
    
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
