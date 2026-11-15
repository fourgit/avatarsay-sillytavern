/**
 * AvatarSay RPG NPC & Voice Bark — SillyTavern Third-Party UI Extension
 * Install URL: https://github.com/fourgit/avatarsay-sillytavern
 * Remote MCP Server: https://avatarsay.com/mcp (Streamable HTTP, CORS *)
 */

(function initAvatarSayExtension() {
  const EXTENSION_KEY = "avatarsay";
  const MCP_URL = "https://avatarsay.com/mcp";
  const MCP_VERSION = "2025-06-18";

  const STYLES = [
    { id: "fantasy", label: "Fantasy Illustration" },
    { id: "anime", label: "Anime" },
    { id: "3d-cartoon", label: "3D Cartoon" },
    { id: "pixel-art", label: "16-Bit Pixel Art" },
    { id: "watercolor", label: "Storybook Watercolor" },
    { id: "cyberpunk", label: "Cyberpunk" },
    { id: "realistic", label: "Cinematic Realistic" },
    { id: "professional-headshot", label: "Studio Portrait" },
  ];

  const VOICES = [
    { id: "Friendly_Person", label: "Friendly Person" },
    { id: "Wise_Woman", label: "Wise Woman" },
    { id: "Lively_Girl", label: "Lively Girl" },
    { id: "Calm_Woman", label: "Calm Woman" },
    { id: "Casual_Guy", label: "Casual Guy" },
    { id: "Deep_Voice_Man", label: "Deep Voice Man" },
    { id: "Patient_Man", label: "Patient Man" },
    { id: "Young_Knight", label: "Young Knight" },
  ];

  const EMOTIONS = ["neutral", "happy", "angry", "sad", "fearful", "surprised"];

  let rpcId = 1;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugifyFilename(name) {
    return (
      String(name || "avatarsay-npc")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "avatarsay-npc"
    );
  }

  /**
   * Call an AvatarSay MCP tool over JSON-RPC 2.0 Streamable HTTP.
   */
  async function callAvatarSayMcp(toolName, args = {}, apiKey = "") {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "MCP-Protocol-Version": MCP_VERSION,
    };
    const trimmed = String(apiKey || "").trim();
    if (trimmed) {
      headers["Authorization"] = `Bearer ${trimmed}`;
    }

    const res = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId++,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) {
      throw new Error(`AvatarSay MCP HTTP ${res.status}`);
    }
    if (payload.error) {
      throw new Error(payload.error.message || "AvatarSay MCP RPC error");
    }
    const result = payload.result;
    if (result?.isError) {
      const msg =
        result?.structuredContent?.error?.message ||
        result?.content?.[0]?.text ||
        "AvatarSay tool call failed";
      throw new Error(msg);
    }
    if (result?.structuredContent) {
      return result.structuredContent;
    }
    const textBlock = result?.content?.find((item) => item?.type === "text")?.text;
    if (textBlock) {
      const start = textBlock.indexOf("{");
      if (start >= 0) return JSON.parse(textBlock.slice(start));
    }
    return result;
  }

  /**
   * Load SillyTavern host APIs from ../../../extensions.js and ../../../../script.js
   * with graceful fallback to global SillyTavern.getContext().
   */
  async function loadSillyTavernBridge() {
    const bridge = {
      extensionSettings: {},
      getContext: () => globalThis.SillyTavern?.getContext?.() || null,
      saveSettingsDebounced: () => {
        globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced?.();
      },
      getRequestHeaders: () => {
        const ctx = globalThis.SillyTavern?.getContext?.();
        if (ctx?.getRequestHeaders) return ctx.getRequestHeaders();
        return {};
      },
      getCharacters: async () => {
        const ctx = globalThis.SillyTavern?.getContext?.();
        if (ctx?.getCharacters) return ctx.getCharacters();
      },
      processDroppedFiles: null,
    };

    try {
      const extMod = await import("../../../extensions.js");
      if (extMod?.extension_settings) bridge.extensionSettings = extMod.extension_settings;
      if (extMod?.getContext) bridge.getContext = extMod.getContext;
    } catch {
      const ctx = bridge.getContext();
      if (ctx?.extensionSettings) bridge.extensionSettings = ctx.extensionSettings;
    }

    try {
      const scriptMod = await import("../../../../script.js");
      if (scriptMod?.saveSettingsDebounced) bridge.saveSettingsDebounced = scriptMod.saveSettingsDebounced;
      if (scriptMod?.getRequestHeaders) bridge.getRequestHeaders = scriptMod.getRequestHeaders;
      if (scriptMod?.getCharacters) bridge.getCharacters = scriptMod.getCharacters;
      if (scriptMod?.processDroppedFiles) bridge.processDroppedFiles = scriptMod.processDroppedFiles;
    } catch {
      // Fallback uses getContext() methods wired above
    }

    if (!bridge.extensionSettings[EXTENSION_KEY]) {
      bridge.extensionSettings[EXTENSION_KEY] = {
        apiKey: "",
        defaultStyle: "fantasy",
      };
    }
    return bridge;
  }

  function buildMultipartHeaders(bridge) {
    let raw = {};
    try {
      raw = { ...(bridge.getRequestHeaders?.({ omitContentType: true }) || {}) };
    } catch {
      raw = { ...(bridge.getRequestHeaders?.() || {}) };
    }
    delete raw["Content-Type"];
    delete raw["content-type"];
    return raw;
  }

  function triggerBrowserDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadCardJson(cardV2, npcName) {
    const filename = `${slugifyFilename(npcName)}.json`;
    const blob = new Blob([JSON.stringify(cardV2, null, 2)], { type: "application/json" });
    triggerBrowserDownload(blob, filename);
  }

  /**
   * One-click import of a SillyTavern Character Card V2 JSON directly into SillyTavern
   * via POST /api/characters/import (with getCharacters() refresh).
   */
  async function importCardIntoSillyTavern(cardV2, npcName, bridge) {
    const filename = `${slugifyFilename(npcName)}.json`;
    const jsonBytes = JSON.stringify(cardV2, null, 2);
    const file = new File([jsonBytes], filename, { type: "application/json" });

    const formData = new FormData();
    formData.append("avatar", file, filename);
    formData.append("file_type", "json");

    const response = await fetch("/api/characters/import", {
      method: "POST",
      headers: buildMultipartHeaders(bridge),
      body: formData,
    });

    if (!response.ok) {
      if (typeof bridge.processDroppedFiles === "function") {
        await bridge.processDroppedFiles([file]);
        return { method: "processDroppedFiles", fileName: filename };
      }
      const errText = await response.text().catch(() => "");
      throw new Error(`Character import HTTP ${response.status}${errText ? `: ${errText.slice(0, 120)}` : ""}`);
    }

    const data = await response.json().catch(() => ({}));
    await bridge.getCharacters?.();
    return { method: "api", fileName: data?.file_name || filename };
  }

  /**
   * Apply a generated 1024px portrait URL to the currently selected SillyTavern character,
   * or trigger a direct PNG download if no character is currently open.
   */
  async function applyOrDownloadPortrait(imageUrl, npcName, bridge) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Portrait fetch failed (${imgRes.status})`);
    const blob = await imgRes.blob();

    const ctx = bridge.getContext?.();
    const activeChar =
      ctx && ctx.characterId !== undefined && ctx.characters ? ctx.characters[ctx.characterId] : null;

    if (activeChar?.avatar) {
      const formData = new FormData();
      formData.append("avatar", new File([blob], "portrait.png", { type: blob.type || "image/png" }));
      formData.append("avatar_url", activeChar.avatar);
      const editRes = await fetch("/api/characters/edit-avatar", {
        method: "POST",
        headers: buildMultipartHeaders(bridge),
        body: formData,
      });
      if (editRes.ok) {
        await bridge.getCharacters?.();
        return { appliedTo: activeChar.name || activeChar.avatar };
      }
    }

    triggerBrowserDownload(blob, `${slugifyFilename(npcName)}-portrait.png`);
    return { appliedTo: null };
  }

  async function pollPortraitJob(jobId, apiKey, onTick) {
    for (let i = 1; i <= 30; i++) {
      onTick?.(`Generating 2x 1024px portraits... (${i}/30)`);
      await new Promise((r) => setTimeout(r, 2500));
      const job = await callAvatarSayMcp("get_job", { jobId }, apiKey);
      if (job?.status === "succeeded" && Array.isArray(job.outputs) && job.outputs.length > 0) {
        return job;
      }
      if (job?.status === "failed") {
        throw new Error(job?.error?.message || "Portrait job failed (credits auto-refunded).");
      }
    }
    throw new Error("Timed out waiting for portrait job.");
  }

  function notifyToast(type, message) {
    if (globalThis.toastr && typeof globalThis.toastr[type] === "function") {
      globalThis.toastr[type](message, "AvatarSay");
    }
  }

  async function mountSettingsPanel() {
    if (typeof document === "undefined") return;
    if (document.getElementById("avatarsay_extension_panel")) return;

    const host =
      document.querySelector("#extensions_settings2") || document.querySelector("#extensions_settings");
    if (!host) return;

    const bridge = await loadSillyTavernBridge();
    const settings = bridge.extensionSettings[EXTENSION_KEY];

    const styleOpts = STYLES.map(
      (s) =>
        `<option value="${s.id}" ${s.id === (settings.defaultStyle || "fantasy") ? "selected" : ""}>${escapeHtml(s.label)}</option>`,
    ).join("");
    const voiceOpts = VOICES.map((v) => `<option value="${v.id}">${escapeHtml(v.label)}</option>`).join("");
    const emotionOpts = EMOTIONS.map(
      (e) => `<option value="${e}">${e.charAt(0).toUpperCase() + e.slice(1)}</option>`,
    ).join("");

    const wrapper = document.createElement("div");
    wrapper.id = "avatarsay_extension_panel";
    wrapper.className = "avatarsay-st-panel";
    wrapper.innerHTML = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>AvatarSay RPG NPC &amp; Voice Bark</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content avatarsay-st-body">
          <p class="avatarsay-st-note">
            Roll deterministic RPG / D&amp;D NPC cards for <strong>0 credits (no API key)</strong> and one-click import into SillyTavern.
            Add an optional <a href="https://avatarsay.com/dashboard" target="_blank" rel="noopener">AvatarSay API key</a>
            (30 free credits on sign-up) for &lt;3s MP3 barks &amp; 1024px portraits.
          </p>

          <div class="avatarsay-st-grid">
            <label>Art Style
              <select class="text_pole" data-avs="style">${styleOpts}</select>
            </label>
            <label>Presentation
              <select class="text_pole" data-avs="gender">
                <option value="">Any</option>
                <option value="f">Feminine</option>
                <option value="m">Masculine</option>
              </select>
            </label>
            <label>Ancestry (optional)
              <input type="text" class="text_pole" data-avs="ancestry" placeholder="e.g. Elven, Dwarven, Tiefling" maxlength="60" />
            </label>
            <label>Role / Archetype (optional)
              <input type="text" class="text_pole" data-avs="role" placeholder="e.g. Tavern keeper, Runesmith" maxlength="80" />
            </label>
            <label>Seed (optional)
              <input type="text" class="text_pole" data-avs="seed" placeholder="Blank = random seed" maxlength="32" />
            </label>
            <label>API Key (<code>avs_...</code>, optional)
              <input type="password" class="text_pole" data-avs="apikey" value="${escapeHtml(settings.apiKey || "")}" placeholder="avs_... for barks &amp; portraits" autocomplete="off" />
            </label>
          </div>

          <div class="avatarsay-st-row">
            <button type="button" class="menu_button menu_button_icon" data-avs-act="roll">
              <i class="fa-solid fa-dice-d20"></i>
              <span>Roll NPC Card (0 Credits)</span>
            </button>
            <button type="button" class="menu_button menu_button_icon" data-avs-act="roll-import">
              <i class="fa-solid fa-user-plus"></i>
              <span>Roll &amp; 1-Click Import</span>
            </button>
          </div>

          <div class="avatarsay-st-status" data-avs="status">Ready — roll an NPC for 0 credits.</div>

          <div class="avatarsay-st-card" data-avs="card" hidden>
            <div class="avatarsay-st-card-top">
              <div class="avatarsay-st-card-meta">
                <strong data-avs="npc-name"></strong>
                <div class="avatarsay-st-sub" data-avs="npc-traits"></div>
              </div>
            </div>
            <div class="avatarsay-st-desc" data-avs="npc-desc"></div>
            <audio controls preload="none" class="avatarsay-st-audio" data-avs="sample-audio"></audio>

            <div class="avatarsay-st-row">
              <button type="button" class="menu_button menu_button_icon" data-avs-act="import">
                <i class="fa-solid fa-file-import"></i>
                <span>Import Character into SillyTavern</span>
              </button>
              <button type="button" class="menu_button menu_button_icon" data-avs-act="download-json">
                <i class="fa-solid fa-download"></i>
                <span>Download .json</span>
              </button>
            </div>

            <hr />

            <div class="avatarsay-st-section">
              <label>Instant &lt;3s MP3 Voice Bark (<code>create_npc_voice_line</code>, 2 credits / 100 chars)
                <input type="text" class="text_pole" data-avs="script" maxlength="500" placeholder="Enter dialogue line..." />
              </label>
              <div class="avatarsay-st-bark-controls">
                <select class="text_pole" data-avs="voice">${voiceOpts}</select>
                <select class="text_pole" data-avs="emotion">${emotionOpts}</select>
                <button type="button" class="menu_button menu_button_icon" data-avs-act="bark">
                  <i class="fa-solid fa-volume-high"></i>
                  <span>Generate Bark</span>
                </button>
              </div>
              <div data-avs="bark-result" hidden>
                <audio controls class="avatarsay-st-audio" data-avs="bark-audio"></audio>
                <a class="avatarsay-st-link" data-avs="bark-download" target="_blank" rel="noopener">Download MP3</a>
              </div>
            </div>

            <div class="avatarsay-st-section">
              <div class="avatarsay-st-row">
                <button type="button" class="menu_button menu_button_icon" data-avs-act="portraits">
                  <i class="fa-solid fa-palette"></i>
                  <span>Generate 2x 1024px Portraits (4 Credits)</span>
                </button>
              </div>
              <div class="avatarsay-st-portraits" data-avs="portrait-list" hidden></div>
            </div>
          </div>
        </div>
      </div>
    `;

    host.appendChild(wrapper);

    const statusEl = wrapper.querySelector('[data-avs="status"]');
    const cardEl = wrapper.querySelector('[data-avs="card"]');
    const nameEl = wrapper.querySelector('[data-avs="npc-name"]');
    const traitsEl = wrapper.querySelector('[data-avs="npc-traits"]');
    const descEl = wrapper.querySelector('[data-avs="npc-desc"]');
    const sampleAudioEl = wrapper.querySelector('[data-avs="sample-audio"]');
    const barkResultEl = wrapper.querySelector('[data-avs="bark-result"]');
    const barkAudioEl = wrapper.querySelector('[data-avs="bark-audio"]');
    const barkDownloadEl = wrapper.querySelector('[data-avs="bark-download"]');
    const portraitListEl = wrapper.querySelector('[data-avs="portrait-list"]');

    let currentRoll = null;

    const setStatus = (msg, isError = false) => {
      statusEl.textContent = msg;
      statusEl.classList.toggle("is-error", Boolean(isError));
    };

    const syncSettings = () => {
      settings.apiKey = wrapper.querySelector('[data-avs="apikey"]')?.value?.trim() || "";
      settings.defaultStyle = wrapper.querySelector('[data-avs="style"]')?.value || "fantasy";
      bridge.saveSettingsDebounced?.();
      return settings;
    };

    wrapper.querySelector('[data-avs="apikey"]')?.addEventListener("change", syncSettings);
    wrapper.querySelector('[data-avs="style"]')?.addEventListener("change", syncSettings);

    const buildRollArgs = () => {
      const s = syncSettings();
      const args = {
        style: s.defaultStyle || "fantasy",
        exportFormat: "sillytavern",
      };
      const gender = wrapper.querySelector('[data-avs="gender"]')?.value;
      const ancestry = wrapper.querySelector('[data-avs="ancestry"]')?.value?.trim();
      const role = wrapper.querySelector('[data-avs="role"]')?.value?.trim();
      const seed = wrapper.querySelector('[data-avs="seed"]')?.value?.trim();
      if (gender) args.gender = gender;
      if (ancestry) args.ancestry = ancestry;
      if (role) args.role = role;
      if (seed) args.seed = seed;
      return args;
    };

    const renderRoll = (roll) => {
      const npc = roll.npc || {};
      cardEl.hidden = false;
      nameEl.textContent = `${npc.name || "NPC"} — ${npc.ancestry || ""} ${npc.role || ""}`.trim();
      traitsEl.textContent = `Traits: ${(npc.traits || []).join(", ")} · Seed: ${roll.seed}`;
      descEl.innerHTML =
        `<div><strong>Look:</strong> ${escapeHtml(npc.lookSummary || "")}</div>` +
        `<div><strong>Scenario / Hook:</strong> ${escapeHtml(npc.hook || "")}</div>` +
        `<div><strong>GM Secret:</strong> ${escapeHtml(npc.secret || "")}</div>` +
        `<div><strong>First Message:</strong> <em>&ldquo;${escapeHtml(npc.greetingLine || "")}&rdquo;</em></div>`;

      const sampleUrl = npc.recommendedVoice?.sampleMp3Url || roll.recommendedVoice?.sampleMp3Url || "";
      if (sampleUrl) {
        sampleAudioEl.src = sampleUrl;
        sampleAudioEl.hidden = false;
      } else {
        sampleAudioEl.hidden = true;
      }

      const scriptInput = wrapper.querySelector('[data-avs="script"]');
      if (scriptInput) scriptInput.value = npc.greetingLine || "";
      const voiceSelect = wrapper.querySelector('[data-avs="voice"]');
      const recVoice = npc.recommendedVoice?.id || roll.recommendedVoice?.id;
      if (voiceSelect && recVoice) voiceSelect.value = recVoice;

      barkResultEl.hidden = true;
      portraitListEl.hidden = true;
      portraitListEl.innerHTML = "";
    };

    const handleRoll = async (autoImport = false) => {
      try {
        setStatus("Rolling deterministic NPC via AvatarSay MCP (0 credits)...");
        const roll = await callAvatarSayMcp("roll_rpg_npc", buildRollArgs());
        currentRoll = roll;
        renderRoll(roll);
        if (autoImport && roll.sillyTavernCardV2) {
          const imported = await importCardIntoSillyTavern(roll.sillyTavernCardV2, roll.npc?.name, bridge);
          notifyToast("success", `Imported "${roll.npc?.name}" into SillyTavern`);
          setStatus(`Rolled & imported "${roll.npc?.name}" (${imported.fileName}).`);
        } else {
          setStatus(`Rolled "${roll.npc?.name}" (seed: ${roll.seed}). Click Import to add to Characters.`);
        }
      } catch (err) {
        console.error(err);
        setStatus(err.message || "NPC roll failed", true);
        notifyToast("error", err.message || "NPC roll failed");
      }
    };

    wrapper.querySelector('[data-avs-act="roll"]')?.addEventListener("click", () => handleRoll(false));
    wrapper.querySelector('[data-avs-act="roll-import"]')?.addEventListener("click", () => handleRoll(true));

    wrapper.querySelector('[data-avs-act="import"]')?.addEventListener("click", async () => {
      if (!currentRoll?.sillyTavernCardV2) return;
      try {
        setStatus(`Importing "${currentRoll.npc?.name}" into SillyTavern...`);
        const imported = await importCardIntoSillyTavern(
          currentRoll.sillyTavernCardV2,
          currentRoll.npc?.name,
          bridge,
        );
        notifyToast("success", `Imported "${currentRoll.npc?.name}"!`);
        setStatus(`Imported "${currentRoll.npc?.name}" (${imported.fileName}).`);
      } catch (err) {
        console.error(err);
        setStatus(`${err.message} — downloading .json fallback.`, true);
        downloadCardJson(currentRoll.sillyTavernCardV2, currentRoll.npc?.name);
      }
    });

    wrapper.querySelector('[data-avs-act="download-json"]')?.addEventListener("click", () => {
      if (!currentRoll?.sillyTavernCardV2) return;
      downloadCardJson(currentRoll.sillyTavernCardV2, currentRoll.npc?.name);
      setStatus(`Downloaded ${slugifyFilename(currentRoll.npc?.name)}.json`);
    });

    wrapper.querySelector('[data-avs-act="bark"]')?.addEventListener("click", async () => {
      const { apiKey } = syncSettings();
      if (!apiKey) {
        setStatus("Paste an AvatarSay API key (avs_...) above to generate custom MP3 voice barks.", true);
        notifyToast("warning", "API key (avs_...) required for custom voice barks.");
        return;
      }
      const script = wrapper.querySelector('[data-avs="script"]')?.value?.trim() || "";
      const voiceId = wrapper.querySelector('[data-avs="voice"]')?.value || "Casual_Guy";
      const emotion = wrapper.querySelector('[data-avs="emotion"]')?.value || "neutral";
      if (!script) {
        setStatus("Enter a dialogue line first.", true);
        return;
      }
      try {
        setStatus("Synthesizing <3s MP3 voice bark...");
        const bark = await callAvatarSayMcp(
          "create_npc_voice_line",
          { script, voiceId, emotion, speed: 1.0 },
          apiKey,
        );
        barkResultEl.hidden = false;
        barkAudioEl.src = bark.downloadUrl;
        barkAudioEl.play().catch(() => {});
        barkDownloadEl.href = bark.downloadUrl;
        setStatus(`MP3 bark ready (${bark.creditsRemaining ?? "?"} credits left).`);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Voice bark failed", true);
        notifyToast("error", err.message || "Voice bark failed");
      }
    });

    wrapper.querySelector('[data-avs-act="portraits"]')?.addEventListener("click", async () => {
      if (!currentRoll) return;
      const { apiKey, defaultStyle } = syncSettings();
      if (!apiKey) {
        setStatus("Paste an AvatarSay API key (avs_...) above to generate 1024px portraits.", true);
        notifyToast("warning", "API key (avs_...) required for portrait generation.");
        return;
      }
      try {
        const prompt =
          currentRoll.npc?.portraitPrompt || `${currentRoll.npc?.ancestry} ${currentRoll.npc?.role}`;
        setStatus("Queueing 2x 1024px character portraits...");
        const queued = await callAvatarSayMcp(
          "generate_avatars",
          { prompt, style: defaultStyle || currentRoll.style || "fantasy" },
          apiKey,
        );
        const done = await pollPortraitJob(queued.jobId, apiKey, setStatus);
        const outputs = done.outputs || [];
        portraitListEl.hidden = false;
        portraitListEl.innerHTML = outputs
          .map(
            (out, idx) => `
              <div class="avatarsay-st-portrait-item">
                <img src="${escapeHtml(out.downloadUrl)}" alt="NPC Portrait ${idx + 1}" />
                <button type="button" class="menu_button" data-portrait-url="${escapeHtml(out.downloadUrl)}">
                  Apply / Download #${idx + 1}
                </button>
              </div>
            `,
          )
          .join("");

        portraitListEl.querySelectorAll("[data-portrait-url]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            try {
              const res = await applyOrDownloadPortrait(
                btn.dataset.portraitUrl,
                currentRoll.npc?.name,
                bridge,
              );
              if (res.appliedTo) {
                notifyToast("success", `Applied portrait to ${res.appliedTo}`);
                setStatus(`Applied 1024px portrait to active character "${res.appliedTo}".`);
              } else {
                setStatus("Downloaded 1024px portrait PNG.");
              }
            } catch (e) {
              setStatus(e.message || "Portrait apply failed", true);
            }
          });
        });

        setStatus(`Generated ${outputs.length} portraits (${queued.creditsRemaining ?? "?"} credits left).`);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Portrait generation failed", true);
        notifyToast("error", err.message || "Portrait generation failed");
      }
    });
  }

  globalThis.AvatarSaySillyTavern = {
    MCP_URL,
    MCP_VERSION,
    callAvatarSayMcp,
    importCardIntoSillyTavern,
    mountSettingsPanel,
  };

  if (typeof globalThis.jQuery === "function") {
    globalThis.jQuery(() => {
      mountSettingsPanel();
    });
  } else if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mountSettingsPanel());
    } else {
      mountSettingsPanel();
    }
  }
})();
