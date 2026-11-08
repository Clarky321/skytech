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

---

## Vertical slice · feature/content-authoring-mvp · DONE (2026-11-08)

Сквозной сценарий: администратор → создание статьи в блочном редакторе → сохранение → повторное
открытие → предпросмотр → публикация → статья на сайте. Порядок фаз нарушен осознанно (прямая
задача), статус по фазам — в `docs/plan.md`.

**Implemented**

- Инфраструктура: `docker/compose.dev.yml` (PostgreSQL 17, Redis 7, MinIO `bitnamilegacy`, политика
  «чтение по ключу без листинга»), `.env.example`, `infra:*`, GitHub Actions (check + e2e).
- ADR 0002: TipTap 3, JSON-документ как источник истины, рендер JSON → HAST → sanitize, lowlight.
- contracts: схема документа (глубина, безопасные ссылки), права, контракты API, `slugify`.
- content-render: HTML, TOC, время чтения, plain text, подсветка, callout, таблицы, изображения.
- API (NestJS): platform (config, pino, RFC 9457, health), auth (Argon2id, сессии, rate limit,
  deny-by-default, CSRF), audit + outbox, users, authors, taxonomy, media (сигнатуры, sharp, S3,
  дедупликация, защита используемых), content (ревизии, workflow, optimistic lock, 301, предпросмотр,
  планирование), worker, CLI (`user:create`, `user:reset-password`, `db:reset`, `db:seed`).
- Web: дизайн-система (Tailwind 4, Radix), тёмная/светлая тема без мигания, публичный сайт
  (главная, статьи, статья с TOC и копированием кода, категории, теги, авторы, страницы, 404),
  админка (обзор, статьи/страницы, редактор, медиатека, категории, теги, авторы, профиль), блочный
  редактор (slash-меню, панели, ручка блока с перемещением и drag & drop, callout ×4, код с выбором
  языка, таблицы, изображения с alt/подписью, чек-листы), защита от потери данных (Ctrl+S, статус
  сохранения только после ответа сервера, предупреждение при уходе, локальная копия, 409).

**Tests**

- contracts 66, content-render 17 (вкл. XSS), api 60 (интеграционные на реальных PostgreSQL/Redis/MinIO:
  auth, CSRF, обход всех маршрутов, workflow, роли, медиа, планирование), web 41 (блоки на TipTap в
  jsdom, slash-каталог, резервная копия, копирование кода, утилиты), tools-core 1.
- Playwright 3: полный сценарий публикации, анонимный доступ к черновикам/админке, автор не публикует.

**Problems / решения**

- Официальные образы MinIO больше не публикуются → `bitnamilegacy/minio` (только dev).
- `@tiptap/extension-drag-handle` требует Yjs/collaboration → собственная ручка блока.
- React Compiler lint (react-hooks v7): ref'ы синхронизируются в `useLayoutEffect`, сбросы состояния —
  в обработчиках.
- Найден и исправлен баг «переместить вниз» (unit-тест), ложный статус «несохранено» при открытии
  (`setEditable` порождал update), переполнение панели метаданных.

**Known limitations**

- Отчёты об ошибках: раздел в админке помечен «в разработке», backend не реализован.
- Публичные страницы рендерятся динамически (без кэша); outbox-события пишутся, но обработчиков пока нет.
- Нет UI управления пользователями (только CLI), diff ревизий, журнала аудита в UI.
- В dev-режиме на страницах 404 React пишет предупреждение о `<script>` темы (функционально не влияет).

**Next step:** закрыть 4.4 (отчёты об ошибках), затем 6.3 (кэш + ревалидация через outbox/worker).
