# Прогресс SkyTech.ru

Формат записи: Phase · Step · Status · Implemented · Tests · Files · Problems · Next step.

---

## Phase 0 · Step 0.1 · DONE (2026-11-08)

**Implemented**

- pnpm workspace (`apps/*`, `packages/*`), Turborepo (`build`, `dev`, `lint`, `typecheck`, `test`;
  все зависят от `^build`, чтобы внутренние пакеты собирались первыми).
- Общие конфиги: `@skytech/tsconfig` (base, library, nestjs, nextjs),
  `@skytech/eslint-config` (base type-aware strict, node/nest, next). Prettier, EditorConfig, `.gitattributes` (LF).
- `@skytech/contracts`: константы API-префиксов (`/api`, `/api/v1`, `/api/admin`).
- `@skytech/content-render`, `@skytech/tools-core`: пустые компилируемые ESM-пакеты (наполняются в 4.2 и 9.1).
- `@skytech/api`: NestJS 12 (ESM), `AppModule`, `configureApp()` (общий для `main.ts` и тестов,
  глобальный префикс `/api`, shutdown hooks), порт `API_PORT` (по умолчанию 4000).
- `@skytech/web`: Next.js 16 (App Router, Turbopack), `lang="ru"`, страница-заглушка.
- `CLAUDE.md`, `docs/plan.md`, `docs/progress.md`, `docs/adr/0001-architecture.md`.

**Tests** (5 файлов, 5 тестов, все проходят)

- contracts: значения API-префиксов соответствуют URL policy.
- content-render, tools-core: toolchain smoke (ESM entry point загружается).
- api: приложение поднимается через `@nestjs/testing` + supertest, отвечает под `/api` (404 на неизвестный маршрут).
- web: Testing Library рендерит главную, есть `h1`.

**Validation**

- `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` — успешно.
- `pnpm dev`: web отдаёт страницу на :3000, API отвечает на :4000.

**Files**

- Корень: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.gitignore`,
  `.gitattributes`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`,
  `.vscode/extensions.json`, `CLAUDE.md`.
- `packages/{tsconfig,eslint-config,contracts,content-render,tools-core}/**`.
- `apps/api/**`, `apps/web/**`.
- `docs/plan.md`, `docs/progress.md`, `docs/adr/0001-architecture.md`.

**Problems / решения**

- Node.js не был установлен: поставлен портативный Node 24.22.2 (контрольная сумма сверена с
  SHASUMS256) в `%LOCALAPPDATA%\Programs\nodejs`, добавлен в PATH пользователя; pnpm 12.18 через corepack.
- TypeScript 7 вышел, но typescript-eslint требует `<6.1` → зафиксирован TS 6.0 (ADR 0001).
- NestJS 12 — ESM-only → `apps/api` в ESM с `.js`-импортами.
- ESLint 10 не поддерживается плагинами `eslint-config-next` → ESLint 9.39 (ADR 0001).
- pnpm блокирует install-скрипты → `@swc/core` разрешён в `allowBuilds`.
- Entry points `main.worker.ts` и `cli.ts` ещё не созданы — они появляются в шагах 2.2 и 3.1.
- Docker на машине не найден — понадобится для шага 0.2 (Docker Desktop).

**Next step:** Phase 0.2 — Docker Compose (PostgreSQL, Redis, MinIO), `.env.example`, `infra:up`, GitHub Actions.
