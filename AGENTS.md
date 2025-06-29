# Agent Instructions

## Commands
- Build/Watch: `pnpm dev` (builds all packages and watches for changes)
- Lint/Format: `pnpm check` (check only), `pnpm fix` (auto-fix)
- Package commands should be run with `-r` flag: `pnpm -r test`

## Code Style
- Use kebab-case for .ts filenames (e.g. `my-code-file.ts`)
- Use Biome for formatting and linting
- TypeScript with strict mode enabled
- Use ESM imports/exports (`import/export` not `require()`)
- Prefer `const` over `let`, avoid `var`
- Use PascalCase for components/classes, camelCase for functions/variables
- Async/await preferred over raw promises
- Error handling: Use try/catch blocks, propagate errors up with proper typing
- Keep files under 300 lines, functions under 50 lines
- Document complex logic with JSDoc comments
- Avoid default exports, use named exports
- Organize imports: React first, then external deps, then internal imports
- Always use relative imports