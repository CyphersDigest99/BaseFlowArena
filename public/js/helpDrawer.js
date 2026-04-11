/**
 * @file helpDrawer.js
 * @description End-user help drawer — slide-out reference panel.
 *
 * Triggered by a floating "?" button in the bottom-left corner. Renders sectioned
 * content (paragraphs, command lists, keyboard shortcut tables) so a new user can
 * quickly learn what BaseFlowArena does and how to drive it.
 *
 * Content lives in the SECTIONS array below. Each section has a title and an
 * ordered list of `blocks` that the renderer walks. The same data shape can later
 * be consumed by an onboarding/welcome tour.
 *
 * NOTE: A separate dev-facing changelog sidebar (for tracking shipped features as
 * the project grows) is planned but lives elsewhere — this drawer stays end-user
 * focused.
 */

const COLLAPSE_KEY = 'baseflowarena-help-collapse';

// ── Content ──────────────────────────────────────────────────────────────────
// Block types:
//   { type: 'p',        text: '...' }                                  → paragraph
//   { type: 'note',     text: '...' }                                  → highlighted note
//   { type: 'cmd-list', items: [{ cmd, desc }, ...] }                  → voice command rows
//   { type: 'kbd-list', items: [{ keys: ['R'], desc: '...' }, ...] }   → key shortcut rows
//   { type: 'ul',       items: ['...', '...'] }                        → bullet list

const SECTIONS = [
    {
        id: 'voice-commands',
        title: 'Voice Commands',
        blocks: [
            { type: 'p', text: 'Voice commands let you interact with the app hands-free while in voice match mode. Speak the phrase clearly and the app will trigger the matching action instead of treating it as a word match.' },
            { type: 'cmd-list', items: [
                { cmd: 'next word',       desc: 'Skip to the next word' },
                { cmd: 'blacklist',       desc: 'Permanently exclude the current word and advance' },
                { cmd: 'show rhymes',     desc: 'Switch matched-word reward to rhyme navigation' },
                { cmd: 'hide rhymes',     desc: 'Return to random-word reward on a match' },
                { cmd: 'show definition', desc: 'Pin the definition + synonyms for the current word' },
            ]},
            { type: 'note', text: 'Press SPACE to toggle voice match mode on or off.' },
        ],
    },
    {
        id: 'word-navigation',
        title: 'Word Navigation',
        blocks: [
            { type: 'p', text: 'Step through words with the arrow keys, or jump into a focused mode to explore how words relate to each other.' },
            { type: 'ul', items: [
                'Rhyme navigation — find phonetic neighbors for the current word',
                'Prefix search (S) — find words that start with the same letters',
                'Suffix search (D) — find words that end with the same letters',
                'Syllable filter — limit the pool to words of a specific length',
                'Sort modes — random, sequential, alphabetical, or phonetic-by-spelling',
            ]},
            { type: 'p', text: 'The point is fast lateral movement: pick any word, then explore the words around it from a different angle.' },
        ],
    },
    {
        id: 'beats-bpm',
        title: 'Beats & BPM',
        blocks: [
            { type: 'p', text: 'Pick a beat from the player at the bottom of the screen. Auto-BPM detection reads the tempo and aligns the timed word cycle to it. Use the volume slider to mix the beat under your voice.' },
        ],
    },
    {
        id: 'rhymes',
        title: 'Rhymes',
        blocks: [
            { type: 'p', text: 'BaseFlowArena uses a custom rhyme engine. Every rhyme finder out there does it differently — this one is mine. Stressed-vowel matches are weighted highest, with tail-coverage dampening to filter false positives.' },
            { type: 'p', text: 'Press R to open the rhyme finder. You can rate, pin, or reject any rhyme. Rejections are logged so the engine can be tuned over time.' },
            { type: 'note', text: 'This is a work in progress and there will be imperfections. Feedback is appreciated.' },
        ],
    },
    {
        id: 'word-lists',
        title: 'Word Lists',
        blocks: [
            { type: 'p', text: 'The default list ships with 19,000+ common words. You can also upload your own .txt file (one word per line) via the word list editor — handy for genre-specific vocab, names, slang, or anything you want to drill.' },
            { type: 'p', text: 'Blacklist words you don\'t want to see again with B, or favorite words you love with F.' },
        ],
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        blocks: [
            { type: 'p', text: 'The goal: expound on any word — definition, synonyms, rhymes, etymology — with just a few keypresses.' },
            { type: 'kbd-list', items: [
                { keys: ['Space'],   desc: 'Toggle voice match mode' },
                { keys: ['←'],       desc: 'Previous word' },
                { keys: ['→'],       desc: 'Next word' },
                { keys: ['↑'],       desc: 'Previous rhyme' },
                { keys: ['↓'],       desc: 'Next rhyme' },
                { keys: ['R'],       desc: 'Open rhyme finder' },
                { keys: ['B'],       desc: 'Blacklist current word' },
                { keys: ['F'],       desc: 'Favorite current word' },
                { keys: ['S'],       desc: 'Prefix search (starts with…)' },
                { keys: ['D'],       desc: 'Suffix / reverse search (ends with…)' },
            ]},
        ],
    },
];

