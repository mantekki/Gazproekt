// ─── PRODUCT DATA ───────────────────────────────────────────────
let products = [
    { id: 1, name: 'Датчик метана СН4-Про', price: 25000, cat: 'sensors', img: 'img/ch4pro-cut.png', badge: 'new', desc: 'Электрохимический сенсор, диапазон 0–5% НКПРП, выход 4–20 мА' },
    { id: 2, name: 'Газоанализатор ГАН-12', price: 85000, cat: 'analyzers', img: 'img/gazanaliz-cut.png', badge: 'hot', desc: 'Мультигазовый анализатор, 4 канала, RS-485, IP65' },
    { id: 3, name: 'Ультразвуковой течеискатель', price: 42000, cat: 'leak', img: 'img/techisk-cut.png', badge: null, desc: 'Обнаружение утечек газа и пара, диапазон 20–100 кГц' },
    { id: 4, name: 'Калибратор давления КП-2', price: 120000, cat: 'analyzers', img: 'img/kalibr-cut.png', badge: null, desc: 'Прецизионная калибровка 0–600 бар, класс точности 0.025' },
    { id: 5, name: 'Датчик CO₂ настенный', price: 12000, cat: 'sensors', img: 'img/datchco2.png', badge: 'new', desc: 'NDIR-сенсор, диапазон 0–5000 ppm, выход 4–20 мА' },
    { id: 6, name: 'Портативный анализатор О₂', price: 55000, cat: 'analyzers', img: 'img/portanaliz-cut.png', badge: null, desc: 'Экспресс-анализ кислорода 0–25%, IP67, автономная работа 8 ч' },
    { id: 7, name: 'Датчик угарного газа СО-24', price: 18000, cat: 'sensors', img: 'img/ugargaz-cut.png', badge: null, desc: 'Контроль CO 0–1000 ppm, звуковая индикация, выход 4–20 мА' },
    { id: 8, name: 'Стационарный газоанализатор СГК-4', price: 98000, cat: 'analyzers', img: 'img/gazanalizator-cut.png', badge: 'hot', desc: 'Четырехканальный контроль CH₄, CO, O₂ и H₂S, Modbus RTU' },
    { id: 9, name: 'Датчик сероводорода H₂S-Pro', price: 32000, cat: 'sensors', img: 'img/serovod-cut.png', badge: 'new', desc: 'Электрохимический сенсор 0–100 ppm, IP66, релейный выход' },
    { id: 10, name: 'Портативный течеискатель ТГ-1', price: 39000, cat: 'leak', img: 'img/tg-1-cut.png', badge: null, desc: 'Поиск микропротечек на газопроводах, гибкий зонд, виброотклик' },
    { id: 11, name: 'Калибровочный комплект КГС-5', price: 74000, cat: 'analyzers', img: 'img/complect-cut.png', badge: null, desc: 'Редуктор, расходомер и адаптеры для проверки газоанализаторов' },
    { id: 12, name: 'Датчик пропана C₃H₈-Стандарт', price: 27000, cat: 'sensors', img: 'img/propan-cut.png', badge: null, desc: 'Контроль пропана 0–100% НКПРП, взрывозащищенное исполнение' },
    { id: 13, name: 'Портативный анализатор CH₄/O₂', price: 68000, cat: 'analyzers', img: 'img/portanalizator-2-cut.png', badge: 'new', desc: 'Двухгазовый прибор для обходов, память измерений, автономность 10 ч' },
];

const catLabels = { sensors: 'Датчик', analyzers: 'Анализатор', leak: 'Течеискатель' };
const COMPARE_KEY = 'gt_compare_products';

// ─── API / SESSION (SERVER + SQLITE) ─────────────────────────────
const CART_GUEST_KEY = 'gt_cart_guest';

let meUser = null; // { email, company } | null

