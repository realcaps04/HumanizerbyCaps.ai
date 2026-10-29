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
