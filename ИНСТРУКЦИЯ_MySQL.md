# Перенос Газпроект Сервис Автоматика с SQLite на MySQL (XAMPP)

## Шаг 1 — Запустить XAMPP и создать базу данных

1. Открой **XAMPP Control Panel** и нажми **Start** рядом с **MySQL** (и Apache если нужен phpMyAdmin)
2. Перейди в браузере на **http://localhost/phpmyadmin**
3. Слева нажми **«Создать БД»** (или вкладка «Базы данных»)
4. Введи имя: `gastech`, кодировка: `utf8mb4_unicode_ci` → нажми **Создать**

> По умолчанию в XAMPP: пользователь `root`, пароль **пустой**.
> Если ты ставил пароль — укажи его в server.js (см. Шаг 3).

---

## Шаг 2 — Заменить файлы в проекте

Скопируй два файла из этого архива в папку с твоим проектом, **заменив** существующие:

| Файл | Что делает |
|---|---|
| `server.js` | Сервер переписан под MySQL (драйвер mysql2) |
| `package.json` | Добавлена зависимость mysql2 |

Старый `gastech.db` можно удалить — он больше не нужен.

---

## Шаг 3 — Настроить подключение (если нужно)

Открой новый `server.js` и найди блок `mysql.createPool(...)` (~строка 23):

```js
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',   // ← вставь пароль сюда если есть
  database: process.env.DB_NAME     || 'gastech',
  ...
});
```

Если пароль у root пустой (стандарт XAMPP) — ничего менять не нужно.

---

## Шаг 4 — Установить зависимости и запустить

Открой терминал в папке проекта:

```bash
# Установить пакеты (добавится mysql2)
npm install

# Запустить сервер
npm start
```

При первом запуске сервер **автоматически создаст все таблицы** в БД `gastech`
и добавит демо-пользователей. В консоли должно появиться:

```
✅ MySQL подключён
🚀 http://localhost:3000
demo:  demo@gazproekt-sa.ru / demo1234
admin: admin@gazproekt-sa.ru / admin1234
```

---

## Шаг 5 — Проверить в phpMyAdmin

Зайди на http://localhost/phpmyadmin → база `gastech` →
должны появиться таблицы: `users`, `carts`, `orders`, `order_items`.

---

## Возможные ошибки

| Ошибка | Причина | Решение |
|---|---|---|
| `❌ Не удалось подключиться к MySQL` | XAMPP MySQL не запущен | Запусти MySQL в XAMPP Control Panel |
| `Unknown database 'gastech'` | БД не создана | Создай БД через phpMyAdmin (Шаг 1) |
| `Access denied for user 'root'` | Неверный пароль | Укажи пароль в server.js (Шаг 3) |
| `Cannot find package 'mysql2'` | npm install не выполнен | Запусти `npm install` |

---

## Структура таблиц (справочно)

```
gastech (MySQL)
├── users        — пользователи (email, пароль, компания, телефон, is_admin)
├── carts        — корзины (JSON, привязаны к user_id)
├── orders       — заказы (статус, сумма, комментарий)
└── order_items  — позиции заказов
```

Все таблицы создаются автоматически при старте сервера — вручную ничего писать не нужно.
