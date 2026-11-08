# План реализации SkyTech.ru

Источник истины для порядка работ. Одна строка `N.M` = одна сессия Claude Code = один commit.
Статус шагов — в `docs/progress.md`. Архитектура — в `docs/adr/` и `CLAUDE.md`.

## Статус после вертикального среза «content authoring» (2026-11-08)

Ветка `feature/content-authoring-mvp` реализовала сквозной сценарий раньше пофазного порядка
(по прямой задаче). Решения — в ADR 0002. Что закрыто и что осталось:

| Фаза     | Сделано                                                                                                                  | Осталось                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 0.2      | Compose (PostgreSQL, Redis, MinIO + политика бакетов), `.env.example`, `infra:*`, CI                                     | required status check в ruleset `main`                              |
| 1        | схема, миграция, `db:migrate/reset/seed`, тестовая БД                                                                    | —                                                                   |
| 2        | config, pino + request_id, RFC 9457, health, worker (опрос PostgreSQL)                                                   | BullMQ и обработчики outbox (ревалидация, IndexNow) — вместе с 7–8  |
| 3        | Argon2id, сессии, rate limit, deny-by-default, права, CSRF, CLI                                                          | админ-UI управления пользователями                                  |
| 4.1–4.3  | таксономия, авторы, рендерер (JSON → HTML), материалы, ревизии, workflow, 301                                            | —                                                                   |
| 4.4      | медиа                                                                                                                    | **отчёты об ошибках** (backend + форма Ctrl+Enter)                  |
| 5        | админка: обзор, статьи/страницы, редактор (TipTap), предпросмотр, медиатека, таксономия, авторы, профиль, история версий | diff ревизий, журнал аудита в UI, отчёты об ошибках                 |
| 6        | дизайн-система, тема без мигания, главная, статьи, категории, теги, авторы, страницы, 404                                | кэш Next.js с ревалидацией из worker (сейчас страницы динамические) |
| 8        | базовые metadata, canonical, OG, noindex тонких тегов                                                                    | JSON-LD, sitemap, robots, RSS, IndexNow                             |
| 10       | Playwright: сквозной сценарий, права, анонимный доступ                                                                   | security review, заголовки CSP/HSTS                                 |
| 7, 9, 11 | —                                                                                                                        | поиск, инструменты, production                                      |

Правило 5 (Markdown) и 6 (`media:ID`) из исходного плана заменены ADR 0002: JSON-документ и `image.mediaId`.

## Объём MVP

Публичный сайт, статьи и статические страницы, категории (2 уровня), теги, авторы, поиск
(PostgreSQL FTS), SEO, админка в `/admin`, Markdown-редактор (CodeMirror 6), медиа (S3),
черновики/ревью/публикация/планирование, ревизии, RSS, 10 браузерных IT-инструментов,
сообщения об ошибках (Ctrl+Enter), вход сотрудников (роли admin/editor/author), audit log,
Docker-окружение разработки, production-ready основа (один VPS + управляемые PostgreSQL и S3 в РФ).

**Не в MVP:** комментарии, кабинет читателя, OAuth, 2FA, OpenSearch, Kubernetes, микросервисы,
сложная аналитика, рекомендации, i18n, OpenAPI, серверные инструменты, KB/docs-разделы.

## Модули backend (`apps/api/src/*`)

| Модуль        | Назначение                                                              | Основные таблицы                                                               |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| platform      | config (Zod), логи (pino, request_id), ошибки RFC 9457, db, health      | —                                                                              |
| jobs          | outbox, BullMQ-очереди, `scheduler.tick`                                | `outbox_events`                                                                |
| auth / users  | сессии, Argon2id, rate limit, guard, permissions, CSRF                  | `users`, `sessions`                                                            |
| audit         | журнал изменяющих действий (в той же транзакции)                        | `audit_log`                                                                    |
| authors       | публичные профили (могут быть без учётки)                               | `author_profiles`                                                              |
| taxonomy      | категории (глубина ≤ 2), теги                                           | `categories`, `tags`                                                           |
| content       | статьи/страницы, ревизии, workflow, публикация, редиректы               | `content`, `content_revisions`, `content_authors`, `content_tags`, `redirects` |
| media         | presigned upload, проверка сигнатур, sharp-варианты, учёт использования | `media`, `media_variants`, `content_media`                                     |
| error-reports | сообщения об ошибках в тексте                                           | `error_reports`                                                                |
| search        | `SearchService` на PostgreSQL FTS, подсказки, запросы без результатов   | `content.search_tsv`, `search_misses`                                          |
| seo           | IndexNow, данные для sitemap/RSS, разрешение редиректов                 | —                                                                              |

