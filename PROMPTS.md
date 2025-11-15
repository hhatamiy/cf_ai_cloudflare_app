# AI Prompts Used in Development

This document contains all AI prompts used during the development of this Cloudflare AI application. AI-assisted coding was used throughout the project to help with implementation, debugging, and optimization.

## Initial Project Setup

### Prompt 1: Understanding the Assignment Requirements
```
I need to build a Cloudflare AI app assignment that includes:
1. LLM (recommend using Llama 3.3 on Workers AI)
2. Workflow/coordination (Workflows, Workers, or Durable Objects)
3. User input via chat or voice (Pages or Realtime)
4. Memory or state

Help me understand the steps I need to do to build this, referencing the Cloudflare Agents documentation.
```

**Purpose**: Understand the project requirements and plan the implementation approach.

**Context**: Initial planning phase to map out what components need to be built.

---

## Code Implementation

### Prompt 2: Switching from OpenAI to Workers AI
```
I have a Cloudflare Agents starter project that currently uses OpenAI. I need to switch it to use Llama 3.3 on Workers AI. The project uses the @ai-sdk/openai package and I see workers-ai-provider is already installed. Help me update the server.ts file to use Workers AI instead of OpenAI.
```

**Purpose**: Migrate from OpenAI to Cloudflare Workers AI to meet assignment requirements.

**Context**: The assignment specifically recommends using Llama 3.3 on Workers AI, but the starter template used OpenAI by default.

**Implementation Details**:
- Replaced `import { openai } from "@ai-sdk/openai"` with `import { createWorkersAI } from "workers-ai-provider"`
- Changed model initialization from `openai("gpt-4o-2024-11-20")` to `createWorkersAI({ binding: this.env.AI })`
- Updated model name to `"@cf/meta/llama-3.3-70b-instruct-fp8-fast"`
- Removed OpenAI API key checks and replaced with Workers AI health check

---

### Prompt 3: Fixing TypeScript Model Name Error
```
I'm getting a TypeScript error when trying to use the Llama 3.3 model with workers-ai-provider. The error says: "Argument of type '@cf/meta/llama-3.3-70b-instruct' is not assignable to parameter of type 'TextGenerationModels'". What's the correct model name format?
```

**Purpose**: Resolve TypeScript type errors related to model names.

**Context**: The workers-ai-provider has strict typing for model names, and needed to use the correct format or type assertion.

**Resolution**: Used `"@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any` to bypass strict typing while maintaining functionality.

---

## Documentation

### Prompt 4: Creating Comprehensive README
```
I need to create a comprehensive README.md file for my Cloudflare AI assignment that includes:
- Project overview and features
- Assignment requirements checklist
- Architecture overview
- Step-by-step setup instructions
- Usage examples
- Deployment instructions
- Testing guidelines

Make sure it clearly demonstrates all the required components (LLM, Workflow, User Input, Memory/State) are present and working.
```

**Purpose**: Create documentation that clearly shows all assignment requirements are met and provides clear instructions for running the project.

**Context**: Assignment requires README.md with project documentation and clear running instructions.

---

### Prompt 5: Creating PROMPTS.md
```
I need to create a PROMPTS.md file that documents all the AI prompts I used during development. This is a requirement for the assignment. Please help me structure this file with the prompts, their purposes, and context.
```

**Purpose**: Document all AI-assisted development prompts as required by the assignment.

**Context**: Assignment explicitly requires PROMPTS.md with AI prompts used during development.

---

## Code Review and Verification

### Prompt 6: Verifying Assignment Requirements
```
I need to verify that my Cloudflare AI app meets all assignment requirements:
1. LLM - Should I verify Llama 3.3 is correctly configured?
2. Workflow/Coordination - Durable Objects are used via Agents SDK, is this sufficient?
3. User Input - WebSockets via Agents SDK provides real-time chat, does this count?
4. Memory/State - Durable Objects with SQLite provide persistence, is this correct?

Help me verify each requirement is met and suggest any improvements.
```

**Purpose**: Ensure all assignment requirements are properly fulfilled.

**Context**: Final verification before submission to ensure completeness.

**Verification Results**:
- ✅ LLM: Llama 3.3 70B Instruct (fp8-fast) via Workers AI
- ✅ Workflow/Coordination: Durable Objects via Cloudflare Agents SDK
- ✅ User Input: Real-time chat via WebSockets (Cloudflare Realtime through Agents SDK)
- ✅ Memory/State: Persistent state through Durable Objects with SQLite storage

---

## Additional Development Prompts

### Prompt 7: Understanding Durable Objects Configuration
```
I see the wrangler.jsonc file has durable_objects and migrations configured. Can you explain how this enables state persistence in my agent? What does the new_sqlite_classes migration do?
```

