export function renderAdminPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TodoCo Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f6f8;
        --panel: #ffffff;
        --line: #d8dbe2;
        --text: #111827;
        --muted: #6b7280;
        --accent: #374151;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: "SF Pro Text", "Inter", "Segoe UI", Arial, sans-serif;
      }

      .shell {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 20px;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 22px;
      }

      h1 {
        margin: 0 0 14px;
        font-size: 22px;
        letter-spacing: 0.01em;
      }

      .muted {
        color: var(--muted);
        font-size: 13px;
      }

      .hidden { display: none; }

      .field {
        display: grid;
        gap: 6px;
        margin-bottom: 12px;
      }

      label {
        font-size: 12px;
        color: #4b5563;
      }

      input {
        width: 100%;
        height: 38px;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 0 10px;
        font-size: 14px;
        outline: none;
      }

      input:focus {
        border-color: #9ca3af;
      }

      .btn {
        border: 1px solid #111827;
        background: #111827;
        color: #fff;
        height: 38px;
        border-radius: 10px;
        padding: 0 14px;
        cursor: pointer;
      }

      .btn.ghost {
        border-color: var(--line);
        background: #fff;
        color: #111827;
      }

      .row {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .users {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .user-pill {
        border: 1px solid var(--line);
        background: #fff;
        border-radius: 999px;
        height: 42px;
        padding: 0 12px 0 6px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .user-pill.active {
        border-color: #6b7280;
        background: #f3f4f6;
      }

      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: #e5e7eb;
        color: #374151;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 600;
        overflow: hidden;
        flex: none;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar.lg {
        width: 72px;
        height: 72px;
        font-size: 24px;
      }

      .avatar-wrap {
        position: relative;
        width: 72px;
        height: 72px;
        cursor: pointer;
      }

      .avatar-wrap .avatar.lg {
        width: 100%;
        height: 100%;
      }

      .avatar-edit-icon {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 22px;
        height: 22px;
        background: #111827;
        border: 2px solid #fff;
        border-radius: 999px;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      .avatar-edit-icon svg {
        width: 11px;
        height: 11px;
        fill: #fff;
      }

      .panel-grid {
        display: grid;
        grid-template-columns: 84px 1fr;
        gap: 16px;
        align-items: start;
      }

      .error {
        color: #b91c1c;
        font-size: 13px;
        margin: 8px 0 0;
      }

      .ok {
        color: #166534;
        font-size: 13px;
        margin: 8px 0 0;
      }

      @media (max-width: 720px) {
        .panel-grid {
          grid-template-columns: 1fr;
        }
      }

      /* Tab navigation */
      .admin-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--line);
      }

      .admin-tab {
        padding: 10px 20px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 14px;
        font-weight: 500;
        color: var(--muted);
        cursor: pointer;
        transition: all 0.2s;
      }

      .admin-tab.active {
        color: var(--text);
        border-bottom-color: var(--text);
      }

      .admin-tab:hover {
        color: var(--text);
      }

      /* Workspace section */
      #workspaces-section {
        margin-top: 20px;
      }

      .workspace-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .workspace-header h2 {
        margin: 0;
        font-size: 18px;
      }

      .workspace-list {
        display: grid;
        gap: 12px;
      }

      .workspace-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 10px;
        transition: all 0.2s;
      }

      .workspace-card:hover {
        border-color: #9ca3af;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .workspace-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .workspace-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
      }

      .workspace-stats {
        font-size: 13px;
        color: var(--muted);
      }

      .workspace-secret-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
      }

      .workspace-secret-label {
        font-size: 12px;
        color: var(--muted);
      }

      .workspace-secret {
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        font-size: 13px;
        background: var(--bg);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid var(--line);
        color: var(--text);
        letter-spacing: 0.05em;
      }

      .copy-secret-btn {
        padding: 2px 6px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        line-height: 1;
      }

      .copy-secret-btn:hover {
        background: var(--line);
        transform: scale(1.1);
      }

      .delete-workspace-btn {
        padding: 6px 12px;
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .delete-workspace-btn:hover {
        background: #fecaca;
        border-color: #fca5a5;
      }

      /* Modal */
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal-content {
        background: var(--panel);
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }

      .modal-content h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        color: var(--text);
      }

      .workspace-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        font-size: 14px;
        margin-bottom: 16px;
        box-sizing: border-box;
        outline: none;
      }

      .workspace-input:focus {
        border-color: #9ca3af;
      }

      .modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .primary-btn, .secondary-btn, .action-btn {
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid;
      }

      .primary-btn {
        background: #111827;
        color: white;
        border-color: #111827;
      }

      .primary-btn:hover {
        background: #1f2937;
        transform: translateY(-1px);
      }

      .secondary-btn {
        background: white;
        color: var(--muted);
        border-color: var(--line);
      }

      .secondary-btn:hover {
        border-color: #9ca3af;
      }

      .action-btn {
        background: #111827;
        color: white;
        border-color: #111827;
        height: 38px;
      }

      .action-btn:hover {
        background: #1f2937;
      }

      .error-message {
        color: #dc2626;
        font-size: 12px;
        margin-top: 8px;
        min-height: 18px;
      }

      /* Workspace assignments */
      .workspace-assignments {
        display: grid;
        gap: 8px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #fafafa;
        max-height: 200px;
        overflow-y: auto;
      }

      .workspace-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .workspace-checkbox:hover {
        background: #f0f0f0;
      }

      .workspace-checkbox input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .workspace-checkbox label {
        flex: 1;
        cursor: pointer;
        font-size: 13px;
        color: var(--text);
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section id="loginView" class="card">
        <h1>User Management Console</h1>
        <div class="field">
          <label>Username</label>
          <input id="loginUsername" type="text" autocomplete="username" />
        </div>
        <div class="field">
          <label>Password</label>
          <input id="loginPassword" type="password" autocomplete="current-password" />
        </div>
        <button id="loginBtn" class="btn" type="button">Login</button>
        <p id="loginError" class="error hidden"></p>
      </section>

      <section id="consoleView" class="card hidden">
        <div class="row" style="justify-content: space-between; margin-bottom: 14px;">
          <h1 style="margin: 0;">User Management Console</h1>
          <button id="logoutBtn" class="btn ghost" type="button">Logout</button>
        </div>

        <div class="admin-tabs">
          <button class="admin-tab active" data-tab="users">Users</button>
          <button class="admin-tab" data-tab="workspaces">Workspaces</button>
        </div>

        <div id="users-section">
          <div id="usersBar" class="users"></div>

          <div class="panel-grid">
          <div>
            <div class="avatar-wrap" id="avatarWrap" title="Change avatar">
              <div id="avatarPreview" class="avatar lg">?</div>
              <span class="avatar-edit-icon"><svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-4 1.5a.5.5 0 0 1-.638-.638l1.5-4a.5.5 0 0 1 .11-.168l9.5-9.5zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 3 10.707V11h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l7.5-7.5z"/></svg></span>
              <input id="avatarInput" type="file" accept="image/*" style="display:none" />
            </div>
          </div>

          <div>
            <div class="field">
              <label>Username</label>
              <input id="usernameInput" type="text" />
            </div>
            <div class="field">
              <label>Full Name (Markdown match)</label>
              <input id="fullNameInput" type="text" />
            </div>
            <div class="field">
              <label>E-mail</label>
              <input id="emailInput" type="email" />
            </div>
            <div class="field">
              <label>Password</label>
              <input id="passwordInput" type="password" placeholder="Leave blank to keep current" />
            </div>
            <div class="field">
              <label>Workspace Access</label>
              <div id="workspaceAssignments" class="workspace-assignments">
                <!-- Populated dynamically -->
              </div>
            </div>
            <button id="saveBtn" class="btn" type="button">Update</button>
            <p id="saveMessage" class="hidden"></p>
          </div>
        </div>
        </div>

        <div id="workspaces-section" style="display: none;">
          <div class="workspace-header">
            <h2>Workspaces</h2>
            <button id="create-workspace-btn" class="action-btn">+ Create Workspace</button>
          </div>

          <div id="workspace-list" class="workspace-list">
            <!-- Populated dynamically via JavaScript -->
          </div>

          <!-- Create workspace modal -->
          <div id="create-workspace-modal" class="modal" style="display: none;">
            <div class="modal-content">
              <h3>Create New Workspace</h3>
              <input
                type="text"
                id="new-workspace-id"
                placeholder="Workspace ID (e.g., 'demo', 'team-alpha')"
                class="workspace-input"
              />
              <div class="modal-actions">
                <button id="cancel-create-btn" class="secondary-btn">Cancel</button>
                <button id="confirm-create-btn" class="primary-btn">Create</button>
              </div>
              <div id="create-error" class="error-message"></div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <script>
      const tokenKey = "todoco_admin_token";
      let token = localStorage.getItem(tokenKey) || "";
      let users = [];
      let selectedUserId = null;
      let avatarBase64 = "";
      let availableWorkspaces = [];
      let selectedWorkspaces = [];

      const loginView = document.getElementById("loginView");
      const consoleView = document.getElementById("consoleView");
      const loginUsername = document.getElementById("loginUsername");
      const loginPassword = document.getElementById("loginPassword");
      const loginError = document.getElementById("loginError");
      const usersBar = document.getElementById("usersBar");

      const avatarPreview = document.getElementById("avatarPreview");
      const avatarInput = document.getElementById("avatarInput");
      const usernameInput = document.getElementById("usernameInput");
      const fullNameInput = document.getElementById("fullNameInput");
      const emailInput = document.getElementById("emailInput");
      const passwordInput = document.getElementById("passwordInput");
      const saveBtn = document.getElementById("saveBtn");
      const saveMessage = document.getElementById("saveMessage");

      function initials(name) {
        const text = String(name || "").trim();
        if (!text) return "?";
        return text
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("");
      }

      function setLoginError(message) {
        loginError.textContent = message || "";
        loginError.classList.toggle("hidden", !message);
      }

      function setSaveMessage(message, ok = false) {
        saveMessage.textContent = message || "";
        saveMessage.className = message ? (ok ? "ok" : "error") : "hidden";
      }

      function renderAvatar(target, user) {
        target.innerHTML = "";
        if (user && user.avatar_base64) {
          const img = document.createElement("img");
          img.src = user.avatar_base64;
          img.alt = user.full_name || user.username;
          target.appendChild(img);
          return;
        }
        target.textContent = initials(user?.full_name || user?.username || "");
      }

      function applyForm(user) {
        if (!user) {
          selectedUserId = null;
          avatarBase64 = "";
          selectedWorkspaces = [];
          usernameInput.value = "";
          fullNameInput.value = "";
          emailInput.value = "";
          passwordInput.value = "";
          saveBtn.textContent = "Create";
          renderAvatar(avatarPreview, null);
          renderWorkspaceAssignments();
          return;
        }

        selectedUserId = user.id;
        avatarBase64 = user.avatar_base64 || "";
        selectedWorkspaces = user.workspaces || [];
        usernameInput.value = user.username || "";
        fullNameInput.value = user.full_name || "";
        emailInput.value = user.email || "";
        passwordInput.value = "";
        saveBtn.textContent = "Update";
        renderAvatar(avatarPreview, user);
        renderWorkspaceAssignments();
      }

      function renderWorkspaceAssignments() {
        const container = document.getElementById("workspaceAssignments");
        container.innerHTML = "";

        if (availableWorkspaces.length === 0) {
          container.innerHTML = '<div style="color: var(--muted); font-size: 13px; padding: 10px;">No workspaces available</div>';
          return;
        }

        availableWorkspaces.forEach(ws => {
          const checkbox = document.createElement("div");
          checkbox.className = "workspace-checkbox";

          const input = document.createElement("input");
          input.type = "checkbox";
          input.id = "ws-" + ws.id;
          input.checked = selectedWorkspaces.includes(ws.id);
          input.addEventListener("change", (e) => {
            if (e.target.checked) {
              if (!selectedWorkspaces.includes(ws.id)) {
                selectedWorkspaces.push(ws.id);
              }
            } else {
              selectedWorkspaces = selectedWorkspaces.filter(id => id !== ws.id);
            }
          });

          const label = document.createElement("label");
          label.htmlFor = "ws-" + ws.id;
          label.textContent = ws.id + " (" + ws.taskCount + " tasks)";

          checkbox.appendChild(input);
          checkbox.appendChild(label);
          container.appendChild(checkbox);
        });
      }

      function renderUsersBar() {
        usersBar.innerHTML = "";

        users.forEach((user) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "user-pill" + (selectedUserId === user.id ? " active" : "");

          const avatar = document.createElement("span");
          avatar.className = "avatar";
          renderAvatar(avatar, user);

          const label = document.createElement("span");
          label.textContent = user.full_name;

          button.appendChild(avatar);
          button.appendChild(label);
          button.addEventListener("click", () => {
            applyForm(user);
            renderUsersBar();
            setSaveMessage("");
          });
          usersBar.appendChild(button);
        });

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "user-pill" + (!selectedUserId ? " active" : "");
        addButton.innerHTML = '<span class="avatar">+</span><span>New User</span>';
        addButton.addEventListener("click", () => {
          applyForm(null);
          renderUsersBar();
          setSaveMessage("");
        });
        usersBar.appendChild(addButton);
      }

      async function api(path, options = {}) {
        const headers = {
          ...(options.headers || {})
        };

        // Only add content-type header if there's a body
        if (options.body) {
          headers["content-type"] = "application/json";
        }

        if (token) {
          headers.authorization = "Bearer " + token;
        }

        const response = await fetch(path, {
          ...options,
          headers
        });

        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("application/json") ? await response.json() : null;

        if (!response.ok) {
          throw new Error(body?.error || ("request_failed_" + response.status));
        }

        return body;
      }

      async function loadUsers() {
        const [usersPayload, workspacesPayload] = await Promise.all([
          api("/admin-api/users"),
          api("/admin-api/workspaces")
        ]);

        users = Array.isArray(usersPayload.users) ? usersPayload.users : [];
        availableWorkspaces = Array.isArray(workspacesPayload.workspaces) ? workspacesPayload.workspaces : [];

        const selected = users.find((user) => user.id === selectedUserId);
        if (selected) {
          applyForm(selected);
        } else if (users[0]) {
          applyForm(users[0]);
        } else {
          applyForm(null);
        }

        renderUsersBar();
      }

      async function login() {
        setLoginError("");
        try {
          const payload = await api("/admin-api/login", {
            method: "POST",
            body: JSON.stringify({
              username: loginUsername.value,
              password: loginPassword.value
            })
          });

          token = payload.token;
          localStorage.setItem(tokenKey, token);
          loginView.classList.add("hidden");
          consoleView.classList.remove("hidden");
          await loadUsers();
        } catch (error) {
          setLoginError("Login failed. Check username/password.");
        }
      }

      async function saveUser() {
        setSaveMessage("");

        const payload = {
          username: usernameInput.value,
          full_name: fullNameInput.value,
          email: emailInput.value,
          avatar_base64: avatarBase64,
          workspaces: selectedWorkspaces
        };

        if (passwordInput.value.trim()) {
          payload.password = passwordInput.value.trim();
        }

        try {
          if (selectedUserId) {
            await api("/admin-api/users/" + selectedUserId, {
              method: "PUT",
              body: JSON.stringify(payload)
            });
            setSaveMessage("User updated.", true);
          } else {
            if (!payload.password) {
              setSaveMessage("Password is required for new users.");
              return;
            }

            await api("/admin-api/users", {
              method: "POST",
              body: JSON.stringify(payload)
            });
            setSaveMessage("User created.", true);
          }

          await loadUsers();
        } catch (error) {
          setSaveMessage(error.message.replaceAll("_", " "));
        }
      }

      document.getElementById("loginBtn").addEventListener("click", login);
      document.getElementById("logoutBtn").addEventListener("click", () => {
        token = "";
        localStorage.removeItem(tokenKey);
        selectedUserId = null;
        users = [];
        loginView.classList.remove("hidden");
        consoleView.classList.add("hidden");
        setLoginError("");
      });

      saveBtn.addEventListener("click", saveUser);

      document.getElementById("avatarWrap").addEventListener("click", () => {
        avatarInput.click();
      });

      function resizeImageToJpeg(file, size) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            const srcSize = Math.min(img.width, img.height);
            const sx = (img.width - srcSize) / 2;
            const sy = (img.height - srcSize) / 2;
            ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = () => reject(new Error("image_load_failed"));
          img.src = URL.createObjectURL(file);
        });
      }

      avatarInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }

        try {
          const dataUrl = await resizeImageToJpeg(file, 128);
          avatarBase64 = dataUrl;
          renderAvatar(avatarPreview, { full_name: fullNameInput.value, username: usernameInput.value, avatar_base64: dataUrl });
        } catch {
          setSaveMessage("Failed to process image.");
        }
      });

      // Workspace management
      async function loadWorkspaces() {
        try {
          const response = await api("/admin-api/workspaces");
          const workspaces = response.workspaces || [];

          const listEl = document.getElementById("workspace-list");
          listEl.innerHTML = workspaces.map(ws => \`
            <div class="workspace-card">
              <div class="workspace-info">
                <span class="workspace-name">\${ws.id}</span>
                <span class="workspace-stats">\${ws.taskCount} tasks</span>
                <div class="workspace-secret-container">
                  <span class="workspace-secret-label">Secret:</span>
                  <code class="workspace-secret">\${ws.secret || 'N/A'}</code>
                  <button class="copy-secret-btn" data-secret="\${ws.secret}" title="Copy secret">📋</button>
                </div>
              </div>
              <button class="delete-workspace-btn" data-workspace="\${ws.id}">Delete</button>
            </div>
          \`).join("");

          // Attach delete handlers
          listEl.querySelectorAll(".delete-workspace-btn").forEach(btn => {
            btn.addEventListener("click", () => deleteWorkspace(btn.dataset.workspace));
          });

          // Attach copy secret handlers
          listEl.querySelectorAll(".copy-secret-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const secret = btn.dataset.secret;
              navigator.clipboard.writeText(secret).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "✓";
                setTimeout(() => {
                  btn.textContent = originalText;
                }, 1500);
              }).catch(err => {
                console.error("Failed to copy:", err);
                alert("Failed to copy secret");
              });
            });
          });
        } catch (error) {
          console.error("Failed to load workspaces:", error);
          alert("Failed to load workspaces");
        }
      }

      async function deleteWorkspace(workspaceId) {
        if (!confirm(\`Are you sure you want to delete workspace "\${workspaceId}"? This will permanently delete all tasks in this workspace.\`)) {
          return;
        }

        try {
          await api(\`/admin-api/workspaces/\${workspaceId}\`, {
            method: "DELETE"
          });

          loadWorkspaces(); // Refresh list
        } catch (error) {
          console.error("Failed to delete workspace:", error);
          alert("Failed to delete workspace");
        }
      }

      // Tab switching
      document.querySelectorAll(".admin-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          const targetTab = tab.dataset.tab;

          // Update active tab styling
          document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
          tab.classList.add("active");

          // Show/hide sections
          if (targetTab === "users") {
            document.getElementById("users-section").style.display = "block";
            document.getElementById("workspaces-section").style.display = "none";
          } else if (targetTab === "workspaces") {
            document.getElementById("users-section").style.display = "none";
            document.getElementById("workspaces-section").style.display = "block";
            loadWorkspaces(); // Load workspaces when tab is shown
          }
        });
      });

      // Create workspace modal
      document.getElementById("create-workspace-btn").addEventListener("click", () => {
        document.getElementById("create-workspace-modal").style.display = "flex";
        document.getElementById("new-workspace-id").value = "";
        document.getElementById("create-error").textContent = "";
      });

      document.getElementById("cancel-create-btn").addEventListener("click", () => {
        document.getElementById("create-workspace-modal").style.display = "none";
      });

      document.getElementById("confirm-create-btn").addEventListener("click", async () => {
        const workspaceId = document.getElementById("new-workspace-id").value.trim();
        const errorEl = document.getElementById("create-error");

        if (!workspaceId || workspaceId.length < 2) {
          errorEl.textContent = "Workspace ID must be at least 2 characters";
          return;
        }

        try {
          await api("/admin-api/workspaces", {
            method: "POST",
            body: JSON.stringify({ workspaceId })
          });

          document.getElementById("create-workspace-modal").style.display = "none";
          loadWorkspaces(); // Refresh list
        } catch (error) {
          errorEl.textContent = error.message || "Failed to create workspace";
        }
      });

      (async () => {
        if (!token) {
          return;
        }

        try {
          await loadUsers();
          loginView.classList.add("hidden");
          consoleView.classList.remove("hidden");
        } catch {
          token = "";
          localStorage.removeItem(tokenKey);
        }
      })();
    </script>
  </body>
</html>`;
}
