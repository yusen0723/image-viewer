const STORAGE_KEY = "siteSettings";
const modeEl = document.querySelector("#mode");
const patternsEl = document.querySelector("#patterns");
const saveEl = document.querySelector("#save");
const statusEl = document.querySelector("#status");

init();

function init() {
  chrome.storage.sync.get(
    {
      [STORAGE_KEY]: {
        mode: "whitelist",
        patterns: ["xiaohongshu.com"]
      }
    },
    (result) => {
      const settings = result[STORAGE_KEY];
      modeEl.value = settings.mode || "whitelist";
      patternsEl.value = (settings.patterns || []).join("\n");
    }
  );

  saveEl.addEventListener("click", save);
}

function save() {
  const payload = {
    mode: modeEl.value,
    patterns: patternsEl.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };

  chrome.storage.sync.set({ [STORAGE_KEY]: payload }, () => {
    statusEl.textContent = "已保存";
    window.setTimeout(() => {
      statusEl.textContent = "";
    }, 1500);
  });
}
