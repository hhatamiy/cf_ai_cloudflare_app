# Build Configuration for CI/CD

## Issue
The CI/CD system is running `npx wrangler deploy` directly, which doesn't trigger the build step. This causes an error because the `agents-starter/dist/client` directory doesn't exist yet.

## Solution Applied

The `postinstall` script now automatically runs the build after installing dependencies:

```json
"postinstall": "cd agents-starter && npm install && cd .. && npm run build"
```

This means when CI/CD runs `npm install`, it will:
1. Install dependencies in `agents-starter/`
2. Build the project (creating `agents-starter/dist/client`)
3. Then when `npx wrangler deploy` runs, the assets directory exists

## Alternative Solutions

### Option 1: Configure Build System to Run Build First

If deploying via Cloudflare Pages or Workers CI/CD:

1. **Set Build Command**: `npm run build`
2. **Set Deploy Command**: `npx wrangler deploy --config wrangler.jsonc`

Or simply:
- **Build Command**: `npm run build`
- **Output Directory**: `agents-starter/dist/client`

### Option 2: Use npm run deploy

Instead of running `npx wrangler deploy` directly, use:

```bash
npm run deploy
```

This ensures the build runs first.

### Option 3: Make Build Step Explicit

If the build system allows separate build and deploy steps:

**Build Step:**
```bash
cd agents-starter && npm install && vite build
```

**Deploy Step:**
```bash
cd .. && npx wrangler deploy --config wrangler.jsonc
```

## Current Configuration

- **Build Script**: `cd agents-starter && vite build`
- **Deploy Script**: `npm run build && wrangler deploy --config wrangler.jsonc`
- **Assets Directory**: `agents-starter/dist/client` (created by vite build)

## Verification

After build runs, verify the directory exists:
```bash
ls -la agents-starter/dist/client
```

You should see:
- `index.html`
- `assets/` directory
- Other static files