async function apiFetch(path, options = {}) { 
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });

    let data = null;
    try { data = await res.json(); }
    catch { data = null; }

    if (!res.ok) {
        const err = new Error((data && data.error) ? String(data.error) : `http_${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
}

function isValidPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('7');
}

function isStrongEnoughPassword(value) {
    return String(value || '').length >= 6;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getProductById(id) {
    return products.find(p => Number(p.id) === Number(id)) || null;
}

function setFieldInvalid(input, invalid = true) {
    if (!input) return;
    input.style.borderColor = invalid ? '#ef4444' : '';
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

function clearFormInvalidState(form) {
    form?.querySelectorAll('[aria-invalid="true"]').forEach(el => setFieldInvalid(el, false));
}

async function loadProductsFromApi() {
    try {
        const data = await apiFetch('/api/products');
        if (Array.isArray(data.products) && data.products.length) {
            products = data.products.map(p => ({
                ...p,
                price: Number(p.price) || 0,
                desc: p.desc || p.description || '',
            }));
        }
    } catch {
        // Static fallback keeps the site usable when opened without the server.
    }
}

function loadGuestCart() {
    try { return JSON.parse(localStorage.getItem(CART_GUEST_KEY) || '[]'); }
    catch { return []; }
}

function saveGuestCart(items) {
    localStorage.setItem(CART_GUEST_KEY, JSON.stringify(items));
}

function clearGuestCart() {
    localStorage.removeItem(CART_GUEST_KEY);
}

function isAuthed() {
    return Boolean(meUser?.email);
}

function updateAuthUI() {
    const btn = document.getElementById('openAuth');
    if (!btn) return;

    if (isAuthed()) {
        const label = meUser.company || meUser.email;
        const short = label.length > 22 ? `${label.slice(0, 20)}…` : label;
        btn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${short}`;
        btn.dataset.authed = '1';
        btn.title = label;
    } else {
        btn.innerHTML = `<i class="fa-solid fa-user"></i> Войти`;
        btn.dataset.authed = '0';
        btn.title = '';
    }
}

function formatRuPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits || digits === '7') return '';
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
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

function initPhoneMasks(root = document) {
    root.querySelectorAll('input[type="tel"], input[data-phone-mask]').forEach(input => {
        if (input.dataset.phoneMaskInited) return;
        input.dataset.phoneMaskInited = '1';
        input.inputMode = 'tel';
        input.autocomplete = input.autocomplete || 'tel';
        input.placeholder = '+7 (___) ___ __-__';

        const applyMask = () => {
            input.value = formatRuPhone(input.value);
        };
        const setCaretAfterDigits = (digitCount) => {
            let seen = 0;
            let pos = input.value.length;
            for (let i = 0; i < input.value.length; i++) {
                if (/\d/.test(input.value[i])) seen++;
                if (seen >= digitCount) {
                    pos = i + 1;
                    break;
                }
            }
            requestAnimationFrame(() => input.setSelectionRange(pos, pos));
        };

        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return;
            if (input.selectionStart !== input.selectionEnd) return;

            const caret = input.selectionStart || 0;
            const digits = input.value.replace(/\D/g, '');
            const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
            let removeIndex = e.key === 'Backspace' ? digitsBeforeCaret - 1 : digitsBeforeCaret;
            if (removeIndex < 0 || removeIndex >= digits.length) return;

            e.preventDefault();
            const nextDigits = digits.slice(0, removeIndex) + digits.slice(removeIndex + 1);
            input.value = formatRuPhone(nextDigits);
            if (!input.value) return;
            setCaretAfterDigits(Math.max(1, removeIndex));
        });
        input.addEventListener('input', applyMask);
        input.addEventListener('blur', () => {
            if (input.value.replace(/\D/g, '').length <= 1) input.value = '';
            else applyMask();
        });
        if (input.value) applyMask();
    });
}
window.formatRuPhone = formatRuPhone;
window.initPhoneMasks = initPhoneMasks;
window.isValidPhone = isValidPhone;

async function refreshMe() {
    try {
        const data = await apiFetch('/api/me');
        meUser = data?.user || null;
    } catch {
        meUser = null;
    }
    updateAuthUI();
}

async function loadCart() {
    if (isAuthed()) {
        try {
            const data = await apiFetch('/api/cart');
            cart = Array.isArray(data.items) ? data.items : [];
        } catch {
            cart = [];
        }
        return;
    }

    cart = loadGuestCart();
}

async function persistGuestCart() {
    if (isAuthed()) return;
    saveGuestCart(cart);
}

async function persistAuthedCart() {
    if (!isAuthed()) return;
    await apiFetch('/api/cart', { method: 'PUT', body: JSON.stringify({ items: cart }) });
}

async function logout() {
    if (!isAuthed()) return;
    try { await apiFetch('/api/logout', { method: 'POST', body: JSON.stringify({}) }); }
    catch { /* ignore */ }

    meUser = null;
    cart = [];
    clearGuestCart();
    updateAuthUI();
    updateCartCount();
    renderCartItems();
    showToast('Вы вышли из аккаунта');
}

