# Development Notes

Quick troubleshooting and common tasks for developers working on this project.

1) Environment and API keys
- The Gemini key is read from `import.meta.env.VITE_GEMINI_KEY`. Put it in a `.env` file at the project root or set it in your environment.

2) Rate limiting and quotas
- The client enforces a rate limit (15 req/min and 4s min interval). If you receive rate-limit errors, wait or reduce request frequency.
- If you hit quota errors from Gemini, the app will automatically try a fallback model. If both models are out of quota, requests will fail with an explanatory error.

3) Local build & typecheck

```bash
pnpm install
pnpm build
```

4) Linting

```bash
pnpm lint
```

5) Running the app

```bash
pnpm dev
# open http://localhost:5173
```

6) Debugging tips
- Check the browser console for API request logs. `src/utils/gemini.ts` logs raw responses and errors to help diagnose JSON parsing problems.
- If JSON parsing fails, the code attempts to extract JSON from the response; if that fails a fallback response is constructed.

8) ESLint / TypeScript notes
- The project enforces `@typescript-eslint/no-explicit-any`. You'll see lint errors in `src/utils/gemini.ts` where `any` is used. Prefer `unknown` and then validate/cast, or add appropriate model types.
- Quick auto-fix: `pnpm lint -- --fix` will apply fixable rules. Remaining issues need manual attention.

9) Production recommendation
- Do NOT expose `VITE_GEMINI_KEY` in client bundles for production. Instead, create a small backend (serverless function or Express endpoint) that holds the key, forwards requests to Gemini, and enforces server-side rate limiting and caching.

7) Notes about production
- Keep your Gemini key secret. For production, use a backend proxy to avoid exposing the key to clients.
- Consider server-side request throttling and caching to reduce API usage and protect quota.
