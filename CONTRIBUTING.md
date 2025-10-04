# Contributing

Thanks for wanting to contribute! These are quick steps to get your development environment ready and to follow the repo conventions.

1. Fork the repository and create a topic branch for your change.
2. Make sure your changes include type checks and linting passes.

Local checks

```bash
pnpm install
pnpm lint
pnpm build
```

Code style
- The project uses TypeScript and ESLint. Run `pnpm lint` before opening a PR.

Lint expectations
- We enforce `@typescript-eslint/no-explicit-any`. If you must use `any`, explain why in your PR, but prefer `unknown` and narrow types where possible.
- Use `pnpm lint -- --fix` to apply auto-fixes, then address remaining issues manually.

PRs
- Open a PR against `main` with a short description of the change.

Sensitive info
- Never commit `.env` files or API keys. Use the `.env.example` as a template.