**Purpose**: Understand how state persistence works in the Cloudflare Agents SDK.

**Context**: Need to confirm that memory/state requirement is properly implemented.

**Learning**: 
- Durable Objects provide stateful execution
- The migration with `new_sqlite_classes` sets up SQLite storage for the agent
- This enables conversation history and state to persist across sessions

---

### Prompt 8: Tool System Implementation
```
The tools.ts file has some tools with execute functions and some without. Can you explain the difference and how the human-in-the-loop confirmation works?
```

**Purpose**: Understand the tool system architecture.

**Context**: The application includes a sophisticated tool system that needs to be documented.

**Understanding**:
- Tools with `execute`: Run automatically without user confirmation
- Tools without `execute`: Require user confirmation (human-in-the-loop)
- The `executions` object contains handlers for confirmed tool invocations

---

## Best Practices and Optimization

### Prompt 9: Model Selection
```
Should I use the fp8-fast variant of Llama 3.3 70B or the regular version? What are the tradeoffs?
```

**Purpose**: Choose the optimal model variant for the application.

**Context**: Multiple Llama 3.3 variants are available, need to select the best one.

**Decision**: Used `llama-3.3-70b-instruct-fp8-fast` for better performance while maintaining model quality.

---

### Prompt 10: Error Handling
```
How should I handle cases where the Workers AI binding might not be available or the model fails? Should I add error handling in the onChatMessage method?
```

**Purpose**: Improve application robustness.

**Context**: Production applications need proper error handling.

**Implementation**: Added health check endpoint and error logging, with graceful degradation recommendations.

---

## Error Handling and Debugging

### Prompt 11: Fixing OpenAI Key Check Error
```
The application is showing a blank screen with console errors about "check-open-ai-key" endpoint not found and "HasOpenAIKey" component errors. We switched to Workers AI but the frontend still checks for OpenAI keys. How do I remove this check?
```

**Purpose**: Remove legacy OpenAI key validation that's causing the app to fail.

**Context**: After switching from OpenAI to Workers AI (Llama 3.3), the frontend still had code checking for OpenAI API keys, causing:
- 404 error on `/check-open-ai-key` endpoint
- React component error in `HasOpenAIKey`
- Blank screen preventing app from loading

**Solution Implemented**:
1. Removed `HasOpenAIKey` component from `app.tsx`
2. Removed `hasOpenAiKeyPromise` fetch call
3. Removed unused `use` React import
4. Removed corresponding `/check-open-ai-key` endpoint check from server

**Files Modified**:
- `agents-starter/src/app.tsx`: Removed OpenAI key check component and related code

---

### Prompt 12: Understanding Console Warnings
```
I see ReadableStream errors in the console about "Cannot close an errored readable stream". The app works fine but these errors appear. What are they and should I fix them?
```

**Purpose**: Understand non-breaking console warnings.

**Context**: After deployment, browser console shows warnings:
```
Uncaught TypeError: Failed to execute 'close' on 'ReadableStreamDefaultController': 
Cannot close an errored readable stream
```

**Analysis**:
- These are internal warnings from the `agents` library's WebSocket stream handling
- They occur during cleanup of AI streaming responses
- **They do not break functionality** - the chat works perfectly
- Common in streaming applications with real-time data

**Resolution**: 
- No code changes needed - these are library internals
- The errors are non-blocking and don't affect user experience
- Future versions of the agents library may handle these more gracefully

---

## Deployment Troubleshooting

### Prompt 13: Assets Directory Not Found Error
```
Deployment fails with error: "The directory specified by the 'assets.directory' field in your configuration file does not exist: /opt/buildhome/repo/agents-starter/dist/client"
```

**Purpose**: Fix deployment configuration so build runs before deploy.

**Context**: CI/CD was running `npx wrangler deploy` directly without building first, so the assets directory didn't exist.

**Solution**:
1. Updated root `package.json` scripts to delegate properly to `agents-starter/`
2. Changed deploy script from direct wrangler commands to using npm scripts
3. Ensured build runs before deploy: `"deploy": "cd agents-starter && npm run deploy"`

**Learning**: In CI/CD environments, ensure the build process creates all necessary files before deployment attempts to reference them.

---

### Prompt 14: Vite Command Not Found
```
Running `npm run deploy` fails with "sh: vite: command not found" even though vite is installed in package.json
```

**Purpose**: Fix script execution to use locally installed binaries.

**Context**: Running `vite build` directly from root doesn't work because vite is installed in `agents-starter/node_modules`.

**Solution**: 
- Changed scripts to use npm run commands which properly resolve local node_modules bins
- Updated root package.json to delegate all commands to agents-starter:
  ```json
  "build": "cd agents-starter && npm run build",
  "deploy": "cd agents-starter && npm run deploy"
  ```

