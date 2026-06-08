# Инструкция: добавление таблиц в базу Газпроект Сервис Автоматика (SQLite)

## Структура существующих таблиц

```
gastech.db
├── users        — пользователи
├── carts        — корзины
├── orders       — заказы
└── order_items  — позиции заказов
```

---

## Способ 1 — через `sqlite3` CLI (рекомендуется для разработки)

### Установка (если нет)
```bash
# Ubuntu / Debian
sudo apt install sqlite3

# macOS
brew install sqlite3
```

### Открыть базу
```bash
sqlite3 gastech.db
```

### Создать новую таблицу прямо в консоли
```sql
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,
  category    TEXT,
  description TEXT,
  image       TEXT,
  badge       TEXT,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
```

### Проверить что таблица создалась
```sql
-- Список всех таблиц
.tables

-- Схема конкретной таблицы
.schema products

-- Посмотреть содержимое
SELECT * FROM products LIMIT 10;
```

### Выйти
```sql
.quit
```

---

## Способ 2 — добавить таблицу через `server.js` (рекомендуется для production)

Найдите в `server.js` блок `db.exec(...)` с `CREATE TABLE IF NOT EXISTS` и добавьте туда свою таблицу. Она создастся автоматически при запуске сервера.

```js
db.exec(`
  -- ... существующие таблицы ...

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    price       INTEGER NOT NULL DEFAULT 0,
    category    TEXT,
    description TEXT,
    image       TEXT,
    badge       TEXT,
    stock       INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );
`);
```

---

## Способ 3 — SQL-файл + выполнение одной командой

Создайте файл `migrations/add_products.sql`:

```sql
-- migrations/add_products.sql

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,
  category    TEXT,
  description TEXT,
  image       TEXT,
  badge       TEXT,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- Начальные данные (опционально)
INSERT OR IGNORE INTO products (name, price, category, description, image, badge, stock, created_at)
VALUES
  ('Датчик метана СН4-Про',      25000,  'sensors',   'Электрохимический сенсор, диапазон 0–5% НКПРП', '📡', 'new', 50, strftime('%s','now') * 1000),
  ('Газоанализатор ГАН-12',      85000,  'analyzers', 'Мультигазовый анализатор, 4 канала, RS-485, IP65', '🔬', 'hot', 20, strftime('%s','now') * 1000),
  ('Ультразвуковой течеискатель', 42000,  'leak',      'Обнаружение утечек газа и пара, 20–100 кГц', '🔊', NULL,  30, strftime('%s','now') * 1000),
  ('Калибратор давления КП-2',   120000, 'analyzers', 'Прецизионная калибровка 0–600 бар, класс 0.025', '⚙️', NULL,  10, strftime('%s','now') * 1000),
  ('Датчик CO₂ настенный',       12000,  'sensors',   'NDIR-сенсор, диапазон 0–5000 ppm', '🔌', 'new', 100, strftime('%s','now') * 1000),
  ('Портативный анализатор О₂',  55000,  'analyzers', 'Анализ кислорода 0–25%, IP67, 8 ч работы', '🔋', NULL,  15, strftime('%s','now') * 1000);
```

Выполнить:
```bash
sqlite3 gastech.db < migrations/add_products.sql
```

---

## Примеры других полезных таблиц для проекта

### Таблица категорий
```sql
CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,   -- 'sensors', 'analyzers', 'leak'
  label TEXT NOT NULL           -- 'Датчики', 'Анализаторы', 'Течеискатели'
);
```

### Таблица заявок на сервис
```sql
CREATE TABLE IF NOT EXISTS service_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  company    TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',  -- new | in_progress | done
  created_at INTEGER NOT NULL
);
```

### Таблица новостей / документов
```sql
CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  category   TEXT,               -- 'cert', 'manual', 'datasheet'
  file_url   TEXT,
  created_at INTEGER NOT NULL
);
```

---

## Добавить колонку в существующую таблицу

SQLite поддерживает `ALTER TABLE ... ADD COLUMN`:

```sql
-- Добавить поле stock в таблицу (если products уже существует)
ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0;

-- Добавить поле phone в users (уже реализовано в server.js через try/catch)
ALTER TABLE users ADD COLUMN phone TEXT;
```

> ⚠️ SQLite **не поддерживает** `DROP COLUMN` и `RENAME COLUMN` до версии 3.35.
> Для удаления колонки нужно создать новую таблицу и перенести данные.

---

## Посмотреть всё содержимое базы

```bash
sqlite3 gastech.db
```

```sql
-- Все таблицы
.tables

-- Полная схема
.schema

-- Просмотр таблицы users (без паролей)
SELECT id, email, company, phone, is_admin, datetime(created_at/1000,'unixepoch') as created
FROM users;

-- Просмотр всех заказов с email пользователя
SELECT o.id, u.email, o.status, o.total, datetime(o.created_at/1000,'unixepoch') as created
FROM orders o JOIN users u ON u.id = o.user_id
ORDER BY o.created_at DESC;

-- Позиции конкретного заказа (заменить 1 на нужный id)
SELECT * FROM order_items WHERE order_id = 1;
```

---

## Подключение таблицы `products` к API (пример маршрута)

После создания таблицы добавьте в `server.js`:

```js
// GET /api/products — все товары из БД
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json({ ok: true, products });
});

// POST /api/admin/products — добавить товар (только для админа)
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, price, category, description, image, badge, stock } = req.body;
  if (!name || !price) return res.status(400).json({ ok: false, error: 'missing_fields' });
  const info = db.prepare(`
    INSERT INTO products (name, price, category, description, image, badge, stock, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, price, category, description, image, badge, stock ?? 0, Date.now());
  res.json({ ok: true, id: info.lastInsertRowid });
});

// PATCH /api/admin/products/:id — обновить товар
app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, price, category, description, image, badge, stock } = req.body;
  db.prepare(`
    UPDATE products SET name=?, price=?, category=?, description=?, image=?, badge=?, stock=?
    WHERE id=?
  `).run(name, price, category, description, image, badge, stock, Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/admin/products/:id — удалить товар
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});
```
