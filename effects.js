/* ООО «Газпроект Сервис Автоматика» — эффекты интерфейса */

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initTopBar() {
    if (document.querySelector('.top-bar') || document.body.dataset.noEffects != null) return;
    if (location.pathname.includes('admin.html')) return;

    const bar = document.createElement('div');
    bar.className = 'top-bar';
    bar.innerHTML = `
        <div class="container top-bar-inner">
            <span class="top-bar-live"><span class="live-dot"></span> Оренбург — поставка газоаналитического оборудования</span>
            <div class="top-bar-ticker" aria-hidden="true">
                <div class="ticker-track">
                    <span>Работаем с 2015 года</span><span>·</span>
                    <span>Выезд инженера</span><span>·</span>
                    <span>Гарантия до 5 лет</span><span>·</span>
                    <span>Поставка датчиков газа</span><span>·</span>
                    <span>Газоанализаторы и приборы контроля</span><span>·</span>
                    <span>Работаем с 2015 года</span><span>·</span>
                    <span>Выезд инженера</span><span>·</span>
                    <span>Гарантия до 5 лет</span><span>·</span>
                    <span>Поставка датчиков газа</span><span>·</span>
                    <span>Газоанализаторы и приборы контроля</span><span>·</span>
                </div>
            </div>
            <a href="contact.html" class="top-bar-phone"><i class="fa-solid fa-location-dot"></i> Оренбург, ул. Советская, 42</a>
        </div>
    `;
    const header = document.querySelector('.header');
    if (header) header.before(bar);
    else document.body.prepend(bar);
    document.body.classList.add('has-top-bar');
}

function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('header--scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
}

function formatCountDisplay(val, el, suffix, prefix) {
    if (el.dataset.format === 'k') {
        const v = val / 1000;
        const shown = v >= 10 ? Math.round(v) : v.toFixed(1);
        return `${prefix || ''}${shown}k${suffix || ''}`;
    }
    const decimals = Number(el.dataset.decimals) || 0;
    const shown = decimals ? Number(val).toFixed(decimals) : Math.round(val);
    return `${prefix || ''}${shown}${suffix || ''}`;
}

function animateCounter(el, target, duration, suffix, prefix) {
    if (prefersReducedMotion()) {
        el.textContent = formatCountDisplay(target, el, suffix, prefix);
        return;
    }
    const start = performance.now();
    const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatCountDisplay(target * eased, el, suffix, prefix);
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function initCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            if (el.dataset.counted) return;
            el.dataset.counted = '1';
            const target = parseFloat(el.dataset.count);
            const suffix = el.dataset.suffix || '';
            const prefix = el.dataset.prefix || '';
            const duration = Number(el.dataset.duration) || 1400;
            animateCounter(el, target, duration, suffix, prefix);
            observer.unobserve(el);
        });
    }, { threshold: 0.35 });

    els.forEach(el => observer.observe(el));
}

function initLivePanel() {
    const panel = document.querySelector('.hero-panel');
    if (!panel || prefersReducedMotion()) return;

    const configs = [
        { sel: '.g1 .gauge-label span:last-child', values: ['0.018%', '0.019%', '0.017%', '0.020%'] },
        { sel: '.g2 .gauge-label span:last-child', values: ['630 ppm', '628 ppm', '631 ppm', '629 ppm'] },
        { sel: '.g3 .gauge-label span:last-child', values: ['20.9%', '20.8%', '21.0%', '20.9%'] },
        { sel: '.g4 .gauge-label span:last-child', values: ['4.5 ppm', '4.3 ppm', '4.6 ppm', '4.4 ppm'] },
    ];

    const fills = panel.querySelectorAll('.gauge-fill');
    const bases = [18, 63, 94, 30];
    fills.forEach((fill, i) => { fill.dataset.base = bases[i]; });

    let tick = 0;
    setInterval(() => {
        tick++;
        configs.forEach((cfg, i) => {
            const el = panel.querySelector(cfg.sel);
            if (el) el.textContent = cfg.values[tick % cfg.values.length];
            const fill = fills[i];
            if (fill && fill.dataset.base) {
                const base = parseFloat(fill.dataset.base);
                const wobble = (Math.sin(tick + i) * 2);
                fill.style.width = `${Math.max(8, Math.min(98, base + wobble))}%`;
            }
        });
        const footer = panel.querySelector('.panel-footer-text');
        if (footer) {
            footer.textContent = tick % 4 === 0 ? 'Синхронизация с облаком…' : 'Все параметры в норме';
        }
    }, 3200);

    const timeEl = document.getElementById('panelTime');
    if (timeEl) {
        const upd = () => { timeEl.textContent = new Date().toLocaleTimeString('ru-RU'); };
        upd();
        setInterval(upd, 1000);
    }
}

