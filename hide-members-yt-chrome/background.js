// background.js  ©2025 You — MIT

const ON  = {16: 'icons/16.png',  32: 'icons/32.png',  48: 'icons/48.png'};
const OFF = {16: 'icons/16-off.png', 32: 'icons/32-off.png', 48: 'icons/48-off.png'};

/** Refresh the browser-action UI everywhere. */
async function updateActionUI(isEnabled, tabId = undefined) {
  const title = `Hide Members-only videos (${isEnabled ? 'ON' : 'OFF'})`;
  const path  = isEnabled ? ON : OFF;

  // 1. Per-tab (if we know which tab was clicked)
  if (tabId !== undefined) {
    await chrome.action.setIcon ({tabId, path});
    await chrome.action.setTitle({tabId, title});
  }

  // 2. Fallback global default (covers new windows, other tabs, etc.)
  await chrome.action.setIcon ({path});
  await chrome.action.setTitle({title});
}

/** Ensure a flag exists after install/update. */
chrome.runtime.onInstalled.addListener(async () => {
  const {enabled} = await chrome.storage.local.get('enabled');
  if (enabled === undefined) await chrome.storage.local.set({enabled: true});
});

/** Restore icon after the browser (or service-worker) starts. */
chrome.runtime.onStartup.addListener(async () => {
  const {enabled} = await chrome.storage.local.get('enabled');
  await updateActionUI(enabled === undefined ? true : enabled);
});

chrome.action.onClicked.addListener(async (tab) => {
  const { enabled } = await chrome.storage.local.get('enabled');
  const newState = !(enabled !== false);          // undefined ⇒ true

  await chrome.storage.local.set({ enabled: newState });
  await updateActionUI(newState, tab.id);

  /* ─► NEW: tell every open YouTube tab right now ◄─ */
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, tabs => {
    for (const t of tabs) chrome.tabs.sendMessage(t.id, { enabled: newState });
  });
});
