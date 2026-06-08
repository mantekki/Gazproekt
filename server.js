import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@gazproekt-sa.ru').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
const DEMO_COMPANY = process.env.DEMO_COMPANY || 'Demo Company';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gazproekt-sa.ru').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

/* ===================== MySQL POOL ===================== */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',          // XAMPP: пароль пустой по умолчанию
  database: process.env.DB_NAME || 'gastech',
  waitForConnections: true,
  connectionLimit: 10,
});

/* ===================== HELPERS ===================== */
// Shorthand: получить одну строку
async function getRow(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}
// Shorthand: получить все строки
async function getAll(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
// Shorthand: выполнить INSERT/UPDATE/DELETE
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result; // result.insertId, result.affectedRows
}

/* ===================== PASSWORDS ===================== */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function formatRuPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits || digits === '7') return '';
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const local = digits.slice(1);
  let result = '+7';
  if (local.length > 0) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += ` ${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}

/* ===================== PRODUCT CATALOG ===================== */
const PRODUCTS = [
  { id: 1, name: 'Датчик метана СН4-Про', price: 25000, cat: 'sensors', img: 'img/ch4pro-cut.png', badge: 'new', desc: 'Электрохимический сенсор, диапазон 0–5% НКПРП, выход 4–20 мА', specGas: 'CH₄ / метан', specRange: '0–5% НКПРП', specOutput: '4–20 мА', specProtection: '—', specAccuracy: 'Электрохимический сенсор' },
  { id: 2, name: 'Газоанализатор ГАН-12', price: 85000, cat: 'analyzers', img: 'img/gazanaliz-cut.png', badge: 'hot', desc: 'Мультигазовый анализатор, 4 канала, RS-485, IP65', specGas: 'Мультигазовый контроль', specRange: '4 канала', specOutput: 'RS-485', specProtection: 'IP65', specAccuracy: 'Промышленное исполнение' },
  { id: 3, name: 'Ультразвуковой течеискатель', price: 42000, cat: 'leak', img: 'img/techisk-cut.png', badge: null, desc: 'Обнаружение утечек газа и пара, диапазон 20–100 кГц', specGas: 'Утечки газа и пара', specRange: '20–100 кГц', specOutput: '—', specProtection: '—', specAccuracy: 'Ультразвуковое обнаружение' },
  { id: 4, name: 'Калибратор давления КП-2', price: 120000, cat: 'analyzers', img: 'img/kalibr-cut.png', badge: null, desc: 'Прецизионная калибровка 0–600 бар, класс точности 0.025', specGas: 'Давление', specRange: '0–600 бар', specOutput: '—', specProtection: '—', specAccuracy: 'Класс точности 0.025' },
  { id: 5, name: 'Датчик CO₂ настенный', price: 12000, cat: 'sensors', img: 'img/datchco2.png', badge: 'new', desc: 'NDIR-сенсор, диапазон 0–5000 ppm, выход 4–20 мА', specGas: 'CO₂ / углекислый газ', specRange: '0–5000 ppm', specOutput: '4–20 мА', specProtection: '—', specAccuracy: 'NDIR-сенсор' },
  { id: 6, name: 'Портативный анализатор О₂', price: 55000, cat: 'analyzers', img: 'img/portanaliz-cut.png', badge: null, desc: 'Экспресс-анализ кислорода 0–25%, IP67, автономная работа 8 ч', specGas: 'O₂ / кислород', specRange: '0–25%', specOutput: 'Автономная работа 8 ч', specProtection: 'IP67', specAccuracy: 'Экспресс-анализ' },
  { id: 7, name: 'Датчик угарного газа СО-24', price: 18000, cat: 'sensors', img: 'img/ugargaz-cut.png', badge: null, desc: 'Контроль CO 0–1000 ppm, звуковая индикация, выход 4–20 мА', specGas: 'CO / угарный газ', specRange: '0–1000 ppm', specOutput: '4–20 мА, звуковая индикация', specProtection: '—', specAccuracy: 'Стационарный контроль' },
  { id: 8, name: 'Стационарный газоанализатор СГК-4', price: 98000, cat: 'analyzers', img: 'img/gazanalizator-cut.png', badge: 'hot', desc: 'Четырехканальный контроль CH₄, CO, O₂ и H₂S, Modbus RTU', specGas: 'CH₄, CO, O₂, H₂S', specRange: '4 канала', specOutput: 'Modbus RTU', specProtection: '—', specAccuracy: 'Стационарный контроль' },
  { id: 9, name: 'Датчик сероводорода H₂S-Pro', price: 32000, cat: 'sensors', img: 'img/serovod-cut.png', badge: 'new', desc: 'Электрохимический сенсор 0–100 ppm, IP66, релейный выход', specGas: 'H₂S / сероводород', specRange: '0–100 ppm', specOutput: 'Релейный выход', specProtection: 'IP66', specAccuracy: 'Электрохимический сенсор' },
  { id: 10, name: 'Портативный течеискатель ТГ-1', price: 39000, cat: 'leak', img: 'img/tg-1-cut.png', badge: null, desc: 'Поиск микропротечек на газопроводах, гибкий зонд, виброотклик', specGas: 'Микропротечки газа', specRange: 'Газопроводы', specOutput: 'Виброотклик', specProtection: '—', specAccuracy: 'Гибкий зонд' },
  { id: 11, name: 'Калибровочный комплект КГС-5', price: 74000, cat: 'analyzers', img: 'img/complect-cut.png', badge: null, desc: 'Редуктор, расходомер и адаптеры для проверки газоанализаторов', specGas: 'Проверка газоанализаторов', specRange: 'Комплект адаптеров', specOutput: 'Редуктор, расходомер', specProtection: '—', specAccuracy: 'Для проверки и настройки' },
  { id: 12, name: 'Датчик пропана C₃H₈-Стандарт', price: 27000, cat: 'sensors', img: 'img/propan-cut.png', badge: null, desc: 'Контроль пропана 0–100% НКПРП, взрывозащищенное исполнение', specGas: 'C₃H₈ / пропан', specRange: '0–100% НКПРП', specOutput: '—', specProtection: 'Взрывозащита', specAccuracy: 'Промышленный датчик' },
  { id: 13, name: 'Портативный анализатор CH₄/O₂', price: 68000, cat: 'analyzers', img: 'img/portanalizator-2-cut.png', badge: 'new', desc: 'Двухгазовый прибор для обходов, память измерений, автономность 10 ч', specGas: 'CH₄ / O₂', specRange: 'Двухгазовый контроль', specOutput: 'Память измерений', specProtection: '—', specAccuracy: 'Автономность 10 ч' },
];

function productFromRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    price: Number(row.price),
    cat: row.cat,
    img: row.img || '',
    badge: row.badge || null,
    desc: row.description || row.desc || '',
    specGas: row.spec_gas || '',
    specRange: row.spec_range || '',
    specOutput: row.spec_output || '',
    specProtection: row.spec_protection || '',
    specAccuracy: row.spec_accuracy || '',
    isActive: row.is_active !== 0,
  };
}

async function getProducts({ includeInactive = false } = {}) {
  let sql = 'SELECT * FROM products';
  if (!includeInactive) sql += ' WHERE is_active=1';
  sql += ' ORDER BY id ASC';
  const rows = await getAll(sql);
  return rows.map(productFromRow);
}

async function getProduct(id) {
  const row = await getRow('SELECT * FROM products WHERE id=? AND is_active=1', [Number(id)]);
  return productFromRow(row);
}

/* ===================== CART HELPERS ===================== */
async function dbGetCart(userId) {
  const row = await getRow('SELECT items_json FROM carts WHERE user_id=?', [userId]);
  if (!row) return [];
  try { return JSON.parse(row.items_json); } catch { return []; }
}

async function dbSetCart(userId, items) {
  const json = JSON.stringify(items);
  const now = Date.now();
  await run(`
    INSERT INTO carts (user_id, items_json, updated_at) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE items_json=VALUES(items_json), updated_at=VALUES(updated_at)
  `, [userId, json, now]);
}

function normalizeAccountType(value, company = '') {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'person' || type === 'legal') return type;
  const name = String(company || '').trim().toLowerCase();
  if (/^(ооо|ао|пао|зао|ип)\b|company|llc|ltd/.test(name)) return 'legal';
  return name ? 'person' : 'legal';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidRuPhone(value) {
  const digits = phoneDigits(value);
  return digits.length === 11 && digits.startsWith('7');
}

function cleanText(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function validateProductInput(body, { partial = false } = {}) {
  const product = {
    name: cleanText(body.name, 255),
    price: Number(body.price),
    cat: cleanText(body.cat, 50),
    img: cleanText(body.img, 255),
    badge: cleanText(body.badge, 20) || null,
    desc: cleanText(body.desc ?? body.description, 1000),
    specGas: cleanText(body.specGas, 255),
    specRange: cleanText(body.specRange, 255),
    specOutput: cleanText(body.specOutput, 255),
    specProtection: cleanText(body.specProtection, 255),
    specAccuracy: cleanText(body.specAccuracy, 255),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
  const allowedCats = ['sensors', 'analyzers', 'leak'];
  const allowedBadges = [null, 'new', 'hot'];

  if (!partial || product.name) {
    if (product.name.length < 3) return { error: 'invalid_name' };
  }
  if (!partial || body.price !== undefined) {
    if (!Number.isInteger(product.price) || product.price < 1 || product.price > 10000000) return { error: 'invalid_price' };
  }
  if (!partial || product.cat) {
    if (!allowedCats.includes(product.cat)) return { error: 'invalid_category' };
  }
  if (!partial || product.desc) {
    if (product.desc.length < 10) return { error: 'invalid_description' };
  }
  if (!product.specGas || !product.specRange || !product.specOutput || !product.specProtection || !product.specAccuracy) {
    return { error: 'missing_specs' };
  }
  if (!allowedBadges.includes(product.badge)) return { error: 'invalid_badge' };
  return { product };
}

function imageExtensionFromMime(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[String(mime || '').toLowerCase()] || null;
}

async function seedDefaultProducts() {
  const { n } = await getRow('SELECT COUNT(*) as n FROM products');
  if (Number(n) > 0) return;

  for (const p of PRODUCTS) {
    await run(
      'INSERT INTO products (id, name, price, cat, img, badge, description, spec_gas, spec_range, spec_output, spec_protection, spec_accuracy, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [p.id, p.name, p.price, p.cat, p.img || '', p.badge || null, p.desc || '', p.specGas || '', p.specRange || '', p.specOutput || '', p.specProtection || '', p.specAccuracy || '', 1, Date.now(), Date.now()]
    );
  }
}

async function seedProductSpecs() {
  for (const p of PRODUCTS) {
    await run(`
      UPDATE products
      SET spec_gas=IF(COALESCE(spec_gas,'')='',?,spec_gas),
          spec_range=IF(COALESCE(spec_range,'')='',?,spec_range),
          spec_output=IF(COALESCE(spec_output,'')='',?,spec_output),
          spec_protection=IF(COALESCE(spec_protection,'')='',?,spec_protection),
          spec_accuracy=IF(COALESCE(spec_accuracy,'')='',?,spec_accuracy)
      WHERE id=?
    `, [p.specGas || '', p.specRange || '', p.specOutput || '', p.specProtection || '', p.specAccuracy || '', p.id]);
  }
}

/* ===================== INIT DEMO USERS ===================== */
async function upsertUser(email, password, company, isAdmin) {
  const row = await getRow('SELECT id FROM users WHERE email=?', [email]);
  const hash = hashPassword(password);
  if (row) {
    await run('UPDATE users SET password_hash=?, company=?, account_type=?, is_admin=? WHERE id=?',
      [hash, company, 'legal', isAdmin, row.id]);
    return row.id;
  }
  const result = await run(
    'INSERT INTO users (email, password_hash, company, account_type, is_admin, created_at) VALUES (?,?,?,?,?,?)',
    [email, hash, company, 'legal', isAdmin, Date.now()]
  );
  return result.insertId;
}

/* ===================== APP + MIDDLEWARE ===================== */
const app = express();

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(session({
  name: 'gtsid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use(express.static(ROOT));

/* ── Auth middleware ── */
function getUserId(req) { return req.session?.userId || null; }

function requireAuth(req, res, next) {
  if (!getUserId(req)) return res.status(401).json({ ok: false, error: 'not_authenticated' });
  next();
}

async function requireAdmin(req, res, next) {
  const uid = getUserId(req);
  const u = await getRow('SELECT is_admin FROM users WHERE id=?', [uid]);
  if (!u?.is_admin) return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    company: row.company || '',
    accountType: normalizeAccountType(row.account_type, row.company),
    contactName: row.contact_name || '',
    phone: row.phone || '',
    address: row.address || '',
    isAdmin: !!row.is_admin,
    createdAt: row.created_at,
  };
}

/* ===================== AUTH ROUTES ===================== */

app.get('/api/me', async (req, res) => {
  const uid = getUserId(req);
  if (!uid) return res.json({ ok: true, user: null });
  const user = await getRow(
    'SELECT id, email, company, account_type, contact_name, phone, address, is_admin, created_at FROM users WHERE id=?',
    [uid]
  );
  if (!user) return res.json({ ok: true, user: null });
  const accountType = normalizeAccountType(user.account_type, user.company);
  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      company: user.company,
      accountType,
      contactName: user.contact_name || '',
      phone: user.phone,
      address: user.address || '',
      isAdmin: !!user.is_admin,
      createdAt: user.created_at,
    },
  });
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const guestCart = Array.isArray(req.body.guestCart) ? req.body.guestCart : [];

  const user = await getRow('SELECT * FROM users WHERE email=?', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  req.session.userId = user.id;

  if (guestCart.length > 0) {
    const serverCart = await dbGetCart(user.id);
    for (const gi of guestCart) {
      const p = await getProduct(gi.id);
      if (!p) continue;
      const existing = serverCart.find(i => i.id === gi.id);
      if (existing) existing.qty += Number(gi.qty) || 1;
      else serverCart.push({ id: p.id, name: p.name, price: p.price, img: p.img, qty: Number(gi.qty) || 1 });
    }
    await dbSetCart(user.id, serverCart);
  }

  res.json({
    ok: true,
    user: {
      email: user.email,
      company: user.company,
      accountType: normalizeAccountType(user.account_type, user.company),
      contactName: user.contact_name || '',
      isAdmin: !!user.is_admin
    }
  });
});

app.post('/api/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const company = String(req.body.company || '').trim();
  const accountType = normalizeAccountType(req.body.accountType, company);
  const contactName = String(req.body.contactName || '').trim();
  const phone = formatRuPhone(req.body.phone);
  const guestCart = Array.isArray(req.body.guestCart) ? req.body.guestCart : [];

  if (!email || !password) return res.status(400).json({ ok: false, error: 'missing_fields' });
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'weak_password' });
  if (!company || company.length < 2) return res.status(400).json({ ok: false, error: 'invalid_name' });
  if (!isValidRuPhone(phone)) return res.status(400).json({ ok: false, error: 'invalid_phone' });

  const existing = await getRow('SELECT id FROM users WHERE email=?', [email]);
  if (existing) return res.status(409).json({ ok: false, error: 'email_taken' });

  const hash = hashPassword(password);
  const result = await run(
    'INSERT INTO users (email, password_hash, company, account_type, contact_name, phone, is_admin, created_at) VALUES (?,?,?,?,?,?,0,?)',
    [email, hash, company, accountType, contactName, phone, Date.now()]
  );
  const userId = result.insertId;
  req.session.userId = userId;

  if (guestCart.length > 0) {
    const items = [];
    for (const gi of guestCart) {
      const p = await getProduct(gi.id);
      if (p) items.push({ id: p.id, name: p.name, price: p.price, img: p.img, qty: Number(gi.qty) || 1 });
    }
    if (items.length) await dbSetCart(userId, items);
  }

  res.json({ ok: true, user: { email, company, accountType, contactName, phone, isAdmin: false } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/password-reset-requests', async (req, res) => {
  const email = cleanText(req.body.email, 255).toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });

  const user = await getRow('SELECT id, company FROM users WHERE email=?', [email]);
  if (user) {
    const now = Date.now();
    const recent = await getRow(
      "SELECT id FROM password_reset_requests WHERE email=? AND status='new' AND created_at>?",
      [email, now - 24 * 60 * 60 * 1000]
    );
    if (!recent) {
      await run(
        'INSERT INTO password_reset_requests (user_id, email, company, status, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        [user.id, email, user.company || '', 'new', now, now]
      );
    }
  }

  res.json({
    ok: true,
    message: 'Если аккаунт найден, администратор свяжется с вами для восстановления доступа.'
  });
});

/* ===================== PRODUCTS ===================== */
app.get('/api/products', async (req, res) => {
  const products = await getProducts();
  res.json({ ok: true, products });
});

/* ===================== PROFILE ===================== */
app.put('/api/profile', requireAuth, async (req, res) => {
  const uid = getUserId(req);
  const company = String(req.body.company || '').trim();
  const phone = formatRuPhone(req.body.phone);
  const address = String(req.body.address || '').trim();
  if (!company || company.length < 2) return res.status(400).json({ ok: false, error: 'invalid_name' });
  if (phone && !isValidRuPhone(phone)) return res.status(400).json({ ok: false, error: 'invalid_phone' });
  if (address.length > 500) return res.status(400).json({ ok: false, error: 'invalid_address' });
  await run('UPDATE users SET company=?, phone=?, address=? WHERE id=?', [company, phone, address, uid]);
  res.json({ ok: true });
});

app.put('/api/profile/password', requireAuth, async (req, res) => {
  const uid = getUserId(req);
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');

  if (next.length < 6) return res.status(400).json({ ok: false, error: 'weak_password' });

  const user = await getRow('SELECT password_hash FROM users WHERE id=?', [uid]);
  if (!user || !verifyPassword(current, user.password_hash)) {
    return res.status(401).json({ ok: false, error: 'invalid_password' });
  }

  await run('UPDATE users SET password_hash=? WHERE id=?', [hashPassword(next), uid]);
  res.json({ ok: true });
});

/* ===================== CART ===================== */
app.get('/api/cart', requireAuth, async (req, res) => {
  const items = await dbGetCart(getUserId(req));
  res.json({ ok: true, items });
});

app.put('/api/cart', requireAuth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  await dbSetCart(getUserId(req), items);
  res.json({ ok: true, items });
});

app.post('/api/cart/add', requireAuth, async (req, res) => {
  const uid = getUserId(req);
  const id = Number(req.body.id);
  const delta = Number(req.body.delta) || 1;
  const p = await getProduct(id);
  if (!p) return res.status(404).json({ ok: false, error: 'product_not_found' });

  const items = await dbGetCart(uid);
  const existing = items.find(i => i.id === id);
  if (existing) {
    existing.qty += delta;
    if (existing.qty <= 0) items.splice(items.indexOf(existing), 1);
  } else if (delta > 0) {
    items.push({ id: p.id, name: p.name, price: p.price, img: p.img, qty: delta });
  }

  await dbSetCart(uid, items);
  res.json({ ok: true, items });
});

/* ===================== ORDERS ===================== */
app.get('/api/orders', requireAuth, async (req, res) => {
  const uid = getUserId(req);
  const orders = await getAll(
    'SELECT id, status, total, comment, created_at FROM orders WHERE user_id=? ORDER BY created_at DESC',
    [uid]
  );
  for (const o of orders) {
    o.items = await getAll('SELECT * FROM order_items WHERE order_id=?', [o.id]);
  }
  res.json({ ok: true, orders });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const uid = getUserId(req);
  const comment = String(req.body.comment || '').trim();
  const phone = formatRuPhone(req.body.phone);
  const address = String(req.body.address || '').trim();
  const delivery = String(req.body.delivery || '').trim();
  const cartItems = await dbGetCart(uid);

  if (!cartItems.length) return res.status(400).json({ ok: false, error: 'cart_empty' });
  if (!isValidRuPhone(phone)) return res.status(400).json({ ok: false, error: 'invalid_phone' });
  if (address.length < 5 || address.length > 500) return res.status(400).json({ ok: false, error: 'invalid_address' });
  if (!['Курьер по Оренбургу', 'Транспортная компания', 'Самовывоз (Оренбург)'].includes(delivery)) return res.status(400).json({ ok: false, error: 'invalid_delivery' });
  if (comment.length > 1000) return res.status(400).json({ ok: false, error: 'invalid_comment' });

  const parts = [];
  if (delivery) parts.push(`Способ доставки: ${delivery}`);
  if (phone) parts.push(`Телефон: ${phone}`);
  if (address) parts.push(`Адрес: ${address}`);
  if (comment) parts.push(`Комментарий: ${comment}`);
  const fullComment = parts.join('\n');

  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const now = Date.now();

  const orderResult = await run(
    'INSERT INTO orders (user_id, status, total, comment, created_at, updated_at) VALUES (?,?,?,?,?,?)',
    [uid, 'new', total, fullComment, now, now]
  );
  const orderId = orderResult.insertId;

  for (const item of cartItems) {
    await run(
      'INSERT INTO order_items (order_id, product_id, name, price, qty, img) VALUES (?,?,?,?,?,?)',
      [orderId, item.id, item.name, item.price, item.qty, item.img || '']
    );
  }

  await dbSetCart(uid, []);
  res.json({ ok: true, orderId });
});

/* ===================== CONTACT REQUESTS ===================== */
app.post('/api/contact-requests', async (req, res) => {
  const name = cleanText(req.body.name, 255);
  const phone = formatRuPhone(req.body.phone);
  const topic = cleanText(req.body.topic, 100);
  const company = cleanText(req.body.company, 255);
  const message = cleanText(req.body.message, 2000);
  const allowedTopics = ['Подбор оборудования', 'Сервис и поддержка', 'Доставка и оплата', 'Документы', 'Другое'];

  if (!name || !phone || !topic || !message) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ ok: false, error: 'invalid_name' });
  }
  if (!allowedTopics.includes(topic)) {
    return res.status(400).json({ ok: false, error: 'invalid_topic' });
  }
  if (!isValidRuPhone(phone)) {
    return res.status(400).json({ ok: false, error: 'invalid_phone' });
  }
  if (message.length < 10 || message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'invalid_message' });
  }

  const now = Date.now();
  const result = await run(
    'INSERT INTO contact_requests (name, phone, topic, company, message, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
    [name, phone, topic, company, message, 'new', now, now]
  );
  res.json({ ok: true, requestId: result.insertId });
});

/* ===================== ADMIN ROUTES ===================== */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const { n: totalUsers } = await getRow('SELECT COUNT(*) as n FROM users WHERE is_admin=0');
  const { n: totalOrders } = await getRow('SELECT COUNT(*) as n FROM orders');
  const { n: totalRev } = await getRow("SELECT COALESCE(SUM(total),0) as n FROM orders WHERE status != 'cancelled'");
  const { n: newOrders } = await getRow("SELECT COUNT(*) as n FROM orders WHERE status='new'");
  const { n: newPasswordRequests } = await getRow("SELECT COUNT(*) as n FROM password_reset_requests WHERE status='new'");

  const byStatus = await getAll('SELECT status, COUNT(*) as cnt, COALESCE(SUM(total),0) as rev FROM orders GROUP BY status');
  const topProducts = await getAll(
    'SELECT name, SUM(qty) as qty, SUM(qty) as total_qty, SUM(price*qty) as revenue, SUM(price*qty) as total_rev FROM order_items GROUP BY product_id, name ORDER BY qty DESC LIMIT 5'
  );
  const recentOrders = await getAll(`
    SELECT o.id, o.status, o.total, o.created_at,
           COALESCE(u.email, 'Удаленный пользователь') as email,
           COALESCE(u.company, '') as company
    FROM orders o LEFT JOIN users u ON u.id=o.user_id
    ORDER BY o.created_at DESC LIMIT 10
  `);

  res.json({ ok: true, totalUsers, totalOrders, totalRev, newOrders, newPasswordRequests, byStatus, topProducts, recentOrders });
});

app.get('/api/admin/notifications', requireAdmin, async (req, res) => {
  const since = Number(req.query.since || 0);
  const [orders, requests, passwordRequests] = await Promise.all([
    getAll(`
      SELECT o.id, o.total, o.created_at,
             COALESCE(u.email, 'Удаленный пользователь') as email,
             COALESCE(u.company, '') as company
      FROM orders o
      LEFT JOIN users u ON u.id=o.user_id
      WHERE o.created_at>?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [since]),
    getAll('SELECT id, name, topic, created_at FROM contact_requests WHERE created_at>? ORDER BY created_at DESC LIMIT 10', [since]),
    getAll('SELECT id, email, company, created_at FROM password_reset_requests WHERE created_at>? ORDER BY created_at DESC LIMIT 10', [since]),
  ]);
  const { n: newOrders } = await getRow("SELECT COUNT(*) as n FROM orders WHERE status='new'");
  const { n: newRequests } = await getRow("SELECT COUNT(*) as n FROM contact_requests WHERE status='new'");
  const { n: newPasswordRequests } = await getRow("SELECT COUNT(*) as n FROM password_reset_requests WHERE status='new'");
  res.json({ ok: true, now: Date.now(), counts: { newOrders, newRequests, newPasswordRequests }, orders, requests, passwordRequests });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const status = req.query.status || 'all';
  const search = `%${req.query.search || ''}%`;

  let sql = "SELECT o.id, o.status, o.total, o.comment, o.created_at, o.updated_at, COALESCE(u.email, 'Удаленный пользователь') as email, COALESCE(u.company, '') as company FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE (COALESCE(u.email, '') LIKE ? OR COALESCE(u.company, '') LIKE ?)";
  const params = [search, search];

  if (status !== 'all') { sql += ' AND o.status=?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC';

  const orders = await getAll(sql, params);
  for (const o of orders) {
    o.items = await getAll('SELECT * FROM order_items WHERE order_id=?', [o.id]);
  }
  res.json({ ok: true, orders, total: orders.length });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  const allowed = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid_status' });
  await run('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, Date.now(), id]);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const search = `%${req.query.search || ''}%`;
  const users = await getAll(`
    SELECT u.id, u.email, u.company, u.phone, u.address, u.account_type, u.contact_name, u.is_admin, u.created_at,
           COUNT(o.id) as order_count, COALESCE(SUM(o.total),0) as total_spent
    FROM users u
    LEFT JOIN orders o ON o.user_id=u.id
    WHERE (u.email LIKE ? OR u.company LIKE ?)
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `, [search, search]);
  res.json({
    ok: true,
    users: users.map(u => ({ ...u, orders: u.order_count, spent: u.total_spent })),
    total: users.length
  });
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const adminId = getUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: 'invalid_id' });

  const existing = await getRow('SELECT * FROM users WHERE id=?', [id]);
  if (!existing) return res.status(404).json({ ok: false, error: 'user_not_found' });

  const company = cleanText(req.body.company, 255);
  const phone = formatRuPhone(req.body.phone);
  const address = cleanText(req.body.address, 500);
  const contactName = cleanText(req.body.contactName, 255);
  const accountType = normalizeAccountType(req.body.accountType, company);
  const isAdmin = id === adminId ? 1 : (req.body.isAdmin ? 1 : 0);
  const newPassword = String(req.body.newPassword || '');

  if (!company || company.length < 2) return res.status(400).json({ ok: false, error: 'invalid_name' });
  if (phone && !isValidRuPhone(phone)) return res.status(400).json({ ok: false, error: 'invalid_phone' });
  if (newPassword && newPassword.length < 6) return res.status(400).json({ ok: false, error: 'weak_password' });

  if (newPassword) {
    await run(
      'UPDATE users SET company=?, phone=?, address=?, contact_name=?, account_type=?, is_admin=?, password_hash=? WHERE id=?',
      [company, phone, address, contactName, accountType, isAdmin, hashPassword(newPassword), id]
    );
  } else {
    await run(
      'UPDATE users SET company=?, phone=?, address=?, contact_name=?, account_type=?, is_admin=? WHERE id=?',
      [company, phone, address, contactName, accountType, isAdmin, id]
    );
  }
  const saved = await getRow('SELECT * FROM users WHERE id=?', [id]);
  res.json({ ok: true, user: publicUser(saved) });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const adminId = getUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: 'invalid_id' });
  if (id === adminId) return res.status(400).json({ ok: false, error: 'cannot_delete_self' });

  const existing = await getRow('SELECT is_admin FROM users WHERE id=?', [id]);
  if (!existing) return res.status(404).json({ ok: false, error: 'user_not_found' });
  if (existing.is_admin) return res.status(400).json({ ok: false, error: 'cannot_delete_admin' });

  await run('DELETE FROM carts WHERE user_id=?', [id]);
  await run('UPDATE password_reset_requests SET user_id=NULL WHERE user_id=?', [id]);
  await run('DELETE FROM users WHERE id=?', [id]);
  res.json({ ok: true });
});