function initActivityFeed() {
    if (!document.body.classList.contains('page-home') || prefersReducedMotion()) return;
    if (sessionStorage.getItem('gt_activity_off')) return;

    const events = [
        { icon: 'fa-file-invoice', text: 'ООО «ПромГаз» запросил коммерческое предложение' },
        { icon: 'fa-cart-shopping', text: 'АО «ТеплоЭнерго» оформило заказ на датчики CH₄' },
        { icon: 'fa-truck', text: 'Подготовлена поставка оборудования для клиента' },
        { icon: 'fa-screwdriver-wrench', text: 'Инженер выехал на объект в Оренбурге' },
        { icon: 'fa-certificate', text: 'Завершена проверка партии газоанализаторов ГАН-12' },
        { icon: 'fa-building', text: 'Поступила заявка на подбор газоанализаторов' },
    ];

    const box = document.createElement('div');
    box.className = 'activity-feed';
    box.innerHTML = `
        <button type="button" class="activity-feed-close" aria-label="Скрыть">&times;</button>
        <div class="activity-feed-icon"><i class="fa-solid fa-bell"></i></div>
        <div class="activity-feed-text"></div>
    `;
    document.body.appendChild(box);

    const textEl = box.querySelector('.activity-feed-text');
    const iconEl = box.querySelector('.activity-feed-icon i');
    let idx = 0;
    let hideTimer;

    const show = () => {
        const ev = events[idx % events.length];
        idx++;
        if (iconEl) iconEl.className = `fa-solid ${ev.icon}`;
        if (textEl) textEl.textContent = ev.text;
        box.classList.add('visible');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => box.classList.remove('visible'), 6000);
    };

    box.querySelector('.activity-feed-close')?.addEventListener('click', () => {
        box.remove();
        sessionStorage.setItem('gt_activity_off', '1');
    });

    setTimeout(show, 8000);
    setInterval(show, 22000);
}

function initMagneticButtons() {
    if (prefersReducedMotion()) return;
    document.querySelectorAll('.btn-primary, .add-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const r = btn.getBoundingClientRect();
            const x = (e.clientX - r.left - r.width / 2) * 0.08;
            const y = (e.clientY - r.top - r.height / 2) * 0.08;
            btn.style.transform = `translate(${x}px, ${y}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
}

function initParallaxHero() {
    const hero = document.querySelector('.hero');
    const visual = document.querySelector('.hero-visual');
    if (!hero || !visual || prefersReducedMotion()) return;

    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        visual.style.transform = `translate(${x * 12}px, ${y * 10}px)`;
    });
    hero.addEventListener('mouseleave', () => { visual.style.transform = ''; });
}

function initStaggerCards() {
    document.querySelectorAll('.product-card, .feature-card, .industry-card').forEach((card, i) => {
        if (!card.classList.contains('reveal')) card.classList.add('reveal');
        card.style.transitionDelay = `${Math.min(i % 6, 5) * 0.06}s`;
    });
    if (typeof window.initScrollAnimations === 'function') window.initScrollAnimations();
}

function initSiteEffects() {
    initTopBar();
    initHeaderScroll();
    initCounters();
    initLivePanel();
    initActivityFeed();
    initMagneticButtons();
    initParallaxHero();
    initStaggerCards();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteEffects);
} else {
    initSiteEffects();
}
