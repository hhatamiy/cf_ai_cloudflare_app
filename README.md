# cf_ai_cloudflare_app

An AI-powered chat application built on Cloudflare's platform using the Agents SDK. This application demonstrates a complete AI agent implementation with real-time chat capabilities, task scheduling, tool integration, and persistent state management.

## 📋 Assignment Requirements

This project fulfills all requirements for the Cloudflare AI app assignment:

✅ **LLM**: Uses Llama 3.3 70B Instruct (fp8-fast) on Workers AI  
✅ **Workflow/Coordination**: Implemented using Durable Objects via Cloudflare Agents SDK  
✅ **User Input**: Real-time chat interface via WebSockets (using Cloudflare Realtime)  
✅ **Memory/State**: Persistent state management through Durable Objects with SQLite storage  

## 🚀 Features

- 💬 **Real-time Chat Interface**: Interactive chat UI with streaming AI responses
- 🤖 **AI-Powered Assistant**: Powered by Meta's Llama 3.3 70B Instruct model via Workers AI
- 🔍 **Web Search Integration**: Real-time web search powered by Brave Search API
- 🛠️ **Tool Integration**: Extensible tool system with human-in-the-loop confirmations
- 📅 **Task Scheduling**: Schedule one-time, delayed, or recurring tasks using cron patterns
- 💾 **Persistent State**: Conversation history and state persisted in Durable Objects
- 💬 **Chat History**: Create, switch between, and delete multiple chat conversations
- 🌓 **Dark/Light Theme**: Modern UI with theme support
- ⚡ **Real-time Updates**: WebSocket-based real-time communication

## 🏗️ Architecture

### Components

1. **Chat Agent (Durable Object)**: 
   - Extends `AIChatAgent` from Cloudflare Agents SDK
   - Handles WebSocket connections for real-time chat
   - Manages conversation state and message history
   - Executes tools and scheduled tasks

2. **Worker (Cloudflare Worker)**:
   - Routes requests to the appropriate agent
   - Serves static assets for the frontend
   - Handles health checks

3. **Frontend (React)**:
   - Modern chat interface built with React
   - Real-time message streaming
   - Tool confirmation dialogs
   - Theme switching

### Technology Stack

- **Runtime**: Cloudflare Workers
- **State Management**: Durable Objects with SQLite
- **AI Model**: Llama 3.3 70B Instruct (fp8-fast) via Workers AI
- **Frontend**: React with Vite
- **Real-time**: WebSockets via Agents SDK
- **AI SDK**: Vercel AI SDK with workers-ai-provider

## 📦 Prerequisites