app.get('/api/admin/password-reset-requests', requireAdmin, async (req, res) => {
  const status = req.query.status || 'all';
  let sql = `
    SELECT r.*, u.phone
    FROM password_reset_requests r
    LEFT JOIN users u ON u.id=r.user_id
    WHERE (r.email LIKE ? OR r.company LIKE ?)
  `;
  const search = `%${req.query.search || ''}%`;
  const params = [search, search];
  if (status !== 'all') {
    sql += ' AND r.status=?';
    params.push(status);
  }
  sql += ' ORDER BY r.created_at DESC';
  const requests = await getAll(sql, params);
  res.json({ ok: true, requests, total: requests.length });
});

app.patch('/api/admin/password-reset-requests/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  const allowed = ['new', 'done'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid_status' });
  const result = await run('UPDATE password_reset_requests SET status=?, updated_at=? WHERE id=?', [status, Date.now(), id]);
  if (!result.affectedRows) return res.status(404).json({ ok: false, error: 'request_not_found' });
  res.json({ ok: true });
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const stats = await getAll('SELECT product_id, SUM(qty) as qty_sold, SUM(price*qty) as revenue FROM order_items GROUP BY product_id');
  const statsMap = Object.fromEntries(stats.map(s => [s.product_id, s]));
  const products = (await getProducts({ includeInactive: true })).map(p => ({
    ...p,
    qty_sold: statsMap[p.id]?.qty_sold || 0,
    revenue: statsMap[p.id]?.revenue || 0,
  }));
  res.json({ ok: true, products });
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const { product, error } = validateProductInput(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const now = Date.now();
  const result = await run(
    'INSERT INTO products (name, price, cat, img, badge, description, spec_gas, spec_range, spec_output, spec_protection, spec_accuracy, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [product.name, product.price, product.cat, product.img, product.badge, product.desc, product.specGas, product.specRange, product.specOutput, product.specProtection, product.specAccuracy, product.isActive ? 1 : 0, now, now]
  );
  const saved = await getRow('SELECT * FROM products WHERE id=?', [result.insertId]);
  res.json({ ok: true, product: productFromRow(saved) });
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: 'invalid_id' });

  const existing = await getRow('SELECT id FROM products WHERE id=?', [id]);
  if (!existing) return res.status(404).json({ ok: false, error: 'product_not_found' });

  const { product, error } = validateProductInput(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  await run(
    'UPDATE products SET name=?, price=?, cat=?, img=?, badge=?, description=?, spec_gas=?, spec_range=?, spec_output=?, spec_protection=?, spec_accuracy=?, is_active=?, updated_at=? WHERE id=?',
    [product.name, product.price, product.cat, product.img, product.badge, product.desc, product.specGas, product.specRange, product.specOutput, product.specProtection, product.specAccuracy, product.isActive ? 1 : 0, Date.now(), id]
  );
  const saved = await getRow('SELECT * FROM products WHERE id=?', [id]);
  res.json({ ok: true, product: productFromRow(saved) });
});

