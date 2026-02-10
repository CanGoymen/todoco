const DEFAULT_API_BASE = import.meta.env.VITE_TODOCO_API_BASE || "http://localhost:8787";
const DEFAULT_TOKEN = import.meta.env.VITE_TODOCO_TOKEN || "dev-token";
const USER_KEY = "todoco_user";

export function getRuntimeConfig() {
  const apiBase = localStorage.getItem("todoco_api_base") || DEFAULT_API_BASE;
  const token = localStorage.getItem("todoco_token") || DEFAULT_TOKEN;
  const workspace = localStorage.getItem("todoco_workspace") || "";
  return { apiBase, token, workspace };
}

export function getLoggedInUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLoggedInUser(user, token) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (token) {
    localStorage.setItem("todoco_token", token);
  }
}

export function clearLoggedInUser() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("todoco_token");
}

export function getCustomServerSettings() {
  const enabled = localStorage.getItem("todoco_custom_server_enabled") === "true";
  const server = localStorage.getItem("todoco_api_base") || "";
  const token = localStorage.getItem("todoco_token") || "";
  const workspace = localStorage.getItem("todoco_workspace") || "";
  return { enabled, server, token, workspace };
}

export function saveCustomServerSettings(enabled, server, token, workspace) {
  if (enabled) {
    localStorage.setItem("todoco_custom_server_enabled", "true");
    localStorage.setItem("todoco_api_base", server.trim());
    localStorage.setItem("todoco_token", token.trim());
    localStorage.setItem("todoco_workspace", workspace.trim());
  } else {
    localStorage.setItem("todoco_custom_server_enabled", "false");
    localStorage.removeItem("todoco_api_base");
    localStorage.removeItem("todoco_token");
    localStorage.removeItem("todoco_workspace");
  }
}

export function isCustomServerEnabled() {
  return localStorage.getItem("todoco_custom_server_enabled") === "true";
}
