const KEY = "hz-watched";

/** Per-visitor "watched" ticks, saved in this browser. Never throws if storage is blocked. */
export function createWatched(storage = globalThis.localStorage) {
  let ids = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? "[]");
    if (Array.isArray(saved)) ids = new Set(saved);
  } catch { /* blocked or corrupt: start empty */ }

  const save = () => {
    try { storage?.setItem(KEY, JSON.stringify([...ids])); } catch { /* keep in memory only */ }
  };

  return {
    has: (id) => ids.has(id),
    mark(id) { ids.add(id); save(); },
    toggle(id) {
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      save();
      return ids.has(id);
    },
  };
}
