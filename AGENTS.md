# Repository Guidelines

## Project Structure & Module Organization
`src/content/` contains the extension logic. `main.ts` is the entry point, `price-calculator.ts` holds pricing math, `listing-injector.ts` and `lot-detail-injector.ts` handle DOM insertion, and `mutation-observer.ts` manages SPA re-renders. `src/manifest.json` defines the MV3 extension, and `src/icons/` stores packaged icons. Build output goes to `dist/`; treat it as generated and do not edit it by hand.

## Build, Test, and Development Commands
- `npm install`: install local build dependencies.
- `npm run build`: bundle `src/content/main.ts` with esbuild and copy the manifest/icons into `dist/`.
- `npm run watch`: rebuild on change with inline sourcemaps for local iteration.
- `npm run clean`: remove `dist/`.

For browser testing, load `dist/` as an unpacked extension after `npm run build`.

## Coding Style & Naming Conventions
Use TypeScript with strict-mode discipline; `tsconfig.json` enables `strict`, `isolatedModules`, and `forceConsistentCasingInFileNames`. Follow the existing style:
- 2-space indentation
- single quotes in `.ts` and `.mjs`
- `camelCase` for functions and variables
- `PascalCase` for types
- `UPPER_SNAKE_CASE` for shared constants
- kebab-case filenames such as `price-calculator.ts`

Keep modules focused. Put reusable DOM selectors in `dom-selectors.ts`, formatting or parsing helpers in dedicated utility files, and avoid mixing page-detection logic with calculator code.

## Testing Guidelines
There is no automated test suite yet. Before opening a PR, run `npm run build` and manually verify the extension on:
- a lot detail page
- a listing/search page
- at least one English and one Spanish page when text parsing changes

Confirm that injected totals update after SPA navigation and after bid-section DOM refreshes.

## Commit & Pull Request Guidelines
The current history uses Conventional Commits, for example `feat: Catawiki Price Calculator browser extension`. Keep using `feat:`, `fix:`, `refactor:`, and similar prefixes with short imperative summaries.

PRs should include:
- a short description of the user-visible change
- manual validation notes with the pages tested
- screenshots or recordings when UI injection placement changes

## Extension-Specific Notes
Prefer minimal permissions in `src/manifest.json`. If you add new assets or manifest fields, make sure the build still copies everything needed into `dist/`.
