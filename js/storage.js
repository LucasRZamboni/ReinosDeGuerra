(function () {
  const cfg = window.GAME_CONFIG;
  const storageKey = () => {
    const session = window.RDGAuth?.current();
    // O administrador preserva o save legado/mundo de testes. Cada conta de jogador possui progresso isolado.
    if (!session || session.role === "admin") return cfg.saveKey;
    return `${cfg.saveKey}__${window.RDGAuth.saveSuffix()}`;
  };
  window.GameStorage = {
    save(state) {
      localStorage.setItem(storageKey(), JSON.stringify(state));
    },
    load() {
      try {
        return JSON.parse(localStorage.getItem(storageKey()));
      } catch (_) {
        return null;
      }
    },
    clear() {
      localStorage.removeItem(storageKey());
    },
    export(state) {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "reinos-de-guerra-save.json";
      a.click();
      URL.revokeObjectURL(a.href);
    },
    async import(file) {
      const data = JSON.parse(await file.text());
      if (!data.version || !data.villages) throw new Error("Save inválido");
      return data;
    },
  };
})();
