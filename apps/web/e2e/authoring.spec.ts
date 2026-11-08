import { type Browser, expect, type Page, test } from '@playwright/test';
import { E2E } from './env';

/**
 * The main scenario of the first vertical slice:
 * admin → create article → write it in the block editor → save → reopen → preview →
 * publish → the same article is on the public site.
 */

const TITLE = 'Сетевой адаптер: смена IP без потери связи';
const SLUG = 'setevoy-adapter-smena-ip-bez-poteri-svyazi';

/** A real 96×64 PNG (generated with sharp) for the media pipeline. */
function pngFixture(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGAAAABACAIAAABqVuVZAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAaUlEQVR42u3QMQ0AAAgDsMlBHTqRhQNujiZV0FQPhygQJEiQIEGCBAlCkCBBggQJEiQIQYIECRIkSJAgBAkSJEiQIEGCBCFIkCBBggQJEoQgQYIECRIkSBCCBAkSJEiQIEGCECRIkKB/Fr+w0eF5aUaXAAAAAElFTkSuQmCC',
    'base64',
  );
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Пароль').fill(who.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/admin');
}

/** Types a slash command and picks the first matching block. */
async function slash(page: Page, command: string) {
  await page.keyboard.type(`/${command}`);
  await expect(page.getByRole('listbox', { name: 'Вставить блок' })).toBeVisible();
  await page.keyboard.press('Enter');
}

async function anonymousPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: 'serial' });

