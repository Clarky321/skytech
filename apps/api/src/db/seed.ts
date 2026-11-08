import type { INestApplicationContext } from '@nestjs/common';
import type { CategoryInput, SkyDocument, TagInput } from '@skytech/contracts';
import { asc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/decorators.js';
import { AuthorsService } from '../authors/authors.service.js';
import { ContentService } from '../content/content.service.js';
import { DB, type Db } from '../platform/db.js';
import { TaxonomyService } from '../taxonomy/taxonomy.service.js';
import { content, users } from './schema/index.js';
import {
  a,
  b,
  c,
  callout,
  code,
  doc,
  h,
  hr,
  i,
  ol,
  p,
  quote,
  table,
  tasks,
  ul,
} from './seed-docs.js';

type CategorySeed = Omit<CategoryInput, 'parentId'> & {
  children?: Omit<CategoryInput, 'parentId'>[];
};

const CATEGORIES: CategorySeed[] = [
  {
    name: 'Windows Server',
    slug: 'windows-server',
    description: 'Роли и службы Windows Server, PowerShell, диагностика.',
    sortOrder: 10,
    children: [
      {
        name: 'Active Directory',
        slug: 'active-directory',
        description: 'Домены, DNS, групповые политики.',
        sortOrder: 10,
      },
    ],
  },
  {
    name: 'Linux',
    slug: 'linux',
    description: 'Администрирование Linux-серверов: systemd, сеть, журналы.',
    sortOrder: 20,
  },
  {
    name: 'Сети',
    slug: 'networks',
    description: 'TCP/IP, VLAN, маршрутизация и сетевое оборудование.',
    sortOrder: 30,
    children: [
      {
        name: 'MikroTik',
        slug: 'mikrotik',
        description: 'RouterOS: настройка и диагностика.',
        sortOrder: 10,
      },
      {
        name: 'Cisco',
        slug: 'cisco',
        description: 'Cisco IOS, коммутация и маршрутизация.',
        sortOrder: 20,
      },
    ],
  },
  {
    name: 'Виртуализация и контейнеры',
    slug: 'virtualization',
    description: 'Hyper-V, VMware, Docker.',
    sortOrder: 40,
  },
  {
    name: 'Мониторинг',
    slug: 'monitoring',
    description: 'Zabbix, PRTG, метрики и алерты.',
    sortOrder: 50,
  },
  {
    name: 'Резервное копирование',
    slug: 'backup',
    description: 'Стратегии и инструменты бэкапа.',
    sortOrder: 60,
  },
  {
    name: 'Информационная безопасность',
    slug: 'security',
    description: 'Защита инфраструктуры.',
    sortOrder: 70,
  },
  { name: 'DevOps', slug: 'devops', description: 'CI/CD, инфраструктура как код.', sortOrder: 80 },
];

const TAGS: [string, string][] = [
  ['DNS', 'dns'],
  ['DHCP', 'dhcp'],
  ['PowerShell', 'powershell'],
  ['Bash', 'bash'],
  ['systemd', 'systemd'],
  ['nginx', 'nginx'],
  ['Docker', 'docker'],
  ['Docker Compose', 'docker-compose'],
  ['VLAN', 'vlan'],
  ['TCP/IP', 'tcp-ip'],
  ['Active Directory', 'active-directory'],
  ['Group Policy', 'group-policy'],
  ['Event Viewer', 'event-viewer'],
  ['Zabbix', 'zabbix'],
  ['PRTG', 'prtg'],
  ['MikroTik', 'mikrotik'],
  ['Cisco', 'cisco'],
  ['SSH', 'ssh'],
  ['SSL/TLS', 'ssl-tls'],
  ['Windows Server 2022', 'windows-server-2022'],
  ['Ubuntu', 'ubuntu'],
  ['Debian', 'debian'],
  ['Troubleshooting', 'troubleshooting'],
  ['Бэкап', 'backup'],
  ['Firewall', 'firewall'],
  ['iptables', 'iptables'],
  ['Hyper-V', 'hyper-v'],
  ['VMware', 'vmware'],
  ['Журналы', 'logs'],
  ['Kubernetes', 'kubernetes'],
];

interface ArticleSeed {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  body: SkyDocument;
}

const ARTICLES: ArticleSeed[] = [
  {
    title: 'Диагностика DNS в Windows Server: пошаговый чек-лист',
    slug: 'diagnostika-dns-windows-server',
    excerpt:
      'Как за 15 минут найти причину, по которой клиенты домена не разрешают имена: от ipconfig до журналов DNS-сервера.',
    category: 'windows-server',
    tags: ['dns', 'powershell', 'troubleshooting', 'windows-server-2022', 'event-viewer'],
    body: doc(
      p(
        'Проблемы с DNS проявляются как угодно: «не открывается сайт», «не входит в домен», «тормозит вход в систему». ',
        'Этот чек-лист помогает идти от клиента к серверу и не перезагружать всё подряд.',
      ),
      callout(
        'warning',
        p(
          b('Внимание! '),
          'Перед изменением параметров сетевого адаптера сохраните текущие настройки IP и DNS — например, выводом ',
          c('Get-NetIPConfiguration'),
          ' в файл.',
        ),
      ),
      h(1, 'Шаг 1. Проверяем клиент'),
      p('Начните с того, какие DNS-серверы реально использует компьютер и отвечают ли они:'),
      code(
        'powershell',
        `Get-DnsClientServerAddress -AddressFamily IPv4 | Format-Table InterfaceAlias, ServerAddresses
Resolve-DnsName dc01.corp.example.ru -Type A
Resolve-DnsName _ldap._tcp.dc._msdcs.corp.example.ru -Type SRV`,
      ),
      p(
        'Если ',
        c('Resolve-DnsName'),
        ' возвращает ',
        i('DNS name does not exist'),
        ' для SRV-записей домена — клиент спрашивает не тот DNS-сервер (часто это публичный DNS провайдера, прописанный вручную).',
      ),
      callout(
        'info',
        p(
          'Клиенты домена должны использовать только DNS-серверы контроллеров домена. Публичные резолверы указываются в серверах пересылки на DC.',
        ),
      ),
      h(1, 'Шаг 2. Очищаем кэш и проверяем повторно'),
      code(
        'dos',
        `ipconfig /flushdns
ipconfig /registerdns
nslookup -type=srv _ldap._tcp.dc._msdcs.corp.example.ru`,
      ),
      h(1, 'Шаг 3. Проверяем сервер'),
      table(
        ['Проверка', 'Команда', 'Норма'],
        [
          ['Служба DNS запущена', [c('Get-Service DNS')], 'Running'],
          ['Зоны загружены', [c('Get-DnsServerZone')], 'Есть зона домена и _msdcs'],
          ['Пересылка работает', [c('Resolve-DnsName ya.ru -Server dc01')], 'Возвращает A-записи'],
          ['Диагностика DC', [c('dcdiag /test:dns /v')], 'Все тесты passed'],
        ],
      ),
      h(2, 'Журналы DNS-сервера'),
      p(
        'Откройте ',
        b('Event Viewer → Applications and Services Logs → DNS Server'),
        '. События 4013 и 4015 говорят о проблемах с загрузкой зон, интегрированных в AD.',
      ),
      callout(
        'danger',
        p(
          'Не удаляйте записи SRV вручную на работающем контроллере домена: их восстановление потребует перерегистрации служб Netlogon.',
        ),
      ),
      h(1, 'Итоговый чек-лист'),
      tasks(
        [true, 'Клиент использует DNS-серверы контроллеров домена'],
        [true, 'SRV-записи домена разрешаются'],
        [false, 'dcdiag /test:dns проходит без ошибок'],
        [false, 'Настроены серверы пересылки для внешних имён'],
      ),
      callout(
        'success',
        p(
          'Если все пункты выполнены, а проблема осталась — ищите её не в DNS: проверьте маршрутизацию и фаервол.',
        ),
      ),
    ),
  },
  {
    title: 'systemd: как найти причину падения службы в Linux',
    slug: 'systemd-prichina-padeniya-sluzhby',
    excerpt:
      'Разбираем systemctl status, journalctl и коды выхода, чтобы понять, почему служба не стартует или перезапускается по кругу.',
    category: 'linux',
    tags: ['systemd', 'bash', 'ubuntu', 'logs', 'troubleshooting'],
    body: doc(
      p(
        'Служба «упала», мониторинг кричит. Вместо того чтобы сразу перезапускать её, соберите факты — это займёт пару минут.',
      ),
      h(1, 'Состояние службы'),
      code(
        'bash',
        `systemctl status nginx.service --no-pager
systemctl show nginx.service -p Result -p ExecMainStatus -p NRestarts`,
      ),
      p(
        'Поле ',
        c('Result'),
        ' подскажет тип сбоя: ',
        c('exit-code'),
        ', ',
        c('signal'),
        ', ',
        c('timeout'),
        ' или ',
        c('start-limit-hit'),
        '.',
      ),
      table(
        ['Result', 'Что означает', 'Куда смотреть'],
        [
          ['exit-code', 'Процесс завершился с ошибкой', 'Журнал службы, конфигурация'],
          ['signal', 'Процесс убит сигналом (часто OOM)', [c('dmesg -T | grep -i oom')]],
          ['timeout', 'Не уложился в TimeoutStartSec', 'Зависимости, медленный старт'],
          ['start-limit-hit', 'Слишком много перезапусков', [c('systemctl reset-failed')]],
        ],
      ),
      h(1, 'Журнал только этой службы'),
      code(
        'bash',
        `journalctl -u nginx.service -b --no-pager -n 100
journalctl -u nginx.service --since "10 min ago" -p warning`,
      ),
      callout(
        'info',
        p(
          'Флаг ',
          c('-b'),
          ' ограничивает вывод текущей загрузкой системы — так вы не утонете в старых записях.',
        ),
      ),
      h(2, 'Проверка конфигурации перед перезапуском'),
      code('bash', 'sudo nginx -t && sudo systemctl reload nginx'),
      callout(
        'warning',
        p(
          'Используйте ',
          c('reload'),
          ' вместо ',
          c('restart'),
          ', если служба это поддерживает: активные соединения не оборвутся.',
        ),
      ),
      h(1, 'Если служба перезапускается по кругу'),
      ol(
        ['Посмотрите ', c('NRestarts'), ' и интервал перезапусков в unit-файле.'],
        [
          'Временно отключите автоперезапуск, чтобы прочитать ошибку: ',
          c('systemctl edit nginx'),
          '.',
        ],
        'Исправьте причину и верните настройки.',
      ),
      quote(p(i('Правило: перезапуск — это не диагностика. Сначала журнал, потом действия.'))),
    ),
  },
  {
    title: 'VLAN на MikroTik: trunk и access порты на bridge',
    slug: 'vlan-mikrotik-trunk-access',
    excerpt:
      'Современный способ настройки VLAN в RouterOS через bridge VLAN filtering: схема, команды и типичные ошибки.',
    category: 'mikrotik',
    tags: ['mikrotik', 'vlan', 'tcp-ip'],
    body: doc(
      p(
        'В RouterOS 7 правильный способ настройки VLAN на коммутирующих портах — ',
        b('bridge VLAN filtering'),
        '. Старый вариант с VLAN-интерфейсами на физических портах ломает аппаратную разгрузку.',
      ),
      h(1, 'Схема'),
      ul(
        [b('ether1'), ' — trunk к основному коммутатору (VLAN 10, 20 tagged)'],
        [b('ether2'), ' — access, VLAN 10 (бухгалтерия)'],
        [b('ether3'), ' — access, VLAN 20 (гостевая сеть)'],
      ),
      callout(
        'danger',
        p(
          b('Включайте vlan-filtering последним шагом. '),
          'Если включить его до настройки management-доступа, вы потеряете связь с роутером. Работайте через Safe Mode (Ctrl+X в терминале).',
        ),
      ),
      h(1, 'Настройка'),
      code(
        'bash',
        `/interface bridge add name=bridge1 vlan-filtering=no
/interface bridge port
add bridge=bridge1 interface=ether1
add bridge=bridge1 interface=ether2 pvid=10
add bridge=bridge1 interface=ether3 pvid=20
/interface bridge vlan
add bridge=bridge1 tagged=bridge1,ether1 untagged=ether2 vlan-ids=10
add bridge=bridge1 tagged=bridge1,ether1 untagged=ether3 vlan-ids=20`,
      ),
      p('Проверьте таблицу VLAN и только потом включайте фильтрацию:'),
      code(
        'bash',
        `/interface bridge vlan print
/interface bridge set bridge1 vlan-filtering=yes`,
      ),
      hr(),
      h(2, 'Типичные ошибки'),
      table(
        ['Симптом', 'Причина'],
        [
          [
            'Нет доступа к роутеру после включения фильтрации',
            'Bridge не добавлен в tagged для management VLAN',
          ],
          ['Клиенты на access-порту без сети', 'Не задан pvid на порту'],
          ['Трафик не проходит trunk', 'Порт отсутствует в tagged нужного VLAN'],
        ],
      ),
      callout(
        'success',
        p(
          'Сохраните конфигурацию: ',
          c('/export file=vlan-ok'),
          ' — и держите копию вне устройства.',
        ),
      ),
      p(
        'Подробности — в ',
        a('документации MikroTik', 'https://help.mikrotik.com/docs/display/ROS/Bridge+VLAN+Table'),
        '.',
      ),
    ),
  },
];

/** Idempotent: re-running skips what already exists (matched by slug). */
export async function seedDatabase(app: INestApplicationContext): Promise<string> {
  const db = app.get<Db>(DB);
  const taxonomy = app.get(TaxonomyService);
  const authors = app.get(AuthorsService);
  const contentService = app.get(ContentService);

  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!admin) {
    throw new Error(
      'No admin account yet. Create one first: pnpm user:create --email … --name … --role admin',
    );
  }
  const actor: AuthUser = {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
    role: 'admin',
    sessionId: 'cli',
  };

  const tree = await taxonomy.categoryTree();
  const existingCategories = new Map(
    tree.flatMap((r) => [r, ...r.children]).map((c) => [c.slug, c.id]),
  );
  let createdCategories = 0;
  for (const cat of CATEGORIES) {
    let parentId = existingCategories.get(cat.slug);
    if (!parentId) {
      const { children: _children, ...input } = cat;
      parentId = (await taxonomy.createCategory(actor, { ...input, parentId: null }, null)).id;
      existingCategories.set(cat.slug, parentId);
      createdCategories++;
    }
    for (const child of cat.children ?? []) {
      if (existingCategories.has(child.slug)) continue;
      const created = await taxonomy.createCategory(actor, { ...child, parentId }, null);
      existingCategories.set(child.slug, created.id);
      createdCategories++;
    }
  }

  const existingTags = new Map((await taxonomy.listTags()).map((t) => [t.slug, t.id]));
  let createdTags = 0;
  for (const [name, slug] of TAGS) {
    if (existingTags.has(slug)) continue;
    const input: TagInput = { name, slug, description: '' };
    existingTags.set(slug, (await taxonomy.createTag(actor, input, null)).id);
    createdTags++;
  }

  let editorial = (await authors.list()).find((x) => x.slug === 'redaktsiya');
  editorial ??= await authors.create(
    actor,
    {
      name: 'Редакция SkyTech',
      slug: 'redaktsiya',
      jobTitle: 'Команда технических авторов',
      bio: 'Пишем практические инструкции для системных администраторов и инженеров инфраструктуры.',
      avatarMediaId: null,
      userId: null,
    },
    null,
  );

  let createdArticles = 0;
  for (const article of ARTICLES) {
    const [exists] = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, article.slug));
    if (exists) continue;
    const created = await contentService.create(
      actor,
      { type: 'article', title: article.title },
      null,
    );
    const saved = await contentService.saveDraft(
      actor,
      created.id,
      {
        version: created.version,
        note: 'Начальное наполнение',
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        body: article.body,
        categoryId: existingCategories.get(article.category) ?? null,
        tagIds: article.tags.map((t) => existingTags.get(t)).filter((t): t is string => Boolean(t)),
        authorId: editorial.id,
        coverMediaId: null,
        seoTitle: '',
        seoDescription: article.excerpt,
      },
      null,
    );
    await contentService.publish(actor, created.id, saved.version, null);
    createdArticles++;
  }

  return `Seed done: ${String(createdCategories)} categories, ${String(createdTags)} tags, ${String(createdArticles)} articles created.`;
}