app.patch('/api/admin/products/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const isActive = Boolean(req.body.isActive);
  const result = await run('UPDATE products SET is_active=?, updated_at=? WHERE id=?', [isActive ? 1 : 0, Date.now(), id]);
  if (!result.affectedRows) return res.status(404).json({ ok: false, error: 'product_not_found' });
  res.json({ ok: true });
});

app.post('/api/admin/product-images', requireAdmin, async (req, res) => {
  const fileName = cleanText(req.body.fileName, 180);
  const mime = cleanText(req.body.mime, 80);
  const dataUrl = String(req.body.dataUrl || '');
  const ext = imageExtensionFromMime(mime);

  if (!ext || !dataUrl.startsWith(`data:${mime};base64,`)) {
    return res.status(400).json({ ok: false, error: 'invalid_image' });
  }

  const base64 = dataUrl.split(',')[1] || '';
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'image_too_large' });
  }

  const original = path.parse(fileName).name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'product';
  const savedName = `${original}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const uploadDir = path.join(ROOT, 'img', 'uploaded');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, savedName), buffer);

  res.json({ ok: true, path: `img/uploaded/${savedName}` });
});

app.get('/api/admin/contact-requests', requireAdmin, async (req, res) => {
  const status = req.query.status || 'all';
  const search = `%${req.query.search || ''}%`;
  let sql = 'SELECT * FROM contact_requests WHERE (name LIKE ? OR phone LIKE ? OR company LIKE ? OR topic LIKE ?)';
  const params = [search, search, search, search];

  if (status !== 'all') {
    sql += ' AND status=?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const requests = await getAll(sql, params);
  res.json({ ok: true, requests, total: requests.length });
});

app.patch('/api/admin/contact-requests/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  const allowed = ['new', 'done'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid_status' });
  await run('UPDATE contact_requests SET status=?, updated_at=? WHERE id=?', [status, Date.now(), id]);
  res.json({ ok: true });
});

app.get('/api', (req, res) => res.json({ ok: true, name: 'Газпроект Сервис Автоматика API' }));

/* ===================== START ===================== */
async function start() {
  // Проверка подключения к MySQL
  try {
    await pool.execute('SELECT 1');
    console.log('✅ MySQL подключён');
  } catch (err) {
    console.error('❌ Не удалось подключиться к MySQL:', err.message);
    console.error('   Убедитесь что XAMPP запущен и БД gastech создана.');
    process.exit(1);
  }

  // Создаём таблицы если не существуют
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      company       VARCHAR(255),
      account_type  VARCHAR(20) NOT NULL DEFAULT 'legal',
      contact_name  VARCHAR(255) DEFAULT '',
      phone         VARCHAR(50),
      address       VARCHAR(500) DEFAULT '',
      is_admin      TINYINT NOT NULL DEFAULT 0,
      created_at    BIGINT  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.execute('ALTER TABLE users ADD COLUMN address VARCHAR(500) DEFAULT ""');
  } catch { /* column already exists */ }
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT "legal"');
  } catch { /* column already exists */ }
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN contact_name VARCHAR(255) DEFAULT ""');
  } catch { /* column already exists */ }
  try {
    await pool.execute(`
      UPDATE users
      SET account_type='person'
      WHERE account_type='legal'
        AND COALESCE(company, '') <> ''
        AND LOWER(company) NOT REGEXP '^(ооо|ао|пао|зао|ип)[[:space:]]|company|llc|ltd'
    `);
  } catch { /* best-effort old account cleanup */ }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS carts (
      user_id    INT PRIMARY KEY,
      items_json MEDIUMTEXT NOT NULL,
      updated_at BIGINT     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT    NOT NULL,
      status     VARCHAR(50) NOT NULL DEFAULT 'new',
      total      INT    NOT NULL DEFAULT 0,
      comment    TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      order_id   INT  NOT NULL,
      product_id INT  NOT NULL,
      name       VARCHAR(255) NOT NULL,
      price      INT  NOT NULL,
      qty        INT  NOT NULL,
      img        VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS contact_requests (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      phone      VARCHAR(50)  NOT NULL,
      topic      VARCHAR(100) NOT NULL,
      company    VARCHAR(255) DEFAULT '',
      message    TEXT         NOT NULL,
      status     VARCHAR(50)  NOT NULL DEFAULT 'new',
      created_at BIGINT       NOT NULL,
      updated_at BIGINT       NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NULL,
      email      VARCHAR(255) NOT NULL,
      company    VARCHAR(255) DEFAULT '',
      status     VARCHAR(50)  NOT NULL DEFAULT 'new',
      created_at BIGINT       NOT NULL,
      updated_at BIGINT       NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      price       INT NOT NULL,
      cat         VARCHAR(50) NOT NULL,
      img         VARCHAR(255) DEFAULT '',
      badge       VARCHAR(20) DEFAULT NULL,
      description TEXT NOT NULL,
      spec_gas    VARCHAR(255) DEFAULT '',
      spec_range  VARCHAR(255) DEFAULT '',
      spec_output VARCHAR(255) DEFAULT '',
      spec_protection VARCHAR(255) DEFAULT '',
      spec_accuracy VARCHAR(255) DEFAULT '',
      is_active   TINYINT NOT NULL DEFAULT 1,
      created_at  BIGINT NOT NULL,
      updated_at  BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  for (const [column, sql] of [
    ['spec_gas', 'ALTER TABLE products ADD COLUMN spec_gas VARCHAR(255) DEFAULT ""'],
    ['spec_range', 'ALTER TABLE products ADD COLUMN spec_range VARCHAR(255) DEFAULT ""'],
    ['spec_output', 'ALTER TABLE products ADD COLUMN spec_output VARCHAR(255) DEFAULT ""'],
    ['spec_protection', 'ALTER TABLE products ADD COLUMN spec_protection VARCHAR(255) DEFAULT ""'],
    ['spec_accuracy', 'ALTER TABLE products ADD COLUMN spec_accuracy VARCHAR(255) DEFAULT ""'],
  ]) {
    try { await pool.execute(sql); } catch { /* column already exists */ }
  }

  await seedDefaultProducts();
  await seedProductSpecs();

  // Демо-пользователи
  await upsertUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_COMPANY, 0);
  await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'ООО «Газпроект Сервис Автоматика»', 1);

  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log(`demo:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  });
}

start();