test('admin writes, saves, previews and publishes a technical article', async ({
  page,
  browser,
}) => {
  await login(page, E2E.admin);
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();

  // --- create
  await page.goto('/admin/content/new');
  await page.getByLabel('Название').fill(TITLE);
  await page.getByRole('button', { name: 'Создать и открыть редактор' }).click();
  await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();

  // Slug follows the title automatically.
  await expect(page.getByLabel('Адрес (slug)')).toHaveValue(SLUG);

  await page
    .getByLabel('Краткое описание')
    .fill('Как поменять IP-адрес сервера удалённо и не потерять доступ.');
  await page.getByLabel('Категория').selectOption({ label: 'Сети' });
  await page.getByLabel('Автор').selectOption({ label: 'Редакция SkyTech' });

  // --- write in the block editor
  const editor = page.locator('[data-testid=block-editor] .ProseMirror');
  await editor.click();
  await slash(page, 'heading');
  await page.keyboard.type('Подготовка');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Сначала сохраните ');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('текущую конфигурацию');
  await page.keyboard.press('Control+B');
  await page.keyboard.type(' адаптера.');
  await page.keyboard.press('Enter');

  await slash(page, 'warning');
  await page.keyboard.type(
    'Внимание! Перед изменением параметров сетевого адаптера сохраните текущие настройки IP и DNS.',
  );
  // Leave the callout: Enter on an empty line lifts out of the block.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await slash(page, 'code');
  await page.keyboard.type('Get-NetIPConfiguration | Out-File C:\\backup\\ip.txt');
  // Leave the code block (three Enters at the end exit it in TipTap).
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // Image: "/image" opens the media picker; upload a file from the computer.
  await slash(page, 'image');
  const picker = page.getByRole('dialog', { name: 'Изображение' });
  await expect(picker).toBeVisible();
  await picker.getByTestId('media-upload-input').setInputFiles({
    name: 'network-adapter.png',
    mimeType: 'image/png',
    buffer: pngFixture(),
  });
  await expect(picker).toBeHidden();
  const figure = editor.locator('figure.doc-image');
  await expect(figure.locator('img')).toBeVisible();
  await figure.getByLabel('Подпись к изображению').fill('Рис. 1. Свойства сетевого адаптера');
  await figure.getByLabel('Альтернативный текст').fill('Окно свойств IPv4');

  // Table at the end of the document (TipTap keeps an empty paragraph there).
  await editor.locator(':scope > p').last().click();
  await slash(page, 'table');
  await page.keyboard.type('Параметр');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Значение');
  await page.keyboard.press('Tab');
  await page.keyboard.type('IP');
  await page.keyboard.press('Tab');
  await page.keyboard.type('10.0.0.15/24');

  // --- save
  await expect(page.getByTestId('save-state')).toContainText('несохранённые');
  await page.keyboard.press('Control+S');
  await expect(page.getByTestId('save-state')).toContainText('Сохранено в');

  // --- reopen: everything comes back from the server
  await page.goto(editorUrl);
  await expect(editor.locator('h1')).toHaveText('Подготовка');
  await expect(editor.locator('strong')).toHaveText('текущую конфигурацию');
  await expect(editor.locator('[data-type=callout][data-variant=warning]')).toContainText(
    'сохраните текущие настройки IP и DNS',
  );
  await expect(editor.locator('.code-block code')).toContainText('Get-NetIPConfiguration');
  await expect(editor.locator('table td').filter({ hasText: '10.0.0.15/24' })).toHaveCount(1);
  await expect(editor.locator('figure.doc-image img')).toBeVisible();
  await expect(page.getByLabel('Подпись к изображению')).toHaveValue(
    'Рис. 1. Свойства сетевого адаптера',
  );
  await expect(page.getByTestId('save-state')).toContainText('Все изменения сохранены');

  // --- the draft is not public yet
  const anon = await anonymousPage(browser);
  const draftResponse = await anon.page.goto(`/articles/${SLUG}`);
  expect(draftResponse?.status()).toBe(404);

  // --- preview (opens a new tab with the public layout)
  const [preview] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('button', { name: 'Предпросмотр' }).click(),
  ]);
  await preview.waitForURL(/\/admin\/preview\//);
  const previewUrl = preview.url();
  await expect(preview.getByText('Предпросмотр черновика.')).toBeVisible();
  await expect(preview.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(preview.locator('.callout--warning')).toBeVisible();
  await preview.close();

  // The preview URL is staff-only.
  await anon.page.goto(previewUrl);
  await expect(anon.page).toHaveURL(/\/admin\/login/);

  // --- publish
  await page.getByTestId('primary-action').click();
  await expect(page.getByText('Опубликовано', { exact: true }).first()).toBeVisible();

  // --- public page shows the same content, rendered and sanitized on the server
  const res = await anon.page.goto(`/articles/${SLUG}`);
  expect(res?.status()).toBe(200);
  const article = anon.page.locator('.article-body');
  await expect(anon.page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(article.locator('h2#podgotovka')).toHaveText(/Подготовка/);
  await expect(article.locator('strong')).toHaveText('текущую конфигурацию');
  await expect(article.locator('.callout--warning .callout__title')).toHaveText('Внимание');
  await expect(article.locator('.code-block[data-language=bash] code')).toContainText(
    'Get-NetIPConfiguration',
  );
  await expect(article.locator('table th').first()).toHaveText('Параметр');
  await expect(article.locator('figure.doc-image img')).toHaveAttribute('alt', 'Окно свойств IPv4');
  await expect(article.locator('figcaption')).toHaveText('Рис. 1. Свойства сетевого адаптера');
  await expect(anon.page.getByRole('navigation', { name: 'Содержание' }).first()).toContainText(
    'Подготовка',
  );
  await expect(anon.page.getByRole('link', { name: 'Редакция SkyTech' }).first()).toBeVisible();

  // Copy button works on the public page.
  await anon.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await article.getByRole('button', { name: 'Скопировать код' }).click();
  await expect(article.getByRole('button', { name: 'Скопировать код' })).toHaveText('Скопировано');

  // Listed on the category page.
  await anon.page.goto('/category/networks');
  await expect(anon.page.getByRole('link', { name: TITLE })).toBeVisible();
  await anon.context.close();
});

test('anonymous visitors cannot reach drafts or the admin', async ({ browser, page }) => {
  // Create a fresh draft as admin (through the UI session's API).
  await login(page, E2E.admin);
  const created = await page.request.post('/api/admin/content', {
    headers: { Origin: E2E.webUrl },
    data: { type: 'article', title: 'Секретный черновик' },
  });
  expect(created.status()).toBe(201);
  const draft = (await created.json()) as { id: string; draft: { slug: string } };

  const anon = await anonymousPage(browser);
  expect((await anon.page.goto(`/articles/${draft.draft.slug}`))?.status()).toBe(404);
  await anon.page.goto('/admin');
  await expect(anon.page).toHaveURL(/\/admin\/login/);
  const api = await anon.page.request.get(`/api/admin/content/${draft.id}`);
  expect(api.status()).toBe(401);
  const preview = await anon.page.request.get(`/api/admin/content/${draft.id}/preview`);
  expect(preview.status()).toBe(401);
  await anon.context.close();
});

test('an author can write but cannot publish', async ({ page }) => {
  await login(page, E2E.author);
  await page.goto('/admin/content/new');
  await page.getByLabel('Название').fill('Черновик автора');
  await page.getByRole('button', { name: 'Создать и открыть редактор' }).click();
  await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').pop() ?? '';

  // The UI offers review, not publishing…
  await expect(page.getByTestId('primary-action')).toHaveText(/Отправить на проверку/);
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toHaveCount(0);

  // …and the API refuses a forged publish request.
  const detail = (await (await page.request.get(`/api/admin/content/${id}`)).json()) as {
    version: number;
  };
  const publish = await page.request.post(`/api/admin/content/${id}/publish`, {
    headers: { Origin: E2E.webUrl },
    data: { version: detail.version },
  });
  expect(publish.status()).toBe(403);

  // Without the Origin header the same request is stopped by CSRF protection.
  const noOrigin = await page.request.post(`/api/admin/content/${id}/submit`, {
    data: { version: detail.version },
  });
  expect(noOrigin.status()).toBe(403);
});