// ─── CART STATE ──────────────────────────────────────────────────
let cart = [];

function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('#cart-count').forEach(el => {
        el.textContent = total;
        el.style.transform = 'scale(1.3)';
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
    });
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-cart-shopping"></i><p>Корзина пуста</p></div>';
        updateCartTotal();
        return;
    }
    container.innerHTML = cart.map(item => {
        const isPath = item.img && (item.img.includes('/') || item.img.includes('.'));
        const imgHtml = isPath
            ? `<img src="${item.img}" alt="${item.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="cart-item-fallback" style="display:none;align-items:center;justify-content:center;font-size:22px;">📦</span>`
            : `<span class="cart-item-fallback" style="display:flex;align-items:center;justify-content:center;font-size:22px;">${item.img || '📦'}</span>`;
        return `
        <div class="cart-item" data-id="${item.id}">
            <div class="cart-item-img">${imgHtml}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${(item.price * item.qty).toLocaleString()} ₽</div>
            </div>
            <div class="cart-item-qty">
                <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
                <span class="qty-num">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
            </div>
        </div>`;
    }).join('');
    updateCartTotal();
}

function updateCartTotal() {
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const el = document.getElementById('cartTotal');
    if (el) el.textContent = total.toLocaleString() + ' ₽';
}

async function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    if (isAuthed()) {
        try {
            const data = await apiFetch('/api/cart/add', { method: 'POST', body: JSON.stringify({ id, delta: 1 }) });
            cart = Array.isArray(data.items) ? data.items : [];
        } catch {
            showToast('Не удалось добавить в корзину (проверьте, что сайт открыт через сервер)');
            return;
        }
    } else {
        const existing = cart.find(i => i.id === id);
        if (existing) existing.qty++;
        else cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 });
        await persistGuestCart();
    }

    updateCartCount();
    renderCartItems();
    showToast(`${product.name} добавлен в корзину`);
}

async function changeQty(id, delta) {
    if (isAuthed()) {
        try {
            const data = await apiFetch('/api/cart/add', { method: 'POST', body: JSON.stringify({ id, delta }) });
            cart = Array.isArray(data.items) ? data.items : [];
        } catch {
            showToast('Не удалось обновить корзину');
            return;
        }
    } else {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
        await persistGuestCart();
    }

    updateCartCount();
    renderCartItems();
}

// ─── TOAST ───────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    if (!toast) return;
    if (msgEl) msgEl.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── PRODUCT COMPARE ─────────────────────────────────────────────
function loadCompareIds() {
    try {
        const ids = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]');
        return Array.isArray(ids) ? ids.map(Number).filter(Boolean).slice(0, 4) : [];
    } catch {
        return [];
    }
}

function saveCompareIds(ids) {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, 4)));
}

function compareItems() {
    return loadCompareIds().map(getProductById).filter(Boolean);
}

function parseProductSpecs(product) {
    const text = `${product.name || ''} ${product.desc || ''}`;
    const find = (re) => text.match(re)?.[0] || '—';
    const gases = ['CH₄', 'СН4', 'CO₂', 'CO', 'O₂', 'H₂S', 'C₃H₈', 'пропана', 'метана', 'кислорода', 'угарного газа', 'сероводорода']
        .filter(g => text.toLowerCase().includes(g.toLowerCase()));
    const iface = ['4–20 мА', '4-20 мА', 'RS-485', 'Modbus RTU', 'релейный выход']
        .filter(x => text.toLowerCase().includes(x.toLowerCase()));

    return {
        category: catLabels[product.cat] || product.cat || '—',
        gas: product.specGas || (gases.length ? [...new Set(gases)].join(', ') : 'По назначению'),
        range: product.specRange || find(/0[–-][\d\s.,]+(?:%|ppm|бар|кГц|НКПРП)/i),
        interface: product.specOutput || (iface.length ? [...new Set(iface)].join(', ') : '—'),
        protection: product.specProtection || find(/IP\d{2}|взрывозащит[а-яё]*/i),
        accuracy: product.specAccuracy || '—',
        badge: product.badge === 'new' ? 'Новинка' : product.badge === 'hot' ? 'Популярное' : '—',
    };
}

function isCompared(id) {
    return loadCompareIds().includes(Number(id));
}

