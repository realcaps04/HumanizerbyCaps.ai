# Run HumanizerbyCaps.ai locally

```powershell
cd E:\humanize.ai
copy .env.example .env
npm install
npm run build -w @humanizer/shared
npm run dev
```

- Web: http://localhost:5173  
- API health: http://localhost:4000/health  

Mock AI is on by default. For live models:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Deploy / git push → Vercel

The live site is the Express service, which serves UI from `apps/api/public`.

- `npm install` installs a **pre-push hook** that runs `npm run sync:web-public` so the UI bundle is refreshed before push.
- Vercel runs `npm run vercel-build` on deploy (rebuilds web → `apps/api/public`, then API).
- Builds run when `apps/web`, `apps/api`, `packages/shared`, or deploy scripts change (not skipped for web-only commits).

Manual sync anytime:

```powershell
npm run sync:web-public
git add apps/api/public apps/api/BUILD_STAMP
git commit -m "chore: sync web UI bundle for Vercel deploy"
git push
```
