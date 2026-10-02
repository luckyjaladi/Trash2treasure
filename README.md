# Trash2Treasure
Photo → AI identification → reuse / recycle / resell / donate.

## Run
```bash
npm install
cp .env.example .env   # set PROVIDER + matching API key
npm run dev            # client :5173, API :3001
```

## Deploy (single service: Render / Railway / Fly)
```bash
npm run build && npm start
```
Set `ANTHROPIC_API_KEY` in the host's env vars. Never commit `.env`.
