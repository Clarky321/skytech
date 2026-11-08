# Git workflow — SkyTech.ru

Репозиторий: <https://github.com/Clarky321/skytech> (remote `origin`).

## Ветки

| Ветка       | Назначение                                                                  | Откуда    | Куда сливается          |
| ----------- | --------------------------------------------------------------------------- | --------- | ----------------------- |
| `main`      | Стабильная версия. Только проверенный код; отсюда будет деплой в production | —         | —                       |
| `develop`   | Основная ветка разработки. Сюда попадают завершённые шаги плана             | `main`    | `main` (релиз)          |
| `feature/*` | Шаг или фаза плана (`docs/plan.md`), новая функциональность                 | `develop` | `develop`               |
| `fix/*`     | Исправление ошибки, найденной в `develop`                                   | `develop` | `develop`               |
| `hotfix/*`  | Срочное исправление стабильной версии                                       | `main`    | `main`, затем `develop` |

Прямые коммиты в `main` запрещены — только Pull Request. Feature-ветки создаются в момент начала
работы, заранее не заводятся.

## Именование веток

Латиница, нижний регистр, слова через дефис.

```
feature/phase-0.2-docker
feature/phase-1-database
feature/phase-3.1-sessions
fix/api-health-status-code
hotfix/robots-staging-leak
```

- Для шагов плана: `feature/phase-<N>[.<M>]-<кратко>`. Если фаза делается по шагам — одна ветка на шаг.
- `fix/` и `hotfix/` — по сути проблемы, а не по номеру задачи.

## Commit messages — Conventional Commits

Формат: `<type>(<scope>): <что сделано>` — в повелительном наклонении, на английском, без точки в конце.

| type       | Когда                                  |
| ---------- | -------------------------------------- |
| `feat`     | новая функциональность                 |
| `fix`      | исправление ошибки                     |
| `refactor` | изменение кода без изменения поведения |
| `test`     | только тесты                           |
| `docs`     | только документация                    |
| `chore`    | инфраструктура, конфиги, зависимости   |
| `perf`     | производительность                     |
| `ci`       | GitHub Actions                         |

`scope` — модуль или фаза: `api`, `web`, `admin`, `content`, `auth`, `media`, `search`, `seo`,
`tools`, `db`, `infra`, `phase-0` и т. п.

```
feat(content): add article model
fix(api): correct health endpoint
chore(phase-0): initialize monorepo
docs: update development workflow
test(auth): add session tests
```

Не смешивайте в одном коммите фичу и несвязанный рефакторинг. Ломающее изменение помечается
`!` (`feat(api)!: ...`) и описывается в теле коммита.

## Начало новой фазы или шага

1. Убедиться, что предыдущий шаг слит в `develop` и в `docs/progress.md` отмечен `DONE`.
2. Обновить `develop` и создать ветку:

```powershell
git switch develop
git pull
git switch -c feature/phase-0.2-docker
```

3. Работать, коммитить небольшими логическими коммитами.
4. Перед каждым push: `pnpm check` (format, lint, typecheck, test, build) проходит,
   `git status` чистый, `git diff` проверен, секретов нет.

## Отправка в GitHub

```powershell
git push -u origin feature/phase-0.2-docker   # первый раз — с upstream
git push                                       # дальше
```

Force push в `main` и `develop` запрещён. В собственной feature-ветке допускается только
`git push --force-with-lease` и только до начала ревью.

## Pull Request

1. На GitHub: **Compare & pull request**, base — `develop`, compare — ваша ветка.
2. Заголовок — в формате Conventional Commits (он станет сообщением squash-коммита):
   `feat(db): add initial schema (Phase 1.1)`.
3. В описании: что сделано, как проверено (команды и результат), риски, ссылка на шаг плана.
4. CI (появится в Phase 0.2) должен быть зелёным.
5. Самопроверка diff на GitHub перед слиянием.

## Слияние в `develop`

- Способ: **Squash and merge** — один шаг плана = один коммит в `develop`.
- После слияния удалить ветку (кнопка **Delete branch** на GitHub) и локально:

```powershell
git switch develop
git pull
git branch -d feature/phase-0.2-docker
git fetch --prune
```

## Выпуск стабильной версии в `main`

Когда фаза (или набор шагов) завершена и `develop` стабилен:

1. PR `develop` → `main`, заголовок `release: Phase N — <кратко>`.
2. Способ: **Create a merge commit** (не squash — иначе истории `main` и `develop` разойдутся).
3. После слияния — тег версии:

```powershell
git switch main
git pull
git tag -a v0.1.0 -m "Phase 0 — foundation"
git push origin v0.1.0
```

Версии: `v0.<фаза>.<патч>` до выхода MVP, `v1.0.0` — запуск MVP.

## Исправление ошибок

- **В `develop`** (ещё не в релизе): ветка `fix/<суть>` от `develop` → PR в `develop` (squash).
- **В `main`** (срочно, в production): ветка `hotfix/<суть>` от `main` → PR в `main`
  (merge commit) → тег `vX.Y.(Z+1)` → сразу PR `main` → `develop`, чтобы исправление не потерялось.

```powershell
git switch main
git pull
git switch -c hotfix/robots-staging-leak
# исправление + тест
git commit -m "fix(seo): disallow indexing on staging"
git push -u origin hotfix/robots-staging-leak
```

## Удаление завершённых веток

```powershell
git branch --merged develop        # какие локальные ветки уже слиты
git branch -d <ветка>              # удалить локально (только если слита)
git push origin --delete <ветка>   # удалить на GitHub, если не удалена кнопкой
git fetch --prune                  # убрать ссылки на удалённые ветки
```

Ветки `main` и `develop` не удаляются никогда.

## Защита веток на GitHub

Настраивается в **Settings → Rules → Rulesets** (или через `gh api`).

`main`:

- Restrict deletions — запрет удаления.
- Block force pushes — запрет force push.
- Require a pull request before merging — прямой push запрещён.
- После Phase 0.2: Require status checks to pass — обязательный зелёный CI.

`develop` (рекомендуется):

- Restrict deletions, Block force pushes.

Как применить вручную:

1. GitHub → репозиторий → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. Name: `protect-main`, Enforcement status: **Active**.
3. Target branches → **Add target** → **Include default branch** (это `main`).
4. Включить: **Restrict deletions**, **Require a pull request before merging**
   (Required approvals: 0 — разработчик один), **Block force pushes**.
5. **Create**. Повторить для `develop` (`protect-develop`, target `develop`, без требования PR).

## Памятка для PowerShell

```powershell
git status                          # что изменено
git branch -vv                      # ветки и их upstream
git log --oneline --decorate -10    # последние коммиты
git switch develop; git pull        # обновить develop
git switch -c feature/<имя>         # новая ветка
git add -A; git status              # подготовить коммит и проверить список
git diff --cached                   # просмотреть, что уйдёт в коммит
git commit -m "feat(scope): message"
git push -u origin feature/<имя>    # первый push ветки
git fetch --prune                   # синхронизировать список удалённых веток
git stash; git stash pop            # временно убрать / вернуть изменения
```

Если команда в PowerShell 5.1 содержит `@`, `{` или `--` и разбирается неправильно,
используйте `git --% <аргументы>` или возьмите аргумент в одинарные кавычки.