function updateCompareButtons() {
    const ids = loadCompareIds();
    document.querySelectorAll('[data-compare-id]').forEach(btn => {
        const active = ids.includes(Number(btn.dataset.compareId));
        btn.classList.toggle('active', active);
        btn.title = active ? 'Убрать из сравнения' : 'Добавить к сравнению';
        btn.innerHTML = active ? '<i class="fa-solid fa-scale-balanced"></i><span>В сравнении</span>' : '<i class="fa-solid fa-scale-balanced"></i><span>Сравнить</span>';
    });
}

function ensureCompareUi() {
    if (document.getElementById('compareBar')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div class="compare-bar" id="compareBar" hidden>
            <div class="compare-bar-info">
                <i class="fa-solid fa-scale-balanced"></i>
                <span id="compareBarText">Выбрано 0 товаров</span>
            </div>
            <div class="compare-bar-actions">
                <button type="button" class="compare-link-btn" id="openCompareBtn">Сравнить</button>
                <button type="button" class="compare-clear-btn" id="clearCompareBtn" title="Очистить"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="compare-modal" id="compareModal" aria-hidden="true">
            <div class="compare-modal-box">
                <div class="compare-modal-head">
                    <div>
                        <h3>Сравнение оборудования</h3>
                        <p>Ключевые параметры выбранных позиций</p>
                    </div>
                    <button type="button" class="compare-modal-close" id="closeCompareBtn">&times;</button>
                </div>
                <div class="compare-table-wrap" id="compareTableWrap"></div>
            </div>
        </div>
    `);
    document.getElementById('openCompareBtn')?.addEventListener('click', openCompareModal);
    document.getElementById('clearCompareBtn')?.addEventListener('click', clearCompare);
    document.getElementById('closeCompareBtn')?.addEventListener('click', closeCompareModal);
    document.getElementById('compareModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('compareModal')) closeCompareModal();
    });
}

function renderCompareBar() {
    ensureCompareUi();
    const storedIds = loadCompareIds();
    const ids = storedIds.filter(id => Boolean(getProductById(id)));
    if (ids.length !== storedIds.length) saveCompareIds(ids);
    const bar = document.getElementById('compareBar');
    const text = document.getElementById('compareBarText');
    if (!bar || !text) return;
    bar.hidden = ids.length === 0;
    text.textContent = ids.length === 1 ? 'Выбран 1 товар' : `Выбрано ${ids.length} товара`;
    document.getElementById('openCompareBtn').disabled = ids.length < 2;
    updateCompareButtons();
}

function toggleCompare(id) {
    id = Number(id);
    const product = getProductById(id);
    if (!product) return;
    let ids = loadCompareIds();
    if (ids.includes(id)) {
        ids = ids.filter(x => x !== id);
        showToast('Товар убран из сравнения');
    } else {
        if (ids.length >= 4) {
            showToast('Можно сравнить до 4 товаров');
            return;
        }
        ids.push(id);
        showToast(`${product.name} добавлен к сравнению`);
    }
    saveCompareIds(ids);
    renderCompareBar();
}

function removeFromCompare(id) {
    saveCompareIds(loadCompareIds().filter(x => x !== Number(id)));
    renderCompareBar();
    renderCompareTable();
}

function clearCompare() {
    saveCompareIds([]);
    closeCompareModal();
    renderCompareBar();
    showToast('Сравнение очищено');
}

function renderCompareTable() {
    const wrap = document.getElementById('compareTableWrap');
    if (!wrap) return;
    const items = compareItems();
    if (items.length < 2) {
        wrap.innerHTML = '<div class="compare-empty"><i class="fa-solid fa-scale-balanced"></i><p>Выберите минимум два товара для сравнения.</p></div>';
        return;
    }

    const rows = [
        ['Категория', p => parseProductSpecs(p).category],
        ['Цена', p => `${Number(p.price).toLocaleString()} ₽`],
        ['Газ / назначение', p => parseProductSpecs(p).gas],
        ['Диапазон', p => parseProductSpecs(p).range],
        ['Интерфейс / выход', p => parseProductSpecs(p).interface],
        ['Защита', p => parseProductSpecs(p).protection],
        ['Точность / особенность', p => parseProductSpecs(p).accuracy],
        ['Метка', p => parseProductSpecs(p).badge],
        ['Описание', p => p.desc || '—'],
    ];

    wrap.innerHTML = `
        <table class="compare-table">
            <thead>
                <tr>
                    <th>Параметр</th>
                    ${items.map(p => `
                        <th>
                            <div class="compare-product-head">
                                <button type="button" class="compare-remove" onclick="removeFromCompare(${p.id})" title="Убрать">&times;</button>
                                <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">
                                <span>${escapeHtml(p.name)}</span>
                            </div>
                        </th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(([label, getter]) => `
                    <tr>
                        <td>${label}</td>
                        ${items.map(p => `<td>${escapeHtml(getter(p))}</td>`).join('')}
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
}

function openCompareModal() {
    const items = compareItems();
    if (items.length < 2) {
        showToast('Выберите минимум два товара');
        return;
    }
    renderCompareTable();
    document.getElementById('compareModal')?.classList.add('open');
}

function closeCompareModal() {
    document.getElementById('compareModal')?.classList.remove('open');
}

// ─── RENDER PRODUCTS ─────────────────────────────────────────────
function renderProducts(items, gridId = 'productGrid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = `<div class="no-results"><i class="fa-solid fa-magnifying-glass"></i><p>Ничего не найдено. Попробуйте изменить фильтры.</p></div>`;
        return;
    }
    grid.innerHTML = items.map(p => `
        <div class="product-card reveal">
            ${p.badge === 'new' ? '<div class="product-badge badge-new">New</div>' : ''}
            ${p.badge === 'hot' ? '<div class="product-badge badge-hot">Hot</div>' : ''}
            <div class="product-img"><img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" /></div>
            <div class="product-body">
                <div class="product-cat">${escapeHtml(catLabels[p.cat] || p.cat)}</div>
                <div class="product-name">${escapeHtml(p.name)}</div>
                <div class="product-desc">${escapeHtml(p.desc)}</div>
                <div class="product-footer">
                    <div class="product-price">${p.price.toLocaleString()}<span>₽</span></div>
                    <div class="product-actions">
                        <button class="compare-btn ${isCompared(p.id) ? 'active' : ''}" data-compare-id="${p.id}" onclick="toggleCompare(${p.id})" title="${isCompared(p.id) ? 'Убрать из сравнения' : 'Добавить к сравнению'}">
                            <i class="fa-solid fa-scale-balanced"></i><span>${isCompared(p.id) ? 'В сравнении' : 'Сравнить'}</span>
                        </button>
                        <button class="add-btn" onclick="addToCart(${p.id})" title="В корзину"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    updateCompareButtons();
}

// ─── FILTERS ─────────────────────────────────────────────────────
function applyFilters() {
    const search = document.getElementById('searchInput');
    const catFilter = document.getElementById('categoryFilter');
    const priceFilter = document.getElementById('priceFilter');
    const priceVal = document.getElementById('priceVal');
    const resultCount = document.getElementById('resultCount');
    if (!search) return;
    const query = search.value.trim().toLowerCase();
    const selectedCat = catFilter?.value || 'all';
    const maxPrice = Number.parseInt(priceFilter?.value || '150000', 10) || Infinity;
    const filtered = products.filter(p => {
        const matchSearch = !query || p.name.toLowerCase().includes(query);
        const matchCat = selectedCat === 'all' || p.cat === selectedCat;
        const matchPrice = p.price <= maxPrice;
        return matchSearch && matchCat && matchPrice;
    });
    renderProducts(filtered);
    document.querySelectorAll('#productGrid .reveal').forEach(card => card.classList.add('active'));
    if (typeof initScrollAnimations === 'function') initScrollAnimations();
    if (priceVal) priceVal.textContent = maxPrice.toLocaleString();
    if (resultCount) resultCount.textContent = filtered.length + ' позиций';
}

// ─── AUTH ──────────────────────────────────────────────────────────
function activateAuthTab(tab) {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('loginForm')?.classList.toggle('active', tab === 'login');
    document.getElementById('regForm')?.classList.toggle('active', tab === 'reg');
    document.getElementById('forgotForm')?.classList.toggle('active', tab === 'forgot');
    const title = document.getElementById('authTitle');
    if (title) title.textContent = tab === 'reg' ? 'Регистрация' : tab === 'forgot' ? 'Восстановление доступа' : 'Вход';
    const intro = document.getElementById('authIntro');
    if (intro) {
        intro.textContent = tab === 'reg'
            ? 'Создайте профиль, чтобы быстрее оформлять следующие заказы.'
            : tab === 'forgot'
            ? 'Укажите почту аккаунта. Администратор проверит заявку и свяжется с вами.'
            : 'Войдите, чтобы продолжить работу с заказами и сохраненной корзиной.';
    }
}

function enhanceAuthModal() {
    const authModal = document.getElementById('authModal');
    const modalContent = authModal?.querySelector('.modal-content');
    if (!modalContent || modalContent.dataset.enhancedAuth === '1') return;

    modalContent.dataset.enhancedAuth = '1';
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3 id="authTitle">Вход</h3>
            <p id="authIntro">Войдите, чтобы продолжить работу с заказами и сохраненной корзиной.</p>
        </div>
        <button type="button" class="close-modal" id="closeAuth">&times;</button>
        <form id="loginForm" class="auth-form active" onsubmit="return false">
            <input type="email" name="email" placeholder="Почта" autocomplete="email">
            <input type="password" name="password" placeholder="Пароль" autocomplete="current-password">
            <button type="submit" class="btn btn-primary btn-block">Войти</button>
            <button type="button" class="auth-link-btn" data-auth-switch="forgot">Забыли пароль?</button>
            <button type="button" class="auth-link-btn" data-auth-switch="reg">Нет аккаунта? Зарегистрироваться</button>
        </form>
        <form id="regForm" class="auth-form" onsubmit="return false">
            <div class="auth-type-switch" role="radiogroup" aria-label="Тип аккаунта">
                <label>
                    <input type="radio" name="accountType" value="person" checked>
                    <span><i class="fa-solid fa-user"></i> Физическое лицо</span>
                </label>
                <label>
                    <input type="radio" name="accountType" value="legal">
                    <span><i class="fa-solid fa-building"></i> Юридическое лицо</span>
                </label>
            </div>
            <div class="auth-account-panel active" data-account-panel="person">
                <input type="text" name="firstName" placeholder="Имя" autocomplete="given-name">
                <input type="text" name="lastName" placeholder="Фамилия" autocomplete="family-name">
            </div>
            <div class="auth-account-panel" data-account-panel="legal">
                <input type="text" name="company" placeholder="Название компании" autocomplete="organization">
                <input type="text" name="contactName" placeholder="ФИО контактного лица (кого указать)" autocomplete="name">
                <p class="auth-note">Адрес доставки можно будет добавить позже в личном кабинете или при оформлении заказа.</p>
            </div>
            <input type="tel" name="phone" placeholder="+7 (___) ___ __-__" autocomplete="tel" data-phone-mask>
            <input type="email" name="email" placeholder="Почта" autocomplete="email">
            <input type="password" name="password" placeholder="Пароль" autocomplete="new-password">
            <button type="submit" class="btn btn-primary btn-block">Зарегистрироваться</button>
            <button type="button" class="auth-link-btn" data-auth-switch="login">Уже есть аккаунт? Войти</button>
        </form>
        <form id="forgotForm" class="auth-form" onsubmit="return false">
            <input type="email" name="email" placeholder="Почта аккаунта" autocomplete="email">
            <button type="submit" class="btn btn-primary btn-block">Отправить заявку</button>
            <button type="button" class="auth-link-btn" data-auth-switch="login">Вернуться ко входу</button>
        </form>
    `;

    const syncAccountPanels = () => {
        const accountType = modalContent.querySelector('input[name="accountType"]:checked')?.value || 'person';
        modalContent.querySelectorAll('[data-account-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.accountPanel === accountType);
        });
    };

    modalContent.querySelectorAll('input[name="accountType"]').forEach(input => {
        input.addEventListener('change', syncAccountPanels);
    });
    modalContent.querySelectorAll('[data-auth-switch]').forEach(btn => {
        btn.addEventListener('click', () => activateAuthTab(['reg','forgot'].includes(btn.dataset.authSwitch) ? btn.dataset.authSwitch : 'login'));
    });
    syncAccountPanels();
    initPhoneMasks(modalContent);
}

function openAuthModal(tab = 'login') {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.style.display = 'flex';
    activateAuthTab(tab);
}
window.openAuthModal = openAuthModal;

function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
}

function handleOpenAuthClick() {
    if (isAuthed()) {
        if (!window.location.pathname.endsWith('profile.html')) {
            window.location.href = 'profile.html';
        }
        return;
    }
    openAuthModal('login');
}

function promptLogin() {
    sessionStorage.setItem(CHECKOUT_PENDING_KEY, '1');
    showToast('Войдите в аккаунт для оформления заказа');
    setTimeout(() => openAuthModal('login'), 300);
}

function initAuth() {
    if (document.body.dataset.authInited) return;
    document.body.dataset.authInited = '1';

    enhanceAuthModal();

    const authModal = document.getElementById('authModal');
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('regForm');
    const forgotForm = document.getElementById('forgotForm');

    document.getElementById('openAuth')?.addEventListener('click', handleOpenAuthClick);
    document.getElementById('closeAuth')?.addEventListener('click', closeAuthModal);
    authModal?.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    authModal?.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => activateAuthTab(btn.dataset.tab === 'reg' ? 'reg' : 'login'));
    });

    if (!loginForm && !regForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = normalizeEmail(loginForm.querySelector('input[type="email"]')?.value);
        const password = String(loginForm.querySelector('input[type="password"]')?.value || '');

        if (!email || !password) { showToast('Введите email и пароль'); return; }
        if (!isValidEmail(email)) { showToast('Введите корректный email'); return; }

        const guestCart = loadGuestCart().map(x => ({ id: x.id, qty: x.qty }));

        try {
            await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password, guestCart }) });
        } catch (err) {
            if (err.status === 401) showToast('Неверный email или пароль');
            else showToast('Ошибка входа (откройте сайт через `npm start`)');
            return;
        }

        clearGuestCart();
        await refreshMe();
        await loadCart();
        closeAuthModal();
        updateCartCount();
        renderCartItems();
        showToast('Вход выполнен успешно!');
        loginForm.reset();
        if (typeof window.loadProfileData === 'function') await window.loadProfileData();
        maybeRedirectAfterAuth();
    });

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accountType = regForm.querySelector('input[name="accountType"]:checked')?.value || 'person';
        const firstName = String(regForm.querySelector('input[name="firstName"]')?.value || '').trim();
        const lastName = String(regForm.querySelector('input[name="lastName"]')?.value || '').trim();
        const companyName = String(regForm.querySelector('input[name="company"]')?.value || '').trim();
        const contactName = String(regForm.querySelector('input[name="contactName"]')?.value || '').trim();
        const phone = String(regForm.querySelector('input[name="phone"]')?.value || '').trim();
        const company = accountType === 'legal' ? companyName : `${firstName} ${lastName}`.trim();
        const email = normalizeEmail(regForm.querySelector('input[type="email"]')?.value);
        const password = String(regForm.querySelector('input[type="password"]')?.value || '');

        clearFormInvalidState(regForm);
        if (!email || !password) { showToast('Введите email и пароль'); return; }
        if (!isValidEmail(email)) { setFieldInvalid(regForm.querySelector('input[type="email"]')); showToast('Введите корректный email'); return; }
        if (!isStrongEnoughPassword(password)) { setFieldInvalid(regForm.querySelector('input[type="password"]')); showToast('Пароль слишком короткий (минимум 6 символов)'); return; }

        if (accountType === 'person' && (!firstName || !lastName)) { showToast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u0438 \u0444\u0430\u043c\u0438\u043b\u0438\u044e'); return; }
        if (accountType === 'legal' && (!companyName || !contactName)) { showToast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u044e \u0438 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e'); return; }
        if (!isValidPhone(formatRuPhone(phone))) { setFieldInvalid(regForm.querySelector('input[name="phone"]')); showToast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043b\u0435\u0444\u043e\u043d'); return; }

        const guestCart = loadGuestCart().map(x => ({ id: x.id, qty: x.qty }));

        try {
            await apiFetch('/api/register', { method: 'POST', body: JSON.stringify({ accountType, firstName, lastName, contactName, email, password, company, phone, guestCart }) });
        } catch (err) {
            if (err.status === 409) showToast('Такой email уже зарегистрирован');
            else if (err.status === 400 && err.data?.error === 'invalid_email') showToast('Введите корректный email');
            else if (err.status === 400 && err.data?.error === 'invalid_phone') showToast('Введите корректный телефон');
            else if (err.status === 400 && err.data?.error === 'weak_password') showToast('Пароль слишком короткий');
            else showToast('Ошибка регистрации (откройте сайт через `npm start`)');
            return;
        }

        clearGuestCart();
        await refreshMe();
        await loadCart();
        closeAuthModal();
        updateCartCount();
        renderCartItems();
        showToast('Регистрация прошла успешно!');
        regForm.reset();
        loginForm.reset();
        if (typeof window.loadProfileData === 'function') await window.loadProfileData();
        maybeRedirectAfterAuth();
    });

    forgotForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = normalizeEmail(forgotForm.querySelector('input[type="email"]')?.value);
        if (!isValidEmail(email)) { showToast('Введите корректный email'); return; }

        try {
            await apiFetch('/api/password-reset-requests', { method: 'POST', body: JSON.stringify({ email }) });
            forgotForm.reset();
            closeAuthModal();
            showToast('Заявка отправлена. Администратор свяжется с вами.');
        } catch (err) {
            if (err.status === 400) showToast('Введите корректный email');
            else showToast('Не удалось отправить заявку');
        }
    });
}

