function renderCheckoutSummary() {
    const list = document.getElementById('checkoutSummaryItems');
    const totalEl = document.getElementById('checkoutSummaryTotal');
    const countEl = document.getElementById('checkoutItemsCount');
    if (!list) return;

    if (!cart.length) {
        list.innerHTML = '';
        if (totalEl) totalEl.textContent = '0 ₽';
        if (countEl) countEl.textContent = '0';
        return;
    }

    list.innerHTML = cart.map(item => {
        const isPath = item.img && (item.img.includes('/') || item.img.includes('.'));
        const imgHtml = isPath
            ? `<img src="${item.img}" alt="${item.name}" onerror="this.outerHTML='<span style=\\'font-size:22px;\\'>📦</span>'" />`
            : `<span style="font-size:22px;">${item.img || '📦'}</span>`;
        return `
        <div class="checkout-summary-item">
            <span class="checkout-summary-emoji">${imgHtml}</span>
            <div class="checkout-summary-info">
                <div class="checkout-summary-name">${item.name}</div>
                <div class="checkout-summary-meta">${item.qty} × ${item.price.toLocaleString()} ₽</div>
            </div>
            <div class="checkout-summary-price">${(item.price * item.qty).toLocaleString()} ₽</div>
        </div>`;
    }).join('');

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const qty = cart.reduce((s, i) => s + i.qty, 0);
    if (totalEl) totalEl.textContent = `${total.toLocaleString()} ₽`;
    if (countEl) countEl.textContent = String(qty);
}

function prefillCheckoutForm() {
    const emailEl = document.getElementById('coEmail');
    const companyEl = document.getElementById('coCompany');
    const phoneEl = document.getElementById('coPhone');
    if (emailEl && meUser?.email) emailEl.value = meUser.email;
    if (companyEl && meUser?.company) companyEl.value = meUser.company;
    if (phoneEl && meUser?.phone) phoneEl.value = window.formatRuPhone ? formatRuPhone(meUser.phone) : meUser.phone;
    if (window.initPhoneMasks) initPhoneMasks();
}

function showCheckoutView(view) {
    const views = {
        notAuthed: document.getElementById('checkoutNotAuthed'),
        empty: document.getElementById('checkoutEmpty'),
        main: document.getElementById('checkoutMain'),
        success: document.getElementById('checkoutSuccess'),
    };
    Object.values(views).forEach(el => { if (el) el.style.display = 'none'; });
    if (views[view]) views[view].style.display = 'block';
}

function updateCheckoutUI() {
    if (document.getElementById('checkoutSuccess')?.style.display === 'block') return;

    if (!isAuthed()) {
        showCheckoutView('notAuthed');
        return;
    }
    if (!cart.length) {
        showCheckoutView('empty');
        return;
    }
    showCheckoutView('main');
    prefillCheckoutForm();
    renderCheckoutSummary();
}

document.getElementById('checkoutLoginBtn')?.addEventListener('click', () => {
    sessionStorage.setItem('gt_checkout_pending', '1');
    if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
});

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAuthed()) {
        showToast('Войдите в аккаунт');
        return;
    }
    if (!cart.length) {
        showToast('Корзина пуста');
        updateCheckoutUI();
        return;
    }

    const phone = document.getElementById('coPhone')?.value.trim();
    const address = document.getElementById('coAddress')?.value.trim();
    const delivery = document.getElementById('coDelivery')?.value.trim();
    const comment = document.getElementById('coComment')?.value.trim();
    const company = document.getElementById('coCompany')?.value.trim();

    if (!phone || !address || !delivery) {
        showToast('Заполните обязательные поля');
        return;
    }
    if (window.formatRuPhone && !phone.startsWith('+7')) {
        document.getElementById('coPhone').value = formatRuPhone(phone);
    }
    const normalizedPhone = window.formatRuPhone ? formatRuPhone(phone) : phone;
    if (window.isValidPhone ? !isValidPhone(normalizedPhone) : normalizedPhone.replace(/\D/g, '').length !== 11) {
        showToast('Введите корректный телефон');
        return;
    }
    if (address.length < 5) {
        showToast('Укажите адрес подробнее');
        return;
    }
    if (comment && comment.length > 1000) {
        showToast('Комментарий слишком длинный');
        return;
    }

    const btn = document.getElementById('submitOrderBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Оформляем…';
    }

    try {
        const data = await apiFetch('/api/orders', {
            method: 'POST',
            body: JSON.stringify({ phone: normalizedPhone, address, delivery, comment }),
        });

        if (company && (company !== meUser?.company)) {
            try {
                await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ company, phone: normalizedPhone }) });
                if (meUser) { meUser.company = company; meUser.phone = normalizedPhone; }
            } catch { /* optional profile sync */ }
        } else if (normalizedPhone && normalizedPhone !== meUser?.phone) {
            try {
                await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ company: meUser?.company || '', phone: normalizedPhone }) });
                if (meUser) meUser.phone = normalizedPhone;
            } catch { /* ignore */ }
        }

        cart = [];
        updateCartCount();
        renderCartItems();

        const orderIdEl = document.getElementById('successOrderId');
        if (orderIdEl) orderIdEl.textContent = `#${data.orderId}`;

        document.querySelector('.checkout-step.active')?.classList.remove('active');
        document.querySelector('.checkout-step.done')?.classList.add('done');
        document.getElementById('stepDone')?.classList.add('active', 'done');

        showCheckoutView('success');
        showToast('Заказ успешно оформлен!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        if (err.data?.error === 'cart_empty') showToast('Корзина пуста');
        else if (err.data?.error === 'invalid_phone') showToast('Введите корректный телефон');
        else if (err.data?.error === 'invalid_address') showToast('Укажите адрес подробнее');
        else if (err.data?.error === 'invalid_delivery') showToast('Выберите способ доставки');
        else showToast('Ошибка оформления заказа');
        updateCheckoutUI();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Подтвердить заказ';
        }
    }
});

window.updateCheckoutUI = updateCheckoutUI;

document.addEventListener('DOMContentLoaded', async () => {
    await refreshMe();
    await loadCart();
    updateCartCount();
    updateCheckoutUI();
});
