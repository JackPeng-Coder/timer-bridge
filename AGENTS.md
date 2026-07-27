# Timer Bridge — AGENTS.md

## Commands

| Action | Command |
|--------|---------|
| Build all | `pnpm -r build` |
| Test all | `pnpm -r test` |
| Lint (tsc --noEmit) | `pnpm -r lint` |
| Build single package | `pnpm --filter @timer-bridge/<name> build` |
| Run single package tests | `pnpm --filter @timer-bridge/<name> test` |
| CLI entry | `node packages/cli/dist/index.js` |
| Web dev | `cd apps/web && pnpm dev` |
| Serve built web | `node apps/web/serve.js` (→ http://localhost:8080) |

## Build order

`core` → `adapter-*` → `cli` / `web`. `pnpm -r build` handles this automatically.

## Monorepo structure

- `packages/core` — Intermediate Format types (`Solve`, `Session`, `TimerData`), `Adapter` interface, `BridgeRegistry`, puzzle normalization
- `packages/adapter-cstimer` — csTimer JSON/CSV ↔ IF (no sql.js)
- `packages/adapter-dctimer` — DCTimer SQLite ↔ IF (depends on sql.js)
- `packages/adapter-twistytimer` — TwistyTimer CSV/SQLite ↔ IF (depends on sql.js)
- `packages/cli` — commander-based CLI, registers all adapters
- `apps/web` — Vite + React drag-and-drop converter, builds to single-file HTML via `vite-plugin-singlefile`

## Adding a new timer adapter

1. Create `packages/adapter-xxx/` with `package.json` (depends on `@timer-bridge/core`), `tsconfig.json`
2. Implement `Adapter` interface: `detect()`, `import()`, `export()`, `supportedExtensions()`
3. Register in:
   - `packages/cli/src/index.ts`: `registry.register('xxx', XxxAdapter)`
   - `apps/web/src/App.tsx`: import + `registry.register('xxx', XxxAdapter as any)`

## TypeScript config

- Strict mode, `noUnusedLocals`, `noUnusedParameters` — these will fail the build
- Prefix unused params with `_` (e.g., `_filename`)
- Target ES2022, module ESNext, moduleResolution bundler

## sql.js / WASM

- Both `adapter-dctimer` and `adapter-twistytimer` use sql.js for SQLite I/O
- In Node.js (CLI): sql.js loads WASM from filesystem automatically
- In browser (web app): WASM is embedded as base64 in `apps/web/src/wasm-base64.ts`
- **If sql.js version changes**: regenerate `wasm-base64.ts`:
  ```powershell
  $b = [Convert]::ToBase64String([IO.File]::ReadAllBytes("node_modules/sql.js/dist/sql-wasm.wasm"))
  "export const SQL_WASM_BASE64 = '$b'" | Out-File apps/web/src/wasm-base64.ts
  ```
- `apps/web/src/wasm-base64.ts` is gitignored

## Reference source directories

`references/` contains format research references (`cstimer/`, `DCTimer-Android/`, `TwistyTimer/`), not part of the bridge. The entire `references/` is gitignored and not required for building.

## Tests

- Framework: vitest v2
- Test files co-located with source (`*.test.ts`)
- Each adapter has tests for detect/import/export round-trips
- To add tests for a new adapter: create `<adapter>/src/index.test.ts` with vitest

## Known quirks

- Web app single-file build (`vite-plugin-singlefile`) inlines all JS into `index.html` (~1MB with WASM). Chrome cannot open this from `file://` — must use `node apps/web/serve.js` or any static server.
- DCTimer puzzle type codes use `(idx << 5) | sub` encoding (not simple integers). The correct mapping is in `DCT_PUZZLE_MAP` and `DCT_WCA_MAP` in `adapter-dctimer`.
- TwistyTimer backup CSV uses semicolons (`;`) as delimiter, with commas in the header line only.
- csTimer solve format: `[[penalty, time, ...phases], scramble, comment, timestamp_ms, extension?]`