const CHECKOUT_PENDING_KEY = 'gt_checkout_pending';

function maybeRedirectAfterAuth() {
    const pending = sessionStorage.getItem(CHECKOUT_PENDING_KEY);
    if (pending) sessionStorage.removeItem(CHECKOUT_PENDING_KEY);

    if (window.location.pathname.endsWith('checkout.html')) {
        if (typeof window.updateCheckoutUI === 'function') window.updateCheckoutUI();
        return;
    }
    if (pending && cart.length) {
        window.location.href = 'checkout.html';
    }
}

function goToCheckout() {
    if (!cart.length) {
        showToast('Корзина пуста');
        return;
    }
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.getElementById('cartOverlay')?.classList.remove('open');
    if (!isAuthed()) {
        promptLogin();
        return;
    }
    if (!window.location.pathname.endsWith('checkout.html')) {
        window.location.href = 'checkout.html';
    }
}

// ─── CART DRAWER ─────────────────────────────────────────────────
function initCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const openBtn = document.getElementById('openCart');
    const closeBtn = document.getElementById('closeCart');
    const open = () => { drawer?.classList.add('open'); overlay?.classList.add('open'); renderCartItems(); };
    const close = () => { drawer?.classList.remove('open'); overlay?.classList.remove('open'); };
    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
}

