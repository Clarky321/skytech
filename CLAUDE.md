# SkyTech.ru — инструкции для Claude Code

Технический портал для системных администраторов и IT-инженеров: статьи, база знаний,
документация, интерактивные IT-инструменты. Один разработчик + Claude Code.

## Перед работой

1. Прочитай этот файл, `docs/plan.md`, `docs/progress.md`, `docs/adr/*`.
2. Определи текущий шаг (последний `DONE` в progress + следующий по плану).
3. Начни ответ с «Я работаю над Step X.Y» и покажи Goal / Scope / Files / Plan.
4. Одна сессия = один шаг плана = один commit. **Не переходи к следующему шагу сам.**

## Стек (зафиксирован, см. ADR 0001)

Node 24 LTS · pnpm (corepack) · Turborepo · TypeScript 6.0 (strict) · ESLint 9 + Prettier ·
Vitest + Testing Library + Playwright · Next.js 16 (App Router, RSC) · NestJS 12 (ESM) ·
PostgreSQL 17 + Drizzle · Redis 7 + BullMQ · S3 (MinIO в dev) · nginx · Docker Compose.

Новые runtime-зависимости сверх `docs/plan.md` — только после обсуждения.

## Структура

```
apps/web               Next.js: публичный сайт + /admin (одно приложение)
apps/api               NestJS modular monolith: main.ts (HTTP), main.worker.ts (worker), cli.ts
packages/contracts     Zod-схемы, типы, enums, permissions, URL-константы — единственный контракт API
packages/content-render  Markdown → sanitized HTML (единственный рендерер)
packages/tools-core    чистые функции IT-инструментов (только браузер в MVP)
packages/tsconfig      общие tsconfig (base, library, nestjs, nextjs)
packages/eslint-config общие flat-конфиги (base, node/nest, next)
docker/                compose-файлы, nginx
docs/                  plan, progress, adr, runbook, database
```

Внутренние пакеты компилируются `tsc` в `dist/` (ESM + d.ts). Turborepo собирает их перед
`dev`/`typecheck`/`lint`/`test` зависимых приложений (`dependsOn: ["^build"]`).

## Команды (работают в PowerShell и bash)

```
pnpm install          # зависимости
pnpm dev              # web :3000, api :4000 + watch пакетов
pnpm build            # сборка всего
pnpm lint             # ESLint (type-aware)
pnpm typecheck        # tsc --noEmit во всех пакетах
pnpm test             # Vitest во всех пакетах
pnpm format           # Prettier --write
pnpm check            # format:check + lint + typecheck + test + build (как CI)
pnpm --filter @skytech/api test   # команда для одного пакета
```

## Архитектурные инварианты (менять только через обсуждение + ADR)

1. Modular monolith: модуль работает только со своими таблицами, чужие данные — через сервис модуля.
2. PostgreSQL — единственный источник истины. Redis — только очереди, rate limits, кэш.
3. Побочные эффекты (ревалидация, IndexNow, индексация, уведомления) — только через transactional outbox.
4. Одна таблица `content` (`article`, `page`; позже `kb`, `doc_page`). Ревизии неизменяемы.
   Сайт читает только опубликованный снимок; правка не меняет сайт до публикации.
5. Markdown — source of truth. HTML строит только `content-render` на сервере. Raw HTML запрещён, sanitize обязателен.
6. Медиа только в S3, ссылки в Markdown — `media:ID`. Только JPEG/PNG/WebP/GIF ≤ 10 MB. SVG запрещён.
7. Один origin: nginx `/api` → NestJS, остальное → Next.js. Админка — `/admin` в `apps/web`.
8. Auth: серверные сессии (httpOnly, Secure, SameSite=Lax; в БД — хэш токена), Argon2id.
   **JWT для браузера не используется.** Deny-by-default, `@Public()` явно. Проверка прав — только backend.
9. CSRF: проверка Origin для изменяющих запросов.
10. Каждое изменяющее действие в админке пишет `audit_log` в той же транзакции. Без паролей/токенов/cookies.
11. API: `/api/v1` (public), `/api/admin` (staff). Ошибки — RFC 9457. Типы не дублируются вне `contracts`.
12. URL: `/articles/{slug}`, `/category/{slug}[/{child}]`, `/tags/{slug}`, `/authors/{slug}`,
    `/tools/{slug}`, `/search`, `/rss.xml`. Слаги латиницей. Смена слага → 301.
13. Миграции: `drizzle-kit generate` + `migrate`. **`push` запрещён.** Применённые миграции не редактируются.
14. Поиск — только через `SearchService` (PostgreSQL FTS). Никто другой не трогает `search_tsv`.
15. Кэш Next.js сбрасывается централизованно из worker по outbox-событиям.
16. Инструменты — чистые функции; ввод пользователя никогда не уходит на сервер.
17. Логи — JSON (pino) с `request_id`, без секретов. Время — `timestamptz` UTC.

## Вне MVP (не реализовывать)

OAuth, 2FA/TOTP, регистрация читателей, комментарии, OpenSearch, Kubernetes, микросервисы,
отдельное admin-приложение, OpenAPI/codegen, серверные инструменты, i18n, рекомендации.

## Код

- Strict TypeScript, без `any` (предпочитай `unknown` + Zod/type guards).
- NestJS (ESM): относительные импорты с `.js`; классы для DI импортируются как значения.
- Server Components по умолчанию; `'use client'` только для реальной интерактивности.
- Не грузить CodeMirror и компоненты инструментов на страницы, где они не нужны.
- Не создавать premature abstractions, generic-фреймворки, TODO вместо обязательной функциональности.
- Тесты пишутся вместе с кодом (unit + integration; XSS для рендера; boundary для tools; матрица прав для auth).

## Definition of Done

lint, typecheck, test, build проходят · документация и `docs/progress.md` обновлены ·
`git diff` проверен · нет случайных файлов и секретов · архитектурные инварианты соблюдены.
Commit: `feat|fix|refactor|test|docs|chore(scope): ...` — один шаг = один commit.

## Окружение разработчика

Windows 11 + PowerShell + Docker Desktop. Команды должны работать в PowerShell.
Bash-скрипты допустимы только для production Linux (и документируются).
