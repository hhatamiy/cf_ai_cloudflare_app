# Setup Guide - Cloudflare AI Assignment

## ✅ Completed Tasks

All required components have been implemented and configured:

### 1. ✅ LLM Integration
- **Status**: Complete
- **Implementation**: Switched from OpenAI to Llama 3.3 70B Instruct (fp8-fast) on Workers AI
- **Location**: `agents-starter/src/server.ts`
- **Model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Provider**: `workers-ai-provider` package

### 2. ✅ Workflow/Coordination
- **Status**: Complete
- **Implementation**: Durable Objects via Cloudflare Agents SDK
- **Location**: `agents-starter/src/server.ts` (Chat class extends AIChatAgent)
- **Configuration**: `agents-starter/wrangler.jsonc` (durable_objects bindings)

### 3. ✅ User Input via Chat
- **Status**: Complete
- **Implementation**: Real-time chat interface via WebSockets (Cloudflare Realtime)
- **Location**: 
  - Backend: `agents-starter/src/server.ts` (AIChatAgent provides WebSocket support)
  - Frontend: `agents-starter/src/app.tsx` (React chat UI)

### 4. ✅ Memory/State
- **Status**: Complete
- **Implementation**: Durable Objects with SQLite storage
- **Location**: 
  - Configuration: `agents-starter/wrangler.jsonc` (migrations with new_sqlite_classes)
  - Implementation: Agents SDK automatically persists state in Durable Objects

### 5. ✅ Documentation
- **Status**: Complete
- **Files Created**:
  - `README.md` - Comprehensive project documentation with setup and usage instructions
  - `PROMPTS.md` - All AI prompts used during development
  - `SETUP_GUIDE.md` - This file (quick reference guide)

## 📋 Assignment Requirements Checklist

- [x] Repository name prefixed with `cf_ai_` ⚠️ **Note**: You need to rename your repository to start with `cf_ai_`
- [x] README.md with project documentation
- [x] Clear running instructions (local and deployed)
- [x] PROMPTS.md with AI prompts used
- [x] LLM (Llama 3.3 on Workers AI) ✅
- [x] Workflow/coordination (Durable Objects) ✅
- [x] User input via chat (WebSockets/Realtime) ✅
- [x] Memory/state (Durable Objects with SQLite) ✅

## 🚀 Next Steps

### 1. Rename Repository (IMPORTANT!)

Your repository name must be prefixed with `cf_ai_`. Currently, it's named `cf_ai_cloudflare_app`, which is correct! However, make sure your GitHub repository also follows this naming convention.

If needed, rename your GitHub repository:
1. Go to your repository settings on GitHub
2. Click "Change repository name"
3. Rename to: `cf_ai_cloudflare_app` or `cf_ai_your_project_name`

### 2. Accept Llama 3.3 License

Before running the application, you must accept Meta's Llama 3.3 License:

**Option A: Via Cloudflare Dashboard**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages → Workers AI
3. Accept the Llama 3.3 license agreement

**Option B: Via API**
```bash
# Replace with your actual credentials
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_AUTH_TOKEN="your-auth-token"

curl https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast \
  -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_AUTH_TOKEN" \
  -d '{ "prompt": "agree" }'
```

### 3. Set Up Local Development

```bash
cd agents-starter

# Install dependencies (if not already done)
npm install

# Authenticate with Cloudflare
npx wrangler login

# Start local development server
npm start
```

The application will be available at `http://localhost:8787`

### 4. Deploy to Cloudflare

```bash
cd agents-starter

# Deploy the application
npm run deploy
```

After deployment, you'll receive a URL where your application is live.

### 5. Test the Application

1. **Open the application** (locally or deployed URL)
2. **Try basic chat**: Type a message and verify the AI responds
3. **Test tools**:
   - Ask for weather (requires confirmation)
   - Get local time (automatic)
   - Schedule a task (one-time, delayed, or recurring)
   - List scheduled tasks
4. **Verify state persistence**: Send messages, refresh the page, verify conversation history persists

### 6. Verify All Requirements

Before submission, verify:
- [ ] Repository name starts with `cf_ai_`
- [ ] README.md is comprehensive and clear
- [ ] PROMPTS.md includes all AI prompts used
- [ ] Application runs locally (`npm start`)
- [ ] Application deploys successfully (`npm run deploy`)
- [ ] All features work: chat, tools, scheduling, state persistence
- [ ] Llama 3.3 license has been accepted

### 7. Submit Your Repository

1. Ensure your GitHub repository is public (or accessible to reviewers)
2. Submit the repository URL as specified in the assignment instructions
3. Make sure the repository includes:
   - `README.md` in the root directory
   - `PROMPTS.md` in the root directory
   - All source code
   - Working application (can be tested via deployed link or local instructions)

## 🔍 Quick Verification

Run these commands to verify everything is set up correctly:

```bash
# Check if dependencies are installed
cd agents-starter
npm list | grep workers-ai-provider
npm list | grep agents

# Verify wrangler configuration
cat wrangler.jsonc | grep -A 3 "ai"
cat wrangler.jsonc | grep -A 5 "durable_objects"

# Check TypeScript compilation
npm run check

# Verify server.ts uses Workers AI
grep -A 2 "createWorkersAI" src/server.ts
grep -A 1 "llama-3.3" src/server.ts
```

## 📝 Key Files Modified

1. **`agents-starter/src/server.ts`**:
   - Switched from OpenAI to Workers AI
   - Using Llama 3.3 70B Instruct model
   - Removed OpenAI API key checks
   - Added health check endpoint

2. **`README.md`** (root):
   - Comprehensive project documentation
   - Setup and usage instructions
   - Assignment requirements verification

3. **`PROMPTS.md`** (root):
   - All AI prompts used during development
   - Context and purpose for each prompt

## ⚠️ Important Notes

1. **Repository Name**: Make sure your GitHub repository name starts with `cf_ai_`
2. **License Acceptance**: Llama 3.3 license must be accepted before the app can run
3. **Environment Variables**: No API keys needed anymore (using Workers AI binding instead)
4. **Deployment**: Make sure to deploy after making changes to see them live

## 🆘 Troubleshooting

### Issue: Model not found error
**Solution**: Make sure you've accepted the Llama 3.3 license in Cloudflare Dashboard

### Issue: TypeScript errors
**Solution**: Run `npm install` to ensure all dependencies are installed

### Issue: Can't connect to Workers AI
**Solution**: Verify `wrangler.jsonc` has the AI binding configured correctly

### Issue: Durable Objects not working
**Solution**: Make sure migrations are set up correctly in `wrangler.jsonc`

## 📚 Additional Resources

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)

---

**You're all set!** Follow the steps above to complete your setup and submit your assignment. Good luck! 🚀

