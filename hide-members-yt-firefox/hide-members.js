/* 1 ▸ CONSTANTS ───────────────────────────────────────────────────── */

const BADGE_SELECTOR =
  '.badge-style-type-members-only,' +
  'ytd-badge-supported-renderer[aria-label="Members only"],' +
  'p.style-scope.ytd-badge-supported-renderer';

const MEDIA_SELECTOR = [
  'ytd-rich-grid-media',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer'
].join(',');

const WRAPPER_SELECTOR =
  'ytd-rich-item-renderer,' +
  'ytd-rich-grid-row,' +
  MEDIA_SELECTOR;

/* 2 ▸ CORE ACTIONS ───────────────────────────────────────────────── */

/** Hide every Members-only wrapper inside *scope*. */
function hideMembersOnly(scope = document) {
  scope.querySelectorAll(BADGE_SELECTOR).forEach(badge => {
	const badgeText = badge.textContent?.trim();
	const genuine =
	  badge.classList.contains('badge-style-type-members-only') ||
	  badge.getAttribute('aria-label') === 'Members only' ||
	  badgeText === 'Members only' ||
	  badgeText === 'Members first';

    if (!genuine) return;

    const wrapper =
      badge.closest('ytd-rich-item-renderer') ||
      badge.closest('ytd-rich-grid-row') ||
      badge.closest(MEDIA_SELECTOR);

    if (wrapper && !wrapper.dataset.membersHidden) {
      /* Remember original display so we can restore it faithfully. */
      wrapper.dataset.originalDisplay = wrapper.style.display || '';
      wrapper.style.display = 'none';
      wrapper.dataset.membersHidden = 'true';
    }
  });
}

/** Undo every previous hide so the grid looks as if nothing happened. */
function revealAll() {
  document.querySelectorAll('[data-membersHidden="true"]').forEach(el => {
    el.style.display = el.dataset.originalDisplay;
    el.removeAttribute('data-membersHidden');
    el.removeAttribute('data-original-display');
  });
}

/* 3 ▸ TOGGLE MACHINERY ───────────────────────────────────────────── */

let enabled  = true;   // until we read storage
let observer = null;   // MutationObserver handle

function start() {
  if (observer) return;           // already active
  hideMembersOnly();
  observer = new MutationObserver(m => {
    m.forEach(rec =>
      rec.addedNodes.forEach(n =>
        n.nodeType === 1 && hideMembersOnly(n)
      )
    );
  });
  observer.observe(document, { childList: true, subtree: true });
}

function stop() {
  observer?.disconnect();
  observer = null;
  revealAll();
}

/* 3a ▸ sync with stored flag once at load. */
chrome.storage.local.get('enabled').then(({ enabled: stored }) => {
  enabled = stored !== false;     // undefined ⇒ true
  enabled ? start() : stop();
});

/* 3b ▸ react to every subsequent change (set in background.js). */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.enabled) return;
  const newVal = changes.enabled.newValue !== false;
  if (newVal === enabled) return; // no-op

  enabled = newVal;
  enabled ? start() : stop();
});

/* 3c ▸ instant reaction to live broadcast from background.js */
chrome.runtime.onMessage.addListener(({ enabled: flag }) => {
  if (typeof flag !== 'boolean' || flag === enabled) return;
  enabled = flag;
  enabled ? start() : stop();
});

/* 4 ▸ SPA NAVIGATION SUPPORT ─────────────────────────────────────── */

window.addEventListener('yt-navigate-finish', () => {
  if (enabled) setTimeout(hideMembersOnly, 0);
});
