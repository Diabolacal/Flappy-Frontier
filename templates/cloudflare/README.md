# Cloudflare Pages + Workers Template

This folder contains example configuration files for deploying a project with Cloudflare Pages and Workers.

## Quick Start

1. **Copy template files** to your project root or frontend directory:
   ```bash
   cp templates/cloudflare/wrangler.example.jsonc my-app/wrangler.jsonc
   cp templates/cloudflare/env.example my-app/.env.example
   ```

2. **Replace placeholders** in `wrangler.jsonc`:
   - `{{PROJECT_NAME}}` → your Cloudflare Pages project name
   - `{{KV_NAMESPACE_ID}}` → your KV namespace ID (from `wrangler kv namespace create`)
   - `{{COMPATIBILITY_DATE}}` → today's date (e.g., `2026-03-12`)
   - Remove any binding sections you don't need

3. **Set secrets** (never commit these):
   ```bash
   wrangler pages secret put API_TOKEN --project-name my-project
   ```

4. **Deploy**:
   ```bash
   # Preview deploy (feature branches)
   npm run build
   wrangler pages deploy dist --project-name my-project --branch feature/my-branch

   # Production deploy (main branch only)
   npm run build
   wrangler pages deploy dist --project-name my-project --branch main
   ```
