# Deployment Solution

## The Real Problem

Your CI/CD system is configured to run `npx wrangler deploy` directly, **skipping the build step**. This is why `agents-starter/dist/client` doesn't exist.

## Quick Solutions

### Option 1: Manual Deployment (Immediate Fix)

Deploy from your local machine to verify everything works:

```bash
cd /path/to/cf_ai_cloudflare_app
npm run deploy
```

This will:
1. Build the project (`npm run build`)
2. Deploy with wrangler (`wrangler deploy --config wrangler.jsonc`)

### Option 2: Fix CI/CD Configuration

You need to update your deployment configuration. Where you're deploying from:

#### If using Cloudflare Pages Dashboard:
1. Go to https://dash.cloudflare.com
2. Select your project
3. Go to Settings → Builds & deployments
4. Set **Build command** to: `npm run build`
5. Set **Build output directory** to: `agents-starter/dist/client`
6. Set **Deploy command** (if separate) to: `npx wrangler deploy --config wrangler.jsonc`

#### If using GitHub Actions:
Update your workflow file to run the build first:

```yaml
- name: Build
  run: npm run build
  
- name: Deploy
  run: npx wrangler deploy --config wrangler.jsonc
```

#### If using Cloudflare Workers CI:
The deploy command should be:
```bash
npm run deploy
```
Not:
```bash
npx wrangler deploy
```

### Option 3: Change Deploy Command in CI/CD

Find where your CI/CD is configured and change the deploy command from:
```bash
npx wrangler deploy
```

To:
```bash
npm run deploy
```

This will use the `deploy` script from `package.json` which includes the build step.

## Testing

After making changes, verify the deployment:

1. **Local test first**:
   ```bash
   npm run deploy
   ```

2. **Verify build output**:
   ```bash
   ls -la agents-starter/dist/client
   ```
   You should see `index.html` and an `assets/` directory

3. **If successful locally**, commit and push to trigger CI/CD

## Where to Find CI/CD Configuration

Look in these places:

1. **Cloudflare Dashboard** → Your Project → Settings → Builds
2. **GitHub Repository** → Actions tab → Workflow files (`.github/workflows/`)
3. **`.gitlab-ci.yml`** (if using GitLab)
4. **`netlify.toml`** or **`vercel.json`** (if using other platforms)
5. **Repository settings** on your git hosting platform

## Verification Checklist

- [ ] Build command runs: `npm run build` or `cd agents-starter && vite build`
- [ ] Build creates: `agents-starter/dist/client/index.html`
- [ ] Deploy command finds: `agents-starter/dist/client` directory
- [ ] Deployment succeeds locally with `npm run deploy`
- [ ] CI/CD configured to run build before deploy

## Still Not Working?

Share the following information:
1. Where are you deploying from? (Cloudflare Pages, GitHub Actions, etc.)
2. What's the full build log from CI/CD?
3. Does `npm run deploy` work locally?