Workflow контента: `draft → review → scheduled → published → archived`. Author не публикует.
Публикация копирует ревизию в «опубликованные» поля `content`; optimistic lock через `version` (409).

## Фазы MVP

### Phase 0 — Foundation

- **0.1** Монорепо: pnpm workspace, Turborepo, TypeScript, ESLint, Prettier, Vitest; каркасы
  `apps/web` (Next.js) и `apps/api` (NestJS); пакеты `contracts`, `content-render`, `tools-core`,
  `tsconfig`, `eslint-config`; `CLAUDE.md`, `docs/plan.md`, `docs/progress.md`, ADR 0001; smoke-тесты.
- **0.2** `docker/compose.dev.yml` (PostgreSQL 17, Redis 7, MinIO + создание бакета), `.env.example`,
  `pnpm infra:up` / `infra:down`, GitHub Actions (install, lint, typecheck, test, build).
  Критерий: `pnpm install && pnpm infra:up && pnpm dev` поднимает проект.
- Не делать: схему БД, auth, production Docker, UI.

### Phase 1 — Database

- **1.1** Drizzle + node-postgres; схема всех таблиц MVP (кроме поисковых колонок);
  snake_case, uuid (`gen_random_uuid()`), timestamptz, FK с явным ON DELETE; первая миграция.
- **1.2** `db:migrate`, `db:seed`, `db:reset`; сид: admin, 8 категорий, 30 тегов, 20 технических
  статей (DNS, DHCP, Event Viewer, PowerShell, systemctl, nginx, Docker, VLAN, TCP/IP, AD) с кодом
  и картинками; тестовая БД и хелпер очистки; `docs/database.md`.
- Тесты: миграции на пустой БД, ограничения (unique, FK). Не использовать `drizzle-kit push`.

### Phase 2 — Backend foundation

- **2.1** Config (Zod), nestjs-pino + request_id, фильтр RFC 9457, Zod validation pipe, DbModule
  (транзакции), `/api/health/live` и `/api/health/ready`, graceful shutdown.
- **2.2** `main.worker.ts`, BullMQ + ioredis, outbox-поллер + реестр обработчиков с retry,
  `scheduler.tick`, AuditService, клиент ревалидации.
- Не делать бизнес-модули.

### Phase 3 — Auth

- **3.1** Argon2id, сессии, login/logout/me, cookie-флаги, rate limit (IP + email, Redis),
  CLI `user:create`, audit событий входа.
- **3.2** Глобальный guard, `@Public()`, `@RequirePermission()`, карта прав в `contracts`,
  политики владения, CSRF (Origin), admin API пользователей; тест «все непубличные маршруты закрыты».
- Не делать: OAuth, 2FA, JWT, регистрацию, сброс пароля по почте.

### Phase 4 — Content

- **4.1** Taxonomy + Authors: CRUD, публичные эндпоинты, правила слагов, 301 при смене слага.
- **4.2** `content-render`: GFM, `:::note/warning/tip`, код с filename, Shiki, якоря, TOC,
  reading time, `media:ID` → `<img srcset width height>`, raw HTML off, rehype-sanitize;
  XSS-тесты (`javascript:`, script, iframe, on*, SVG, опасные URL и атрибуты); `POST /api/admin/render`.
- **4.3** Статьи/страницы: CRUD, ревизии, version/409, state machine, publish/schedule/unpublish/
  archive, восстановление ревизии, outbox-события, публичные листинги и детальная.
- **4.4** Media (presigned PUT, confirm, magic bytes, ≤ 10 MB, EXIF strip, 640/1280/1920 webp,
  SHA-256 dedupe, запрет удаления используемого) + Error Reports (honeypot, rate limit, IP hash).
- Не делать: UI, поиск, KB/docs, комментарии, не-изображения.

### Phase 5 — Admin (`apps/web/src/app/admin`)

