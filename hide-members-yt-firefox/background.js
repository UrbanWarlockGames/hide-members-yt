const ON  = { 16: "icons/16.png",  32: "icons/32.png",  48: "icons/48.png" };
const OFF = { 16: "icons/16-off.png", 32: "icons/32-off.png", 48: "icons/48-off.png" };

/* Use the promise-flavoured API if available, otherwise fall back. */
const api = (typeof browser !== "undefined") ? browser : chrome;

/* Helper to update title + icon in the active tab *and* globally. */
async function refreshUI(enabled, tabId) {
  const title = `Hide Members-only videos (${enabled ? "ON" : "OFF"})`;
  const path  = enabled ? ON : OFF;

  if (tabId !== undefined) {
    await api.action.setTitle({ title, tabId });
    await api.action.setIcon ({ path,  tabId });
  }
  await api.action.setTitle({ title });
  await api.action.setIcon ({ path  });
}

/* First-run: create the flag if it doesn’t exist. */
api.runtime.onInstalled.addListener(async () => {
  const { enabled } = await api.storage.local.get("enabled");
  if (enabled === undefined) await api.storage.local.set({ enabled: true });
});

/* Browser start-up: paint correct icon in every window. */
api.runtime.onStartup.addListener(async () => {
  const { enabled } = await api.storage.local.get("enabled");
  await refreshUI(enabled !== false);
});

/* Toolbar click: flip flag, update UI, broadcast to live tabs. */
api.action.onClicked.addListener(async (tab) => {
  const { enabled } = await api.storage.local.get("enabled");
  const newState = !(enabled !== false);          // undefined ⇒ true

  await api.storage.local.set({ enabled: newState });
  await refreshUI(newState, tab.id);

  /* Instant message so content scripts react without refresh. */
  const ytTabs = await api.tabs.query({ url: "*://*.youtube.com/*" });
  ytTabs.forEach(t => api.tabs.sendMessage(t.id, { enabled: newState }));
});