Before running this project, ensure you have:

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Version 16.17.0 or later ([download](https://nodejs.org/))
3. **npm**: Comes with Node.js
4. **Wrangler CLI**: Will be installed as a dev dependency

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd cf_ai_cloudflare_app/agents-starter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open a browser window for you to authenticate with your Cloudflare account.

### 4. Accept Meta's Llama 3.3 License

Before using the Llama 3.3 model, you must accept Meta's License and Acceptable Use Policy. You can do this through:

1. **Cloudflare Dashboard**: Navigate to Workers AI section and accept the license
2. **API Call**: Use the following command (replace with your credentials):

```bash
curl https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast \
  -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_AUTH_TOKEN" \
  -d '{ "prompt": "agree" }'
```

### 5. Configure Web Search (Optional but Recommended)

The AI assistant can search the web using Brave Search API. To enable this feature:

1. **Get a Brave Search API Key**:
   - Visit [https://brave.com/search/api/](https://brave.com/search/api/)
   - Sign up for a free account (2,000 queries/month free)
   - Get your API key from the dashboard

2. **For Local Development**:
   - Open `agents-starter/.dev.vars`
   - Replace `your_brave_search_api_key_here` with your actual API key:
   ```bash
   BRAVE_SEARCH_API_KEY=your_actual_api_key
   ```

3. **For Production Deployment**:
   ```bash
   cd agents-starter
   npx wrangler secret put BRAVE_SEARCH_API_KEY
   # Enter your API key when prompted
   ```

> **Note**: The app will work without this API key, but the web search feature won't be available.

### 6. Run Locally

Start the development server:

```bash
npm start
```

This will:
- Start the Vite dev server for the frontend
- Run the Worker locally with `wrangler dev`
- Open the application in your browser (usually at `http://localhost:8787`)

### 7. Deploy to Cloudflare

Deploy the application:

```bash
npm run deploy
```

After deployment, you'll receive a URL where your application is live. 

**Your deployed app**: https://agents-starter.hhatamiy.workers.dev

You can also find it in the [Cloudflare Dashboard](https://dash.cloudflare.com).

## 📖 Usage

### Basic Chat

1. Open the application (locally or deployed URL)
2. Type a message in the chat input
3. The AI assistant will respond using Llama 3.3

### Available Tools

The assistant has access to several tools:

- **Web Search**: Search the internet for current information, news, and facts (automatic)
- **Weather Information**: Get weather for a city (requires confirmation)
- **Local Time**: Get current time for a location (automatic)
- **Schedule Task**: Schedule tasks with flexible timing:
  - One-time tasks: Specific date/time
  - Delayed tasks: Execute after X seconds
  - Recurring tasks: Cron patterns (e.g., "daily at 5pm", "weekdays at 9am")
- **List Scheduled Tasks**: View all scheduled tasks
- **Cancel Scheduled Task**: Cancel a task by ID

### Example Interactions

**Search the web:**
```
User: "What's the latest news about AI?"
Assistant: [Searches the web and provides results with summaries and links]
```

**Schedule a task:**
```
User: "Schedule a reminder to call John tomorrow at 3pm"
Assistant: [Schedules the task and confirms]
```

**Get weather:**
```
User: "What's the weather in San Francisco?"
Assistant: [Shows confirmation dialog for weather tool]
[After confirmation]: "The weather in San Francisco is sunny"
```

**List scheduled tasks:**
```
User: "Show me all scheduled tasks"
Assistant: [Lists all scheduled tasks with IDs and details]
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Check code formatting and linting:

```bash
npm run check
```

## 📁 Project Structure

```
agents-starter/
├── src/
│   ├── server.ts          # Agent logic and Worker entry point
│   ├── app.tsx            # React chat UI
│   ├── client.tsx         # Client-side entry point
│   ├── tools.ts           # Tool definitions
│   ├── utils.ts           # Utility functions
│   ├── shared.ts          # Shared types
│   └── components/        # React UI components
├── public/                # Static assets
├── wrangler.jsonc         # Cloudflare Worker configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## 🔍 Key Configuration Files

### `wrangler.jsonc`

This file configures:
- **AI Binding**: Connects to Workers AI service
- **Durable Objects**: Defines the Chat agent
- **Migrations**: Sets up SQLite storage for state
- **Assets**: Configures static file serving

### `src/server.ts`

Main agent implementation:
- `Chat` class: Extends `AIChatAgent` for chat functionality
- `onChatMessage`: Handles incoming messages and generates responses
- `executeTask`: Executes scheduled tasks

### `src/tools.ts`

Tool definitions:
- Tools with `execute` function: Run automatically
- Tools without `execute`: Require user confirmation
- Execution handlers in `executions` object

## 🌐 Deployment

### Local Development

```bash
npm start
```

### Production Deployment

```bash
npm run deploy
```

The deployment will:
1. Build the frontend assets
2. Bundle the Worker code
3. Deploy to Cloudflare's global network
4. Provide a public URL

## 🔒 Security Considerations

- API keys and secrets should be stored using Wrangler secrets (not in code)
- The application uses Cloudflare's secure WebSocket connections
- All communication is encrypted over HTTPS/WSS

## 📚 Documentation Links

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Agents SDK Reference](https://developers.cloudflare.com/agents/api-reference/)

## 🤝 Contributing

This is an assignment project. For questions or issues, please refer to the Cloudflare documentation or community forums.

## 📝 License

MIT

## ✅ Assignment Checklist

- [x] Repository name prefixed with `cf_ai_`
- [x] README.md with project documentation
- [x] Clear running instructions (local and deployed)
- [x] PROMPTS.md with AI prompts used
- [x] LLM integration (Llama 3.3 on Workers AI)
- [x] Workflow/coordination (Durable Objects)
- [x] User input via chat (WebSockets/Realtime)
- [x] Memory/state (Durable Objects with SQLite)
- [x] Working application (locally and deployed)

## 🎯 Next Steps

To extend this application, consider:

1. **Add more tools**: Database queries, API integrations, file operations
2. **Voice input**: Integrate Cloudflare Calls for voice interactions
3. **Multi-agent workflows**: Coordinate multiple agents for complex tasks
4. **Vector search**: Add Vectorize for semantic search and memory
5. **Custom UI**: Enhance the chat interface with more features
6. **Analytics**: Add observability and analytics

---

**Note**: Make sure to test locally before deploying, and verify that the Llama 3.3 license has been accepted in your Cloudflare account.
