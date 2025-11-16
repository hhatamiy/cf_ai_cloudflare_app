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
  isToolUIPart
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

          // Note: Tool call handling is done after streamText completes
          // See the multi-turn loop implementation below

          // Create Workers AI instance with Llama 3.3 70B model
          const workersai = createWorkersAI({ binding: this.env.AI });
          // Use Llama 3.3 70B instruct model (fp8-fast variant for better performance)
          const model = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any);

          // Debug logging to see what messages are being sent
          console.log("Messages being sent to model:", JSON.stringify(processedMessages.slice(-3), null, 2));

          const result = streamText({
            system: `You are a helpful, knowledgeable AI assistant. When users ask questions, you provide thorough, detailed, and engaging responses.

RESPONSE STYLE:
- Write detailed, comprehensive answers (3-5 sentences minimum for most queries)
- Use natural, conversational language that's easy to understand
- Add context and relevant details to make responses more informative
- Be friendly, professional, and helpful
- When appropriate, provide additional insights or related information

TOOL USAGE RULES (CRITICAL):
1. When a user asks a question, determine if you need a tool
2. If you need a tool (getLocalTime, getWeatherInformation, searchWeb, etc.), call it
3. After getting the tool result, you MUST write a detailed natural response explaining the result
4. NEVER end your turn without generating a thorough text explanation

Example of CORRECT behavior:
- User: "What time is it in London?"
- You call getLocalTime tool → Get result: "Saturday, November 15, 2025 at 07:02:24 AM GMT"
- You write: "The current time in London is 7:02 AM on Saturday, November 15th, 2025. London is currently observing Greenwich Mean Time (GMT), which is the standard time zone for the UK during winter months. It's early morning there, so most people are probably just starting their day!"

Example of WRONG behavior (NEVER do this):
- User: "What time is it in London?"
- You call getLocalTime tool → Get result
- You stop without explaining ❌ WRONG!

Available tools:
- getLocalTime: Get current time in any city
- getWeatherInformation: Get weather for any city (temperature, conditions, humidity, wind)
- searchWeb: Search the web for current information and news
- scheduleTask: Schedule a task for later execution
- getScheduledTasks: List all scheduled tasks
- cancelScheduledTask: Cancel a specific task

MANDATORY: After every tool call, write a detailed, conversational response that explains and contextualizes the result. Raw tool output is never enough.

Current date: ${new Date().toLocaleDateString()}

Remember: Be thorough, engaging, and always explain your findings in detail.`,

            messages: convertToModelMessages(processedMessages),
            model,
            tools: allTools,
            // Note: Response length is now encouraged to be detailed and comprehensive
            // Tool output sizes are limited (web search, scheduled tasks, etc.) to prevent overflow
            // Type boundary: streamText expects specific tool types, but base class uses ToolSet
            // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
            onFinish: onFinish as unknown as StreamTextOnFinishCallback<
              typeof allTools
            >
          });

          // Merge the result stream - this handles tool calls and waits for results
          await writer.merge(result.toUIMessageStream());
          
          // CRITICAL FIX FOR LLAMA MODELS: Multi-turn tool execution flow
          // Wait a moment for messages to be saved after stream completes
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Check the actual messages to see if tool calls completed without text response
          const currentMessages = this.messages;
          const lastMessage = currentMessages[currentMessages.length - 1];
          
          if (lastMessage?.role === "assistant" && lastMessage.parts) {
            // Check if there are completed tool calls
            const toolParts = lastMessage.parts.filter((part) => {
              if (!isToolUIPart(part)) return false;
              const tp = part as any;
              return tp.state === "output-available";
            });
            
            // Check if there's no text content
            const hasNoTextContent = !lastMessage.parts.some((part) => 
              part.type === "text" && part.text && part.text.trim().length > 0
            );
            
            // If we have tool results but no text response, call the model again
            if (toolParts.length > 0 && hasNoTextContent) {
              console.warn("Tool call(s) completed without text response - calling model again");
              
              // Add an explicit user message to prompt the model to respond
              // This is more reliable than system prompts for Llama models
              const messagesWithPrompt = [
                ...currentMessages,
                {
                  id: generateId(),
                  role: "user" as const,
                  parts: [{
                    type: "text" as const,
                    text: "Please explain the tool result above to me in a clear, natural way."
                  }],
                  metadata: {
                    createdAt: new Date()
                  }
                }
              ];
              
              // Create continuation WITHOUT providing tools to prevent infinite loops
              const continuationResult = streamText({
                system: `You are a helpful, knowledgeable AI assistant. The user is asking you to explain the tool result that was just returned.

Write a detailed, thorough response that:
- Clearly explains what the tool found
- Provides context and additional insights
- Uses natural, conversational language
- Is 3-5 sentences long to be comprehensive
- Adds value beyond just repeating the raw data

Be engaging, informative, and helpful!`,
                messages: convertToModelMessages(messagesWithPrompt),
                model,
                // CRITICAL: Don't pass tools to continuation to prevent calling tools again
                onFinish: onFinish as unknown as StreamTextOnFinishCallback<typeof allTools>
              });
              
              // Merge the continuation response into the stream
              await writer.merge(continuationResult.toUIMessageStream());
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
