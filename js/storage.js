(function () {
  const cfg = window.GAME_CONFIG;
  window.GameStorage = {
    save(state) {
      localStorage.setItem(cfg.saveKey, JSON.stringify(state));
    },
    load() {
      try {
        return JSON.parse(localStorage.getItem(cfg.saveKey));
      } catch (_) {
        return null;
      }
    },
    clear() {
      localStorage.removeItem(cfg.saveKey);
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
