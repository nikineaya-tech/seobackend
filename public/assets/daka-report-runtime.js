// Daka report runtime served by the backend.
// Keep large report-section helpers out of inline HTML to prevent host/embed code leakage.
(function () {
function renderReportSection(key, title, subtitle, icon, html, opts = {}) {
    if (!String(html || '').trim()) return '';
    const labels = getReportLabels(opts);
    const expanded = opts.open === true;
    const isOpen = expanded ? 'open' : '';
    const dir = opts.isAr ? 'rtl' : 'ltr';
    const noCollapse = opts.noCollapse === true;
    const preview = opts.summary ? summarizeReportHtml(opts.summary, labels.openHint) : '';
    const safe = typeof escapeHtml === 'function'
        ? escapeHtml
        : (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

    if (noCollapse) {
        return `
    <section class="report-section report-section-direct report-section-${safe(key)} fade-in-up" data-export-feature="${safe(key)}" dir="${dir}">
        <div class="report-section-head">
            <span class="report-section-icon"><i class="fas ${safe(icon || 'fa-layer-group')}"></i></span>
            <span class="report-section-copy">
                <strong>${safe(title)}</strong>
                <small>${safe(subtitle || '')}</small>
            </span>
        </div>
        ${preview ? `<p class="report-section-preview" dir="auto">${safe(preview)}</p>` : ''}
        <div class="report-section-body" data-no-collapse="true" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">${html}</div>
    </section>`;
    }

    return `
    <section class="report-section report-section-${safe(key)} ${expanded ? 'report-section-open' : ''} fade-in-up"
        dir="${dir}" data-export-feature="${safe(key)}" data-report-toggle="1" aria-expanded="${expanded ? 'true' : 'false'}">
        <div class="report-section-head" data-report-header="1" tabindex="0" role="button" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="report-details-${safe(key)}">
            <span class="report-section-icon"><i class="fas ${safe(icon || 'fa-layer-group')}"></i></span>
            <span class="report-section-copy">
                <strong>${safe(title)}</strong>
                <small>${safe(subtitle || '')}</small>
            </span>
        </div>
        ${preview ? `<p class="report-section-preview" dir="auto">${safe(preview)}</p>` : ''}
        <details id="report-details-${safe(key)}" class="report-section-details" data-report-details="1" ${isOpen}>
            <summary>
                <span class="report-section-toggle"><small>${safe(labels.openHint || '')}</small><i class="fas fa-chevron-down"></i></span>
            </summary>
            <div class="report-section-body" data-no-collapse="true" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">${html}</div>
            <div class="report-section-close-row no-print">
                <button type="button" class="report-section-close" data-report-close="1" data-no-collapse="true"><span>${safe(labels.closeHint || 'Close')}</span><i class="fas fa-chevron-up"></i></button>
            </div>
        </details>
    </section>`;
}

function getReportFeatureCopy(lang = STATE.currentLang || 'fr') {
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const fr = {
        summary: ['Résumé', 'Comprendre le verdict en 3 minutes', 'fa-gauge-high'],
        actions: ['Actions prioritaires', 'Les priorités à exécuter maintenant', 'fa-list-check'],
        competitors: ['Concurrents', 'Qui attaque votre marché et comment répondre', 'fa-crosshairs'],
        funnel: ['Funnel', 'Où votre page perd des clients', 'fa-route'],
        seo: ['SEO', 'Les freins techniques et sémantiques', 'fa-magnifying-glass-chart'],
        keywords: ['Keywords', 'Les demandes utiles à cibler', 'fa-key'],
        pricing: ['Pricing', 'Prix, perception et marge', 'fa-tags'],
        trust: ['Trust', 'Preuves, garanties et objections', 'fa-shield-halved'],
        backlinks: ['Backlinks', 'Liens et opportunités prêts à consulter', 'fa-link'],
        details: ['Détails', 'Le dossier complet d’intelligence', 'fa-folder-open']
    };
    if (isAr) return {
        summary: ['الملخص', 'افهم الخلاصة في 3 دقائق', 'fa-gauge-high'],
        actions: ['الإجراءات', 'الأولويات التي يجب تنفيذها الآن', 'fa-list-check'],
        competitors: ['المنافسون', 'من يهاجم سوقك وكيف ترد', 'fa-crosshairs'],
        funnel: ['مسار التحويل', 'أين تفقد صفحتك العملاء', 'fa-route'],
        seo: ['أساس الموقع', 'العوائق التقنية والدلالية', 'fa-magnifying-glass-chart'],
        keywords: ['الكلمات', 'الطلبات المفيدة للاستهداف', 'fa-key'],
        pricing: ['السعر', 'السعر والإدراك والهامش', 'fa-tags'],
        trust: ['الثقة', 'الأدلة والضمانات والاعتراضات', 'fa-shield-halved'],
        backlinks: ['الروابط الخلفية', 'روابط وفرص جاهزة للفحص', 'fa-link'],
        details: ['التفاصيل', 'ملف التحليل الكامل', 'fa-folder-open']
    };
    if (isEn) return {
        summary: ['Summary', 'Understand the verdict in 3 minutes', 'fa-gauge-high'],
        actions: ['Priority actions', 'What to execute now', 'fa-list-check'],
        competitors: ['Competitors', 'Who attacks your market and how to respond', 'fa-crosshairs'],
        funnel: ['Funnel', 'Where your page loses customers', 'fa-route'],
        seo: ['SEO', 'Technical and semantic blockers', 'fa-magnifying-glass-chart'],
        keywords: ['Keywords', 'Useful demand to target', 'fa-key'],
        pricing: ['Pricing', 'Price, perception, and margin', 'fa-tags'],
        trust: ['Trust', 'Proof, guarantees, and objections', 'fa-shield-halved'],
        backlinks: ['Backlinks', 'Links and opportunities ready to review', 'fa-link'],
        details: ['Details', 'The complete intelligence dossier', 'fa-folder-open']
    };
    return fr;
}

function enhanceReportNavigation(container) {
    if (!container) return;
    container.querySelectorAll('.report-feature-nav').forEach(nav => nav.remove());
    const sections = [...container.querySelectorAll(':scope > .report-section, :scope > #funnelReport > .report-section')];
    const summary = container.querySelector(':scope > .executive-summary, :scope > #funnelReport > .executive-summary');
    if (!summary && !sections.length) return;

    const reportLang = (container.querySelector(':scope > #funnelReport') || container).getAttribute('lang') || container.getAttribute('lang') || STATE.currentLang || 'fr';
    const copy = getReportFeatureCopy(reportLang);
    const items = [];
    if (summary) items.push({ key: 'summary', target: summary });
    sections.forEach(section => {
        const classes = [...section.classList];
        const sectionKey = classes.find(name => name.startsWith('report-section-') && !['report-section-open', 'report-section-direct', 'report-section-details', 'report-section-body', 'report-section-head'].includes(name))?.replace('report-section-', '');
        const key = sectionKey === 'plan' ? 'actions'
            : sectionKey === 'market' ? 'competitors'
            : sectionKey === 'technical' || sectionKey === 'page' ? 'seo'
            : sectionKey === 'money' ? 'pricing'
            : sectionKey === 'proof' ? 'trust'
            : sectionKey === 'backlinks' ? 'backlinks'
            : sectionKey === 'audit' ? 'funnel'
            : sectionKey === 'keywords' ? 'keywords'
            : 'details';
        if (!items.some(item => item.key === key)) items.push({ key, target: section });
    });
    if (sections.length && !items.some(item => item.key === 'details')) items.push({ key: 'details', target: sections[sections.length - 1] });

    const nav = document.createElement('nav');
    nav.className = 'report-feature-nav no-print';
    nav.setAttribute('aria-label', reportLang === 'ar' ? 'التنقل في التقرير' : reportLang === 'en' ? 'Report navigation' : 'Navigation du rapport');
    nav.innerHTML = items.map((item, index) => {
        const [title, description, icon] = copy[item.key] || copy.details;
        return `<button type="button" class="report-feature-tab${index === 0 ? ' active' : ''}" data-no-collapse="true" data-feature-index="${index}">
            <i class="fas ${icon}"></i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
        </button>`;
    }).join('');
    nav.addEventListener('click', event => {
        const button = event.target.closest('.report-feature-tab');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        nav.querySelectorAll('.report-feature-tab').forEach(tab => tab.classList.toggle('active', tab === button));
        const item = items[Number(button.dataset.featureIndex)];
        if (!item?.target) return;
        if (item.target.classList.contains('report-section')) setReportSectionOpen(item.target, true);
        item.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const host = container.querySelector(':scope > #funnelReport') || container;
    host.querySelectorAll(':scope > .report-feature-nav').forEach(oldNav => oldNav.remove());
    host.insertBefore(nav, host.firstChild);
}

function setReportSectionOpen(section, open) {
    const details = section?.querySelector(':scope > .report-section-details');
    if (!details) return;
    details.open = Boolean(open);
    section.classList.toggle('report-section-open', details.open);
    section.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    section.querySelector(':scope > .report-section-head')?.setAttribute('aria-expanded', details.open ? 'true' : 'false');
}

function isReportSectionInteractiveTarget(target) {
    if (!target) return false;
    if (target.closest('[data-no-collapse="true"]')) return true;
    if (target.closest('.report-section-body a, .report-section-body button, .report-section-body input, .report-section-body select, .report-section-body textarea, .report-section-body label, .report-section-body summary')) {
        return true;
    }
    return Boolean(target.closest('a, button, input, select, textarea, label, canvas, iframe, video, audio, [contenteditable="true"], [data-competitor-action], .expert-card, .copy-badge, .btn-copy-mini'));
}

if (!window.__dakaReportToggleBound) {
    window.__dakaReportToggleBound = true;

    document.addEventListener('click', (event) => {
        const section = event.target.closest('.report-section[data-report-toggle="1"]');
        const closeButton = event.target.closest('[data-report-close="1"]');
        if (closeButton && section) {
            event.preventDefault();
            event.stopPropagation();
            setReportSectionOpen(section, false);
            section.querySelector(':scope > .report-section-head')?.focus?.({ preventScroll: true });
            return;
        }
        const action = event.target.closest('button, a, [role="button"]');
        if (action && action !== section && action.closest('.report-section, .result-card, .competitor-card, details')) {
            action.setAttribute('data-no-collapse', 'true');
            if (action.tagName === 'BUTTON' && !action.type) action.type = 'button';
            event.stopPropagation();
        }
        if (!section || isReportSectionInteractiveTarget(event.target)) return;
        const clickedHeader = event.target.closest('.report-section-head');
        const clickedSummary = event.target.closest('.report-section-details > summary');
        if (!clickedHeader && !clickedSummary && event.target !== section) return;

        const details = section.querySelector(':scope > .report-section-details');
        if (!details) return;

        event.preventDefault();
        setReportSectionOpen(section, !details.open);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const header = event.target.closest?.('[data-report-header="1"]');
        const section = header?.closest?.('.report-section[data-report-toggle="1"]');
        if (!section || event.target !== header) return;

        const details = section.querySelector(':scope > .report-section-details');
        if (!details) return;

        event.preventDefault();
        setReportSectionOpen(section, !details.open);
    });
}

function renderExpertDock(section, opts = {}) {
    const isAr = opts.isAr ?? STATE.currentLang === 'ar';
    const isEn = opts.isEn ?? STATE.currentLang === 'en';
    const labels = getReportLabels({ isAr, isEn });
    const dir = isAr ? 'rtl' : 'ltr';
    const safe = typeof escapeHtml === 'function'
        ? escapeHtml
        : (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

    const bySection = {
        competitors: {
            icon: 'fa-chess-knight',
            title: isAr ? 'افهم السوق ثم قرر الخطوة التالية' : isEn ? 'Understand the market, then decide the next move' : 'Comprendre le marché, puis décider quoi faire',
            sub: labels.expertsSub,
            experts: [
                { name: isAr ? 'خبير المنافسين' : isEn ? 'Competitor Expert' : 'Expert Concurrents', desc: isAr ? 'يلخص التقرير ويحول المنافسين إلى خطوات واضحة.' : isEn ? 'Summarizes the report and turns competitors into clear actions.' : 'Resume le rapport et transforme les concurrents en actions claires.', url: 'https://chatgpt.com/g/g-673ba23144bc819199fa36907952822b-competitor-research-assistant' },
                { name: isAr ? 'Sophie - السوق' : isEn ? 'Sophie - Market' : 'Sophie - Marché', desc: isAr ? 'تحدد زاوية السوق والفرص التي تستحق الهجوم.' : isEn ? 'Finds the market angle and opportunities worth attacking.' : 'Trouve l’angle de marché et les opportunités à attaquer.', url: 'https://chatgpt.com/g/g-8nEbqfyfE-sophie-strategic-market-bot' },
                { name: isAr ? 'Sharon - الجمهور' : isEn ? 'Sharon - Audience' : 'Sharon - Audience', desc: isAr ? 'توضح من تستهدف، ماذا تعده، وما الكلمات التي تستخدمها.' : isEn ? 'Clarifies who to target, what to promise, and which words to use.' : 'Clarifie qui viser, quoi promettre et quels mots utiliser.', url: 'https://chatgpt.com/g/g-stmJ7C0EP-sharon-target-audience-analyzer' }
            ]
        },
        funnel: {
            icon: 'fa-route',
            title: isAr ? 'حوّل التشخيص إلى صفحة تبيع' : isEn ? 'Turn the diagnosis into a page that sells' : 'Transformer le diagnostic en page qui vend',
            sub: isAr ? 'OpenRouter code builder' : isEn ? 'Describe the idea, choose an OpenRouter model, and watch Daka build the code step by step.' : 'D?cris ton id?e, choisis un mod?le OpenRouter, puis regarde Daka construire le code ?tape par ?tape.',
            experts: [
                { name: isAr ? 'Blaze - المسار' : isEn ? 'Blaze - Funnel' : 'Blaze - Parcours', desc: isAr ? 'يبني ترتيب الصفحة من الانتباه إلى القرار.' : isEn ? 'Structures the page from attention to decision.' : 'Structure la page de l attention a la decision.', url: 'https://chatgpt.com/g/g-9UB7GVwba-blaze-sales-funnel-bot' },
                { name: isAr ? 'Theo - الصفحة' : isEn ? 'Theo - Landing Page' : 'Theo - Page', desc: isAr ? 'يعيد صياغة العناوين، الأدلة، الضمانات والأزرار.' : isEn ? 'Rewrites headlines, proof, guarantees, and buttons.' : 'Reecrit titres, preuves, garanties et boutons.', url: 'https://chatgpt.com/g/g-M8kw9PpCt-phoebe-logo-generator-gpt' },
                { name: isAr ? 'Sienna - البيع' : isEn ? 'Sienna - Sales' : 'Sienna - Vente', desc: isAr ? 'يحول الاعتراضات إلى عرض أقوى ورسالة أوضح.' : isEn ? 'Turns objections into a stronger offer and clearer message.' : 'Transforme les objections en offre plus forte.', url: 'https://chatgpt.com/g/g-C65BQ6yc0-sienna-strategic-sales-advisor-bot' }
            ]
        },
        audit: {
            icon: 'fa-shield-halved',
            title: isAr ? 'اعرف ما يجب إصلاحه أولا' : isEn ? 'Know what to fix first' : 'Savoir quoi corriger en premier',
            sub: isAr ? 'خبراء لترتيب الأولويات وتقليل المخاطر.' : isEn ? 'Experts to prioritize fixes and reduce risk.' : 'Experts pour prioriser les corrections et reduire les risques.',
            experts: [
                { name: isAr ? 'Sebo - الظهور' : isEn ? 'Sebo - Visibility' : 'Sebo - Visibilite', desc: isAr ? 'يحول التشخيص إلى تحسينات بنية ومحتوى.' : isEn ? 'Turns diagnosis into structure and content improvements.' : 'Transforme le diagnostic en corrections de structure et contenu.', url: 'https://chatgpt.com/g/g-S0N82XvQh-sebo-seo-optimisation-bot' },
                { name: isAr ? 'Ethan - الحلول' : isEn ? 'Ethan - Solutions' : 'Ethan - Solutions', desc: isAr ? 'يختصر كل مشكلة إلى حل عملي واضح.' : isEn ? 'Turns each problem into one clear practical fix.' : 'Ramene chaque probleme a une solution pratique.', url: 'https://chatgpt.com/g/g-ZoxY4cAlC-ethan-problems-solutions-gpt' },
                { name: isAr ? 'Remy - المخاطر' : isEn ? 'Remy - Risk' : 'Remy - Risques', desc: isAr ? 'يكشف ما قد يضر بالثقة أو المبيعات أو الظهور.' : isEn ? 'Finds what can hurt trust, sales, or visibility.' : 'Repere ce qui peut nuire a la confiance ou aux ventes.', url: 'https://chatgpt.com/g/g-v669Na1Im-remy-risk-management-gpt' }
            ]
        },
        social: {
            icon: 'fa-hashtag',
            title: isAr ? 'حوّل الفرص إلى محتوى اجتماعي' : isEn ? 'Turn opportunities into social content' : 'Transformer les opportunités en contenus sociaux',
            sub: isAr ? 'خبراء للمنشورات، الخطافات، وفيسبوك/إنستغرام.' : isEn ? 'Experts for posts, hooks, Facebook, and Instagram.' : 'Experts pour posts, hooks, Facebook et Instagram.',
            experts: [
                { name: isAr ? 'Ava - النمو' : isEn ? 'Ava - Growth' : 'Ava - Croissance', desc: isAr ? 'يبني خطة نمو ومحتوى منتظم.' : isEn ? 'Builds a growth and recurring content plan.' : 'Construit un plan de croissance et contenu regulier.', url: 'https://chatgpt.com/g/g-4QKGXg36k-ava-growth-gpt' },
                { name: isAr ? 'Febo - فيسبوك' : isEn ? 'Febo - Facebook' : 'Febo - Facebook', desc: isAr ? 'يحوّل الزوايا إلى منشورات فيسبوك قابلة للتفاعل.' : isEn ? 'Turns angles into engaging Facebook posts.' : 'Transforme les angles en posts Facebook engageants.', url: 'https://chatgpt.com/g/g-ZeBkBh8Jz-febo-engagement-bot' },
                { name: isAr ? 'Instar - إنستغرام' : isEn ? 'Instar - Instagram' : 'Instar - Instagram', desc: isAr ? 'يحوّل الأفكار إلى محتوى إنستغرام وخطافات.' : isEn ? 'Turns ideas into Instagram content and hooks.' : 'Transforme les idees en contenus Instagram et hooks.', url: 'https://chatgpt.com/g/g-luzqTArlr-instar-growth-bot' }
            ]
        }
    };

    const dock = bySection[section] || bySection.competitors;
    return `
    <section class="expert-dock expert-dock-${safe(section)} fade-in-up" dir="${dir}">
        <div class="expert-dock-head">
            <span class="expert-dock-orb"><i class="fas ${safe(dock.icon)}"></i></span>
            <div>
                <h3>${safe(dock.title)}</h3>
                <p>${safe(dock.sub)}</p>
            </div>
        </div>
        <div class="expert-dock-grid">
            ${dock.experts.map(expert => `
                <a class="expert-card" href="${safe(expert.url)}" target="_blank" rel="noopener noreferrer">
                    <strong>${safe(expert.name)}</strong>
                    <span>${safe(expert.desc)}</span>
                    <small>${safe(labels.openExpert)} <i class="fas fa-arrow-right"></i></small>
                </a>
            `).join('')}
        </div>
    </section>`;
}

function renderGptBotCard(bot) {
    if (!bot) return '';

    return `
        <div class="result-card" style="margin-top: 30px; background: linear-gradient(135deg, rgba(16, 163, 127, 0.1) 0%, rgba(10, 14, 39, 0.95) 100%); border: 1px solid #10a37f; animation: fadeIn 0.5s ease-out;">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
                <div style="background:#10a37f; width:50px; height:50px; border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 15px rgba(16, 163, 127, 0.3);">
                    <i class="fas fa-robot" style="color:white; font-size:1.5rem;"></i>
                </div>
                <div>
                    <h3 style="margin:0; color:white; font-size: 1.1rem;">${bot.name}</h3>
                    <p style="margin:0; color:#10a37f; font-size:0.75rem; font-weight:700; letter-spacing: 1px;">OFFICIAL GPT ASSISTANT</p>
                </div>
            </div>
            <p style="color:var(--text-secondary); margin-bottom:20px; font-size: 0.9rem; line-height: 1.5;">${bot.description}</p>
            <a href="${bot.url}" target="_blank" class="btn" style="background:#10a37f; color: white; border:none; width:100%; text-align:center; display:block; padding: 12px; border-radius: 8px; font-weight: 600; text-decoration: none; transition: transform 0.2s;">
                <i class="fas fa-external-link-alt"></i> Ouvrir l'Assistant de Secours
            </a>
        </div>
    `;
}

  window.renderReportSection = renderReportSection;
  window.getReportFeatureCopy = getReportFeatureCopy;
  window.enhanceReportNavigation = enhanceReportNavigation;
  window.setReportSectionOpen = setReportSectionOpen;
  window.renderExpertDock = renderExpertDock;
  window.renderGptBotCard = renderGptBotCard;
})();
