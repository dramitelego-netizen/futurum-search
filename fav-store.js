/** Персональное избранное: localStorage + сервер по анонимному id */
(function (global) {
  const FAV_KEY = "futurum_favs";
  const UID_KEY = "futurum_uid";

  function uid() {
    try {
      let id = localStorage.getItem(UID_KEY);
      if (id && /^[a-zA-Z0-9_-]{8,64}$/.test(id)) return id;
      id =
        (global.crypto && crypto.randomUUID && crypto.randomUUID().replace(/-/g, "")) ||
        `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(UID_KEY, id);
      return id;
    } catch {
      return `tmp${Date.now().toString(36)}`;
    }
  }

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return new Set(
        (Array.isArray(raw) ? raw : []).map(Number).filter((n) => Number.isFinite(n))
      );
    } catch {
      return new Set();
    }
  }

  function saveLocal(set) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }

  async function pullServer() {
    try {
      const res = await fetch(`/api/favs?uid=${encodeURIComponent(uid())}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const ids = Array.isArray(data.ids) ? data.ids : [];
      return new Set(ids.map(Number).filter((n) => Number.isFinite(n)));
    } catch {
      return null;
    }
  }

  async function pushServer(set) {
    try {
      await fetch("/api/favs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid(), ids: [...set] }),
      });
    } catch {
      /* offline — остаётся localStorage */
    }
  }

  function merge(a, b) {
    const out = new Set(a);
    for (const x of b) out.add(x);
    return out;
  }

  async function sync(localSet) {
    const remote = await pullServer();
    if (!remote) {
      saveLocal(localSet);
      await pushServer(localSet);
      return localSet;
    }
    const merged = merge(localSet, remote);
    saveLocal(merged);
    await pushServer(merged);
    return merged;
  }

  global.FavStore = {
    uid,
    loadLocal,
    saveLocal,
    pushServer,
    sync,
  };
})(typeof window !== "undefined" ? window : globalThis);