- **5.1** Shell: login, middleware, навигация, серверный API-клиент, Tailwind + shadcn/ui,
  CRUD категорий, тегов, авторов, пользователей.
- **5.2** Список материалов + редактор (CodeMirror 6, метаданные, slug, SEO, Ctrl+S,
  unsaved changes, localStorage-бэкап, обработка 409).
- **5.3** Превью (split view) + вставка/drag&drop изображений + медиатека.
- **5.4** Publish/schedule, ревизии с diff и restore, error reports, audit, дашборд.
- Не делать: WYSIWYG, совместное редактирование, серверный autosave, лишнюю полировку.

### Phase 6 — Public frontend

- **6.1** Дизайн-токены, типографика, тёмная/светлая тема без мигания, next/font, header/footer, навигация, breadcrumbs.
- **6.2** Главная, страница статьи (TOC, копирование кода, callouts, автор, теги, related, изображения со srcset).
- **6.3** Категории, теги, авторы, все статьи (пагинация `?page=N`), статические страницы, 404/500,
  Ctrl+Enter, кэш по тегам + ревалидация из worker.
- Не делать: поиск, SEO, инструменты.

### Phase 7 — Search

- **7.1** Миграция `search_tsv` (взвешенный, `russian` + `simple`, ё→е), GIN, pg_trgm, `search_misses`;
  `SearchService`; `GET /api/v1/search`, `/search/suggest`.
- **7.2** Страница `/search` (noindex), подсказки в шапке, отчёт «нет результатов» в админке.
- Эталонные запросы: русская морфология, английский, `/etc/nginx`, `0.0.0.0`, `:443`, `-t`,
  `qmgr.db`, `ERR_CONNECTION_RESET`. Не делать: OpenSearch, Meilisearch, semantic search.

### Phase 8 — SEO

- **8.1** generateMetadata, canonical, OG/Twitter, OG-картинки (`next/og`), JSON-LD (TechArticle,
  BreadcrumbList, Person, Organization, WebSite + SearchAction), noindex (search, admin, тонкие теги).
- **8.2** sitemap index, robots (staging: `Disallow: /`), RSS (общий + по категориям), 301,
  IndexNow из worker, флаг Яндекс Метрики.

### Phase 9 — Tools (`packages/tools-core`, `apps/web/src/tools`, `registry.ts`)

- **9.1** Чистые функции + boundary-тесты: IPv4 subnet, chmod, cron, Base64, URL encode,
  UUID, password (Web Crypto), JWT decode (без проверки подписи), Unix timestamp, SHA.
- **9.2** Реестр, каталог `/tools`, шаблон страницы, первые 5 UI (lazy).
- **9.3** Остальные 5 UI, SEO (WebApplication), sitemap. На странице JWT явно: «декодирование ≠ проверка подлинности».
- Не делать: DNS, SSL, WHOIS, port scanner, БД-реестр.

### Phase 10 — Testing

- **10.1** Playwright: login, создание статьи, загрузка изображения, публикация, статья видна,
  поиск, RSS, отложенная публикация, error report, author не может публиковать.
- **10.2** Security review (заголовки, rate limits, HTML rendering), `docs/perf.md`.

### Phase 11 — Production

- **11.1** Dockerfiles (non-root, healthcheck), `compose.prod.yml`, nginx, TLS.
- **11.2** CI/CD: образы по SHA, deploy по SSH, миграции до переключения, rollback.
- **11.3** Бэкапы + проверенное восстановление, мониторинг доступности, Telegram-алерты,
  hardening VPS, `docs/runbook.md`.
- Не делать: Kubernetes, Terraform, Prometheus, Grafana, несколько реплик.

## V2 (сохранять архитектурную возможность, не реализовывать)

TOTP 2FA · KB · документация · серии · комментарии · аккаунты читателей · OAuth ·
серверные инструменты (с защитой от SSRF) · публичный OpenAPI · рассылка · Telegram-автопостинг ·
Prometheus/Grafana/Loki · GlitchTip · расширенные редиректы · слияние тегов · проверка битых ссылок.

## V3

OpenSearch · i18n · рекомендации · вебхуки · аналитика · read replicas ·
горизонтальное масштабирование · Kubernetes · точечный вынос сервисов.