**Learning**: Always use `npm run <script>` or `npx <command>` to ensure locally installed binaries are found in node_modules/.bin.

---

---

### Prompt 15: Improving AI Response Quality
```
The AI responses are too robotic - it's listing technical function names like "getWeatherInformation" and "scheduleTask" instead of talking naturally. The responses sound mechanical and unhelpful. How can I make the AI more conversational and human-like?
```

**Purpose**: Improve AI conversation quality and make responses more natural.

**Context**: Users reported that the AI was:
- Listing technical function/tool names instead of natural language
- Being overly technical and robotic in responses
- Not engaging conversationally
- Example: Instead of saying "I can check the weather for you", it said "getWeatherInformation - show the weather..."

**Solution Implemented**:

1. **Rewrote system prompt to be conversational**:
```typescript
system: `You are a helpful, friendly AI assistant powered by Llama 3.3. 

Be conversational and natural - talk like a helpful human, not a robot. Don't list technical function names or internal details.

You can help with:
- Answering questions about any topic
- Checking weather in different cities (I'll ask for confirmation first)
- Getting current times in different locations worldwide
- Scheduling reminders and tasks (one-time, delayed, or recurring)
- Managing scheduled tasks

When users ask what you can do, give friendly examples like "I can tell you the weather, check times around the world, or help schedule reminders."

Keep responses concise, natural, and helpful.`
```

2. **Key improvements**:
   - Explicitly instructed to avoid technical names
   - Added "talk like a helpful human, not a robot"
   - Provided examples of natural phrasing
   - Focused on user-friendly descriptions

3. **Before vs After**:
   - **Before**: "I can perform the following functions:getWeatherInformation - show the weather in a given city to the usergetLocalTime - get the local time for a specified location..."
   - **After**: "I can help you check the weather in any city, find out what time it is around the world, or schedule reminders and tasks!"

**Files Modified**:
- `agents-starter/src/server.ts`: Updated system prompt for natural conversation

**Learning**: AI behavior is heavily influenced by system prompt phrasing. Being explicit about conversational tone and providing examples of desired output style significantly improves response quality.

---

### Prompt 15: Adding Web Search Capability
```
How do I give the AI more functionality? Like it can't do anything properly. For example, I want it to be able to search the web.

Follow-up: I just added the BRAVE_SEARCH_API_KEY to the .env file. Make the bot able to search the web.
```

**Purpose**: Extend the AI's capabilities by adding real-time web search functionality through Brave Search API integration.

**Context**: User wanted to enhance the AI assistant's abilities beyond basic tool calls. Web search enables the AI to access current information, news, and facts it wasn't trained on.

**Solution**:
1. **Added Web Search Tool** (`agents-starter/src/tools.ts`):
   - Created `searchWeb` tool using Brave Search API
   - Auto-executes without confirmation (read-only operation)
   - Returns top 5 formatted search results
   - Includes error handling for API failures

```typescript
const searchWeb = tool({
  description: "Search the web for current information, news, facts, or any topic. Use this when you need up-to-date information that you don't already know.",
  inputSchema: z.object({ 
    query: z.string().describe("The search query")
  }),
  execute: async ({ query }) => {
    const { agent } = getCurrentAgent<Chat>();
    const apiKey = (agent as any)?.env.BRAVE_SEARCH_API_KEY;
    
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );
    
    const data = await response.json();
    const results = data.web?.results?.slice(0, 5);
    return formattedResults;
  }
});
```

2. **Updated Environment Configuration**:
   - Added `BRAVE_SEARCH_API_KEY: string` to `env.d.ts` Env interface
   - API key needs to be set via Cloudflare secrets for production deployment

3. **Updated System Prompt** (`agents-starter/src/server.ts`):
   - Added "Searching the web for current information, news, and facts" to capabilities list
   - Instructed AI to "Use the web search tool whenever you need current information, recent news, or facts you're unsure about"

4. **Fixed Linting Errors**:
   - Used type assertion `(agent as any)?.env` to access protected env property
   - Removed unused imports (`getSchedulePrompt`, `stepCountIs`)
   - Removed unsupported `maxSteps` parameter from `streamText`

**Technical Challenges**:
- Protected property access: `agent.env` is protected in DurableObject class, required type assertion
- Environment variable binding: Had to use Cloudflare's secret management system
- API integration: Formatting Brave Search results for AI consumption

**Deployment Requirements**:
```bash
# For local development (.dev.vars file):
BRAVE_SEARCH_API_KEY=your_key_here

# For production (Cloudflare secret):
cd agents-starter
wrangler secret put BRAVE_SEARCH_API_KEY
# Enter key when prompted
```

**Files Modified**:
- `agents-starter/src/tools.ts`: Added searchWeb tool and exported it
- `agents-starter/src/server.ts`: Updated system prompt with web search capability
- `agents-starter/env.d.ts`: Added BRAVE_SEARCH_API_KEY type definition

**Additional Tool Ideas Discussed**:
- Calculator/Math tool for complex calculations
- Image generation using Cloudflare AI (@cf/stabilityai/stable-diffusion-xl-base-1.0)
- Code execution (with human confirmation for safety)
- Database queries (if using D1)

**Learning**: Tools are the primary way to extend AI capabilities. Auto-execute tools (with `execute` function) run immediately, while confirmation-required tools (without `execute`) present a dialog to the user first. Web search significantly improves the AI's usefulness for current events and factual queries.

---

### Prompt 16: Adding Loading Indicator for Better UX
```
When I ask the AI a question, I get an empty response. 
Here are some potential things I think about adding:

1. Add a "loading" sign that shows the message is loading, before the message is sent
2. Check why the chatbot responds empty some times
```

**Purpose**: Improve user experience by adding visual feedback when the AI is processing a request, and investigate empty response issues.

**Context**: Users were seeing empty responses from the AI and wanted better feedback during the thinking/processing phase. The lack of loading indicator made it unclear whether the app was working or frozen.

**Solution**:

1. **Added Loading Indicator** (`agents-starter/src/app.tsx`):
   - Created an animated "AI is thinking..." message that appears during processing
   - Shows when status is "submitted" or "streaming"
   - Uses bouncing dots animation with staggered delays for smooth effect
   - Styled consistently with other messages using Avatar and Card components

```typescript
{/* Loading indicator when AI is thinking */}
{(status === "submitted" || status === "streaming") && (
  <div className="flex justify-start">
    <div className="flex gap-2 max-w-[85%]">
      <Avatar username={"AI"} />
      <div>
        <Card className="p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 rounded-bl-none border-assistant-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
            </div>
            <span className="text-sm text-muted-foreground">AI is thinking...</span>
          </div>
        </Card>
      </div>
    </div>
  </div>
)}
```

2. **Identified Empty Response Issue**:
   - The empty responses were due to web search API errors (422 status)
   - Fixed by ensuring `.dev.vars` file (not `.env`) has the correct API key
   - Cloudflare Workers specifically use `.dev.vars` for local development secrets

**Implementation Details**:
- **Status tracking**: Uses existing `status` variable from `useAgentChat` hook
- **Conditional rendering**: Only shows when AI is actively processing
- **Animation**: Three dots with staggered `animationDelay` create wave effect
- **Positioning**: Placed after messages but before `messagesEndRef` for proper scrolling
- **Styling**: Matches existing message card styling for visual consistency

**UX Improvements**:
- ✅ Clear visual feedback that request is being processed
- ✅ Reduces user anxiety about whether app is working
- ✅ Professional, polished appearance
- ✅ Consistent with modern chat UI patterns (ChatGPT, Claude, etc.)

**Files Modified**:
- `agents-starter/src/app.tsx`: Added loading indicator component

**Common Pitfall Identified**:
- `.env` files don't work with Cloudflare Workers
- Must use `.dev.vars` for local development
- Must use `wrangler secret put` for production deployment
- This is a frequent source of "empty response" or "API key missing" errors

**Learning**: Good UX requires immediate feedback for user actions. Loading states are critical for asynchronous operations. Also, each platform has its own conventions for environment variables - understanding the deployment target's requirements is essential.

---

## Summary

All prompts above were used during the development of this Cloudflare AI application. The development process leveraged AI assistance for:

1. **Planning**: Understanding requirements and architecture
2. **Implementation**: Code migration and feature development  
3. **Problem Solving**: Debugging and fixing issues (blank screens, deployment errors, build issues)
4. **Error Handling**: Identifying and resolving both critical and non-critical errors
5. **Documentation**: Creating comprehensive project documentation
6. **Verification**: Ensuring all requirements are met
7. **Deployment**: Troubleshooting and fixing CI/CD configuration issues

### Key Learnings

- **Incremental Problem Solving**: Break down complex errors into smaller, manageable issues
- **Error Classification**: Distinguish between critical errors (broken functionality) and warnings (cosmetic issues)
- **Environment Awareness**: Local development vs production deployment have different constraints
- **Dependency Management**: Understand where binaries are installed and how to execute them correctly
- **Configuration Cascading**: How wrangler configs, package.json scripts, and build tools interact

AI-assisted coding significantly accelerated development while maintaining code quality and ensuring all assignment requirements are properly fulfilled. The debugging process demonstrated the importance of systematic error analysis and understanding the full stack from frontend React to Workers deployment.

