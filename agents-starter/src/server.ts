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

          // CRITICAL FIX: Check if the last message is an assistant message with tool error but no text
          // If so, we need to add a system message to prompt the model to respond
          const lastProcessedMessage = processedMessages[processedMessages.length - 1];
          if (lastProcessedMessage?.role === "assistant" && lastProcessedMessage.parts) {
            const hasToolError = lastProcessedMessage.parts.some((part) => {
              if (!isToolUIPart(part)) return false;
              // Type assertion needed because isToolUIPart narrows the type
              const toolPart = part as any;
              if (toolPart.state !== "output-available") return false;
              const output = typeof toolPart.output === "string" ? toolPart.output.toLowerCase() : "";
              return output.includes("error") || output.includes("invalid") || output.includes("failed");
            });
            
            const hasNoTextContent = !lastProcessedMessage.parts.some((part) => 
              part.type === "text" && part.text && part.text.trim().length > 0
            );
            
            if (hasToolError && hasNoTextContent) {
              console.warn("Tool error without text response detected - adding continuation prompt");
              // Add a user message to prompt the model to explain the error
              processedMessages = [
                ...processedMessages,
                {
                  id: generateId(),
                  role: "user",
                  parts: [{
                    type: "text",
                    text: "[System: The tool call failed with an error. Please explain to the user what went wrong and how they can provide the correct input format.]"
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

          const result = streamText({
            system: `You are a helpful, friendly AI assistant powered by Llama 3.3. 

Be conversational and natural - talk like a helpful human, not a robot. Don't list technical function names or internal details.

You can help with:
- Answering questions about any topic
- Searching the web for current information, news, and facts
- Checking weather in different cities
- Getting current times in different locations worldwide
- Scheduling reminders and tasks (one-time, delayed, or recurring)
- Managing scheduled tasks

CRITICAL: When you need to use tools (like searching the web, getting weather, scheduling tasks), use them naturally through the tool calling system. DO NOT output tool calls as text or JSON in your response. Never include JSON like {"type": "function", "name": "...", "parameters": {}} in your text responses. Just use the tools normally - they will be called automatically in the background.

CRITICAL - TOOL CALL FOLLOW-UP: After ANY tool call completes (whether it succeeds or fails), you MUST ALWAYS generate a text response to the user. Tool results are just data - you must interpret them and write a complete, conversational response. NEVER end your response after just calling a tool. 

IMPORTANT - VALIDATION ERRORS: If a tool call fails due to invalid input (validation error), you MUST:
1. Read the error message carefully to understand what went wrong
2. Write a friendly message explaining the issue to the user
3. Provide specific guidance on the correct format or valid inputs
4. Offer to help with a corrected version
Example: If scheduling fails with "Invalid date" for "tomorrow", explain that dates need to be in YYYY-MM-DD format and suggest using a specific date like "2025-11-16".

Examples of proper follow-up:
- If you call searchWeb and get results, write a paragraph summarizing and answering the user's question
- If you call getWeatherInformation and get weather data, write a friendly message sharing that weather information
- If a tool returns an error message, write a helpful response explaining the situation to the user and suggest alternatives if possible
- If a tool validation fails, explain what input format is expected and give examples
- ALWAYS provide a text response after tool calls - the tool result alone is never sufficient
- IMPORTANT: Even if a tool fails with an error, you MUST still generate a complete text response explaining what went wrong and how the user can proceed

IMPORTANT FORMATTING RULES:
- When listing items, use proper markdown with line breaks between each item
- For numbered lists, put each number on a new line
- For bullet lists, put each bullet on a new line
- Use double line breaks between paragraphs
- Example of good formatting:
  "I can help you with:
  
  1. Searching the web for information
  2. Getting weather updates
  3. Scheduling tasks"

When users ask what you can do, give friendly examples in a natural conversational way, not as a formatted list.

Use the web search tool whenever you need current information, recent news, or facts you're unsure about.

Current date: ${new Date().toLocaleDateString()}

Keep responses concise, natural, and helpful. Limit responses to 2-3 paragraphs when possible.`,

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