// ─── BURGER MENU ──────────────────────────────────────────────────
function initBurger() {
    const burger = document.getElementById('burger');
    const menu = document.getElementById('mobileMenu');
    burger?.addEventListener('click', () => { burger.classList.toggle('open'); menu?.classList.toggle('open'); });
    menu?.querySelectorAll('a').forEach(a => { a.addEventListener('click', () => { burger?.classList.remove('open'); menu.classList.remove('open'); }); });
}

// ─── SCROLL ANIMATIONS ───────────────────────────────────────────
let scrollRevealObserver;
function initScrollAnimations() {
    if (!scrollRevealObserver) {
        scrollRevealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
        }, { threshold: 0.1 });
    }
    document.querySelectorAll('.reveal:not(.observed), .reveal-left:not(.observed)').forEach(el => {
        el.classList.add('observed');
        scrollRevealObserver.observe(el);
    });
}
window.initScrollAnimations = initScrollAnimations;

// Expose for inline onclick handlers in dynamically rendered HTML
window.addToCart = addToCart;
window.changeQty = changeQty;
window.goToCheckout = goToCheckout;
window.toggleCompare = toggleCompare;
window.removeFromCompare = removeFromCompare;

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadProductsFromApi();
    await refreshMe();
    await loadCart();
    updateCartCount();

    initAuth();
    initCart();
    initBurger();
    initPhoneMasks();
    renderCompareBar();

    const searchEl = document.getElementById('searchInput');
    if (searchEl) {
        renderProducts(products);
        document.getElementById('searchInput')?.addEventListener('input', applyFilters);
        document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);
        document.getElementById('priceFilter')?.addEventListener('input', applyFilters);
        document.getElementById('priceFilter')?.addEventListener('change', applyFilters);
    }

    renderProducts(products.slice(0, 3), 'featuredGrid');
    initScrollAnimations();

    document.querySelectorAll('.checkout-btn:not(#checkoutBtn)').forEach(btn => {
        btn.addEventListener('click', goToCheckout);
    });

    if (!document.querySelector('script[src="effects.js"]')) {
        const fx = document.createElement('script');
        fx.src = 'effects.js';
        fx.defer = true;
        document.body.appendChild(fx);
    }
});