// ── Storage helpers ──────────────────────────────────────────────────────────
function loadCollapseState() {
    try {
        const raw = localStorage.getItem(COLLAPSE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveCollapseState(state) {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch {}
}

// ── Block renderers ──────────────────────────────────────────────────────────
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderBlock(block) {
    switch (block.type) {
        case 'p':
            return `<p class="help-p">${escapeHtml(block.text)}</p>`;
        case 'note':
            return `<div class="help-note">${escapeHtml(block.text)}</div>`;
        case 'ul': {
            const items = block.items.map(t => `<li>${escapeHtml(t)}</li>`).join('');
            return `<ul class="help-ul">${items}</ul>`;
        }
        case 'cmd-list': {
            const rows = block.items.map(item => `
                <div class="help-cmd-row">
                    <span class="help-cmd">"${escapeHtml(item.cmd)}"</span>
                    <span class="help-cmd-desc">${escapeHtml(item.desc)}</span>
                </div>
            `).join('');
            return `<div class="help-cmd-list">${rows}</div>`;
        }
        case 'kbd-list': {
            const rows = block.items.map(item => {
                const keys = item.keys.map(k => `<kbd class="help-kbd">${escapeHtml(k)}</kbd>`).join(' ');
                return `
                    <div class="help-kbd-row">
                        <span class="help-kbd-keys">${keys}</span>
                        <span class="help-kbd-desc">${escapeHtml(item.desc)}</span>
                    </div>
                `;
            }).join('');
            return `<div class="help-kbd-list">${rows}</div>`;
        }
        default:
            return '';
    }
}

// ── Build section markup ─────────────────────────────────────────────────────
function buildSection(section, collapseState) {
    const isOpen = collapseState[section.id] !== false; // default open

    const wrap = document.createElement('div');
    wrap.className = 'help-section';
    wrap.dataset.sectionId = section.id;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'help-section-header';
    header.innerHTML = `
        <span class="help-section-title">${escapeHtml(section.title)}</span>
        <span class="help-section-arrow">${isOpen ? '▲' : '▼'}</span>
    `;

    const body = document.createElement('div');
    body.className = 'help-section-body';
    if (!isOpen) body.style.display = 'none';
    body.innerHTML = section.blocks.map(renderBlock).join('');

    header.addEventListener('click', () => {
        const nowOpen = body.style.display === 'none';
        body.style.display = nowOpen ? '' : 'none';
        header.querySelector('.help-section-arrow').textContent = nowOpen ? '▲' : '▼';
        const cs = loadCollapseState();
        cs[section.id] = nowOpen;
        saveCollapseState(cs);

        // When expanding, scroll the section into view if its body spills past
        // the bottom of the drawer — keeps the newly revealed content visible.
        if (nowOpen) {
            const container = wrap.closest('.help-drawer-sections');
            if (container) {
                requestAnimationFrame(() => {
                    const wrapRect = wrap.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    if (wrapRect.bottom <= containerRect.bottom) return;
                    const sectionTaller = wrapRect.height >= containerRect.height - 16;
                    const scrollDelta = sectionTaller
                        ? wrapRect.top - containerRect.top - 4
                        : wrapRect.bottom - containerRect.bottom + 8;
                    container.scrollBy({ top: scrollDelta, behavior: 'smooth' });
                });
            }
        }
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
}

// ── Build entire drawer ──────────────────────────────────────────────────────
function buildDrawer() {
    const collapseState = loadCollapseState();

    // Floating trigger button
    const trigger = document.createElement('button');
    trigger.id = 'help-drawer-trigger';
    trigger.type = 'button';
    trigger.title = 'Help';
    trigger.setAttribute('aria-label', 'Open help');
    trigger.textContent = '?';

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'help-drawer-backdrop';

    // Drawer panel
    const drawer = document.createElement('aside');
    drawer.id = 'help-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    // Header
    const header = document.createElement('div');
    header.className = 'help-drawer-header';
    header.innerHTML = `
        <span class="help-drawer-title">HELP</span>
        <button type="button" class="help-drawer-close" aria-label="Close">✕</button>
    `;

    // Sections container
    const sectionsWrap = document.createElement('div');
    sectionsWrap.className = 'help-drawer-sections';
    SECTIONS.forEach(section => {
        sectionsWrap.appendChild(buildSection(section, collapseState));
    });

    // Footer
    const footer = document.createElement('div');
    footer.className = 'help-drawer-footer';
    footer.innerHTML = `<div class="help-drawer-foot-meta">BaseFlowArena</div>`;

    drawer.appendChild(header);
    drawer.appendChild(sectionsWrap);
    drawer.appendChild(footer);

    return { trigger, backdrop, drawer };
}

// ── Open / close ─────────────────────────────────────────────────────────────
function openDrawer() {
    document.getElementById('help-drawer')?.classList.add('open');
    document.getElementById('help-drawer-backdrop')?.classList.add('open');
    document.getElementById('help-drawer')?.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    document.getElementById('help-drawer')?.classList.remove('open');
    document.getElementById('help-drawer-backdrop')?.classList.remove('open');
    document.getElementById('help-drawer')?.setAttribute('aria-hidden', 'true');
}

// ── Public init ──────────────────────────────────────────────────────────────
export function init() {
    if (document.getElementById('help-drawer')) return; // Already initialized

    const { trigger, backdrop, drawer } = buildDrawer();
    document.body.appendChild(trigger);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    trigger.addEventListener('click', openDrawer);
    backdrop.addEventListener('click', closeDrawer);
    drawer.querySelector('.help-drawer-close')?.addEventListener('click', closeDrawer);

    // ESC closes
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeDrawer();
        }
    });
}
