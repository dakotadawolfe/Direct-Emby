export function configurePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DirectEmby</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #18202f;
      --muted: #5e697d;
      --line: #d7deea;
      --accent: #0f766e;
      --accent-dark: #115e59;
      --danger: #b42318;
      --code: #edf3f8;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #10141d;
        --panel: #171d29;
        --text: #f3f6fb;
        --muted: #aab5c6;
        --line: #2a3344;
        --accent: #2dd4bf;
        --accent-dark: #14b8a6;
        --danger: #f97066;
        --code: #111827;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }
    main {
      width: min(980px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 0 18px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 24px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--accent);
      font-weight: 800;
      background: var(--panel);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 20px;
      align-items: start;
    }
    section, aside {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 650;
      letter-spacing: 0;
    }
    form {
      display: grid;
      gap: 14px;
    }
    label {
      display: grid;
      gap: 6px;
      font-weight: 600;
      color: var(--text);
    }
    label span {
      font-size: 14px;
    }
    input[type="url"],
    input[type="text"],
    input[type="password"] {
      width: 100%;
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      padding: 9px 11px;
      font: inherit;
    }
    input[readonly] {
      background: var(--code);
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
    }
    button {
      min-height: 42px;
      border: 0;
      border-radius: 6px;
      background: var(--accent);
      color: #001f1c;
      font: inherit;
      font-weight: 700;
      padding: 9px 14px;
      cursor: pointer;
    }
    button:hover { background: var(--accent-dark); }
    button:disabled {
      cursor: wait;
      opacity: 0.62;
    }
    .library-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .checks {
      display: grid;
      gap: 8px;
      align-content: start;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      min-height: 96px;
    }
    .check {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      font-weight: 500;
    }
    .check input { width: 16px; height: 16px; }
    .hidden { display: none; }
    .status {
      min-height: 24px;
      color: var(--muted);
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .status.error { color: var(--danger); }
    .links {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }
    .copy-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .copy-row button {
      min-width: 84px;
      color: #001f1c;
    }
    aside {
      display: grid;
      gap: 12px;
      color: var(--muted);
      font-size: 14px;
    }
    code {
      background: var(--code);
      border-radius: 4px;
      padding: 2px 5px;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    @media (max-width: 820px) {
      main { width: min(100% - 24px, 980px); padding-top: 20px; }
      header { align-items: flex-start; }
      .grid { grid-template-columns: 1fr; }
      .library-grid { grid-template-columns: 1fr; }
      .copy-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>DirectEmby</h1>
      <div class="mark" aria-hidden="true">DE</div>
    </header>

    <div class="grid">
      <section>
        <h2>Configure</h2>
        <form id="connect-form" autocomplete="off">
          <label>
            <span>Emby URL</span>
            <input id="emby-url" name="embyUrl" type="url" placeholder="https://emby.example.com" required>
          </label>
          <label>
            <span>Username</span>
            <input id="username" name="username" type="text" autocomplete="username" required>
          </label>
          <label>
            <span>Password</span>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </label>
          <button id="connect-button" type="submit">Connect</button>
          <div id="connect-status" class="status" role="status"></div>
        </form>

        <form id="library-form" class="hidden" autocomplete="off">
          <div class="library-grid">
            <div>
              <h2>Movie Libraries</h2>
              <div id="movie-libraries" class="checks"></div>
            </div>
            <div>
              <h2>TV Libraries</h2>
              <div id="series-libraries" class="checks"></div>
            </div>
          </div>
          <button id="link-button" type="submit">Generate Install Link</button>
          <div id="link-status" class="status" role="status"></div>
        </form>

        <div id="links" class="links hidden">
          <label>
            <span>Stremio Link</span>
            <div class="copy-row">
              <input id="stremio-link" readonly>
              <button type="button" data-copy="stremio-link">Copy</button>
            </div>
          </label>
          <label>
            <span>Manifest URL</span>
            <div class="copy-row">
              <input id="manifest-url" readonly>
              <button type="button" data-copy="manifest-url">Copy</button>
            </div>
          </label>
        </div>
      </section>

      <aside>
        <div><strong>Status</strong></div>
        <div>Health: <code>/health</code></div>
        <div>Public base: <code id="public-base">detecting</code></div>
        <div>Catalogs: <code>DirectEmby Movies</code>, <code>DirectEmby TV Shows</code></div>
      </aside>
    </div>
  </main>

  <script>
    const connectForm = document.getElementById("connect-form");
    const libraryForm = document.getElementById("library-form");
    const connectButton = document.getElementById("connect-button");
    const linkButton = document.getElementById("link-button");
    const connectStatus = document.getElementById("connect-status");
    const linkStatus = document.getElementById("link-status");
    const movieLibraries = document.getElementById("movie-libraries");
    const seriesLibraries = document.getElementById("series-libraries");
    const links = document.getElementById("links");
    const publicBase = document.getElementById("public-base");
    const stremioLink = document.getElementById("stremio-link");
    const manifestUrl = document.getElementById("manifest-url");
    let setupId = "";

    publicBase.textContent = window.location.origin;

    function setStatus(element, message, isError) {
      element.textContent = message || "";
      element.classList.toggle("error", Boolean(isError));
    }

    function renderChecks(target, libraries, name) {
      target.textContent = "";
      if (libraries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "status";
        empty.textContent = "None found";
        target.appendChild(empty);
        return;
      }

      for (const library of libraries) {
        const label = document.createElement("label");
        label.className = "check";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = name;
        input.value = library.id;
        input.checked = true;
        const span = document.createElement("span");
        span.textContent = library.name;
        label.append(input, span);
        target.appendChild(label);
      }
    }

    async function postJson(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Request failed");
      }
      return data;
    }

    connectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      links.classList.add("hidden");
      libraryForm.classList.add("hidden");
      setStatus(connectStatus, "Connecting...", false);
      connectButton.disabled = true;

      const embyUrl = document.getElementById("emby-url").value;
      const username = document.getElementById("username").value;
      const passwordInput = document.getElementById("password");
      const password = passwordInput.value;

      try {
        const data = await postJson("/configure/libraries", { embyUrl, username, password });
        setupId = data.setupId;
        renderChecks(movieLibraries, data.movieLibraries, "movieLibraries");
        renderChecks(seriesLibraries, data.seriesLibraries, "seriesLibraries");
        libraryForm.classList.remove("hidden");
        setStatus(connectStatus, "Connected.", false);
      } catch (error) {
        setStatus(connectStatus, error.message, true);
      } finally {
        passwordInput.value = "";
        connectButton.disabled = false;
      }
    });

    libraryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(linkStatus, "Generating...", false);
      linkButton.disabled = true;

      const movieLibraryIds = [...libraryForm.querySelectorAll("input[name='movieLibraries']:checked")].map((input) => input.value);
      const seriesLibraryIds = [...libraryForm.querySelectorAll("input[name='seriesLibraries']:checked")].map((input) => input.value);

      try {
        const data = await postJson("/configure/link", { setupId, movieLibraryIds, seriesLibraryIds });
        stremioLink.value = data.installUrl;
        manifestUrl.value = data.manifestUrl;
        links.classList.remove("hidden");
        setStatus(linkStatus, "Ready.", false);
      } catch (error) {
        setStatus(linkStatus, error.message, true);
      } finally {
        linkButton.disabled = false;
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-copy]");
      if (!button) {
        return;
      }

      const input = document.getElementById(button.dataset.copy);
      await navigator.clipboard.writeText(input.value);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    });
  </script>
</body>
</html>`;
}
