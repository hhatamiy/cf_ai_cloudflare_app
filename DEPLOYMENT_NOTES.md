# Deployment Notes

## Issue: Wrangler Cannot Find Config or Entry Point

### Problem
When deploying from CI/CD, Wrangler runs from the root directory but cannot find `wrangler.jsonc` (which is in `agents-starter/`).

### Solution Applied

1. **Created root `wrangler.jsonc`**:
   - All paths are relative to root directory
   - `main`: `agents-starter/src/server.ts`
   - `assets.directory`: `agents-starter/dist/client`

2. **Updated `agents-starter/wrangler.jsonc`**:
   - Changed assets directory from `"public"` to `"dist/client"`
   - This is where Vite builds the client assets

3. **Updated root `package.json`**:
   - Deploy script: Builds first, then deploys from root
   - Script: `cd agents-starter && vite build && cd .. && wrangler deploy --config wrangler.jsonc`

### Build Process

The deployment process should:
1. Install dependencies: `npm install` (runs in `agents-starter/`)
2. Build assets: `vite build` (creates `dist/client/`)
3. Deploy: `wrangler deploy` (reads `wrangler.jsonc` from `agents-starter/`)

### Important Notes

- **Always deploy from `agents-starter/` directory** - This ensures Wrangler finds `wrangler.jsonc`
- **Build must complete before deploy** - Assets must exist in `dist/client/`
- **Assets directory is relative to `wrangler.jsonc` location** - Since config is in `agents-starter/`, path `dist/client` is correct

### Verification

After running `vite build` in `agents-starter/`, verify:
- `agents-starter/dist/client/` exists
- `agents-starter/dist/client/index.html` exists
- `agents-starter/dist/client/assets/` contains built files

### If Deployment Still Fails

1. **Manual deployment from agents-starter**:
   ```bash
   cd agents-starter
   npm install
   npm run deploy
   ```

2. **Check build output**:
   ```bash
   cd agents-starter
   npm run build  # or: vite build
   ls -la dist/client
   ```

3. **Deploy with explicit config**:
   ```bash
   cd agents-starter
   wrangler deploy --config wrangler.jsonc
   ```

