import { routeAgentRequest, type Schedule } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
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
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

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
- Checking weather in different cities (I'll ask for confirmation first)
- Getting current times in different locations worldwide
- Scheduling reminders and tasks (one-time, delayed, or recurring)
- Managing scheduled tasks

When users ask what you can do, give friendly examples like "I can search the web, tell you the weather, check times around the world, or help schedule reminders."

Use the web search tool whenever you need current information, recent news, or facts you're unsure about.

Current date: ${new Date().toLocaleDateString()}

Keep responses concise, natural, and helpful.`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >
        });

        writer.merge(result.toUIMessageStream());
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
      return Response.json({
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
