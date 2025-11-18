/* 1 ▸ CONSTANTS */

const BADGE_SELECTOR =
  '.badge.badge-style-type-members-only,' +
  '.badge[aria-label*="Members" i],' +
  'ytd-badge-supported-renderer .badge-style-type-members-only,' +
  'ytd-badge-supported-renderer .badge[aria-label*="Members" i],' +
  'p.style-scope.ytd-badge-supported-renderer,' +
  '.badge-shape-wiz__text,' +
  '.yt-badge-shape__text';

const MEDIA_SELECTOR = [
  'ytd-rich-grid-media',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'yt-lockup-view-model',
  'ytd-reel-item-renderer'
].join(',');

const WRAPPER_SELECTOR =
  'ytd-rich-item-renderer,' +
  'ytd-rich-grid-row,' +
  MEDIA_SELECTOR;

// Text patterns that indicate members-only content
const MEMBERS_TEXT_PATTERNS = [
  /members\s*only/i,
  /members\s*first/i,
  /for\s+members/i,
  /available\s+to\s+members/i
];

/* 2 ▸ HELPERS */

function isMembersBadge(node) {
  const text = (node.textContent || '').trim();
  const label = (node.getAttribute && node.getAttribute('aria-label')) || '';

  if (node.classList && node.classList.contains('badge-style-type-members-only')) return true;
  if (label && MEMBERS_TEXT_PATTERNS.some(rx => rx.test(label))) return true;
  if (text && MEMBERS_TEXT_PATTERNS.some(rx => rx.test(text))) return true;

  return false;
}

function hideWrapper(wrapper) {
  if (!wrapper || wrapper.dataset.membersHidden) return;
  wrapper.dataset.originalDisplay = wrapper.style.display || '';
  wrapper.style.display = 'none';
  wrapper.dataset.membersHidden = 'true';
}

function findWrapper(badge) {
  let wrapper =
    badge.closest('ytd-rich-item-renderer') ||
    badge.closest('ytd-rich-grid-row') ||
    badge.closest(MEDIA_SELECTOR);

  if (!wrapper) wrapper = badge.closest('yt-lockup-view-model');
  if (!wrapper) wrapper = badge.closest('#contents > *');

  return wrapper;
}

function hideMembersOnly(scope = document) {
  const root = scope.nodeType === 1 || scope.shadowRoot ? scope : document;
  const searchRoot = root.shadowRoot || root;
  const badges = searchRoot.querySelectorAll(BADGE_SELECTOR);

  for (const badge of badges) {
    if (!isMembersBadge(badge)) continue;
    const wrapper = findWrapper(badge);
    hideWrapper(wrapper);
  }
}

function revealAll() {
  document.querySelectorAll('[data-membersHidden="true"]').forEach(el => {
    el.style.display = el.dataset.originalDisplay || '';
    el.removeAttribute('data-membersHidden');
    el.removeAttribute('data-originalDisplay');
  });
}

function injectCSSOnce() {
  if (document.getElementById('members-only-hide-style')) return;
  if (!(window.CSS && CSS.supports && CSS.supports('selector(:has(*))'))) return;

  // Only target the old dedicated members-only badge class
  const css = `
    ytd-rich-grid-media:has(.badge-style-type-members-only),
    ytd-video-renderer:has(.badge-style-type-members-only),
    ytd-compact-video-renderer:has(.badge-style-type-members-only),
    ytd-grid-video-renderer:has(.badge-style-type-members-only),
    yt-lockup-view-model:has(.badge-style-type-members-only),
    ytd-reel-item-renderer:has(.badge-style-type-members-only) {
      display: none !important;
    }
  `;

  const style = document.createElement('style');
  style.id = 'members-only-hide-style';
  style.textContent = css;
  document.documentElement.appendChild(style);
}

/* 3 ▸ TOGGLE MACHINERY */

let enabled = true;
let observer = null;

function start() {
  if (observer) return;

  injectCSSOnce();
  hideMembersOnly();

  observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;

          const localScope =
            (node.closest && (node.closest(WRAPPER_SELECTOR) || node)) || node;

          hideMembersOnly(localScope);

          if (node.shadowRoot) hideMembersOnly(node.shadowRoot);
        }
      } else if (m.type === 'attributes' || m.type === 'characterData') {
        const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
        if (!el) continue;

        const scope =
          (el.closest && (el.closest(WRAPPER_SELECTOR) || el)) ||
          document;

        hideMembersOnly(scope);

        if (el.shadowRoot) hideMembersOnly(el.shadowRoot);
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'hidden', 'class']
  });
}

function stop() {
  if (observer) observer.disconnect();
  observer = null;
  revealAll();
}

try {
  chrome.storage.local.get('enabled').then(({ enabled: stored }) => {
    enabled = stored !== false;
    enabled ? start() : stop();
  });
} catch (e) {
  enabled = true;
  start();
}

chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes.enabled) return;
  const newVal = changes.enabled.newValue !== false;
  if (newVal === enabled) return;

  enabled = newVal;
  enabled ? start() : stop();
});

chrome.runtime.onMessage?.addListener(({ enabled: flag }) => {
  if (typeof flag !== 'boolean' || flag === enabled) return;
  enabled = flag;
  enabled ? start() : stop();
});

/* 4 ▸ SPA NAVIGATION SUPPORT */

window.addEventListener('yt-navigate-finish', () => {
  if (!enabled) return;
  queueMicrotask(() => hideMembersOnly());
  setTimeout(hideMembersOnly, 250);
  setTimeout(hideMembersOnly, 1500);
});
