import { getRuntimeConfig, getLoggedInUser } from "./config.js";

export async function login(email, password) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `login_failed:${response.status}`);
  }

  return response.json();
}

export async function register(email, password, fullName) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `register_failed:${response.status}`);
  }

  return response.json();
}

export async function checkWorkspaceExists(workspaceId) {
  const { apiBase, token } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspace/check/${workspaceId}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`check_workspace_failed:${response.status}`);
  }

  return response.json();
}

export async function joinWorkspace(workspaceId, secret, userEmail) {
  const { apiBase, token } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspace/join`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ workspaceId, secret, userEmail })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `join_workspace_failed:${response.status}`);
  }

  return response.json();
}

export async function createWorkspace(workspaceId, userEmail) {
  const { apiBase, token } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspace/create`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ workspaceId, userEmail })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `create_workspace_failed:${response.status}`);
  }

  return response.json();
}

export async function getWorkspaceInfo() {
  const { apiBase, workspace } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspaces`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`get_workspaces_failed:${response.status}`);
  }

  const data = await response.json();
  const workspaces = data.workspaces || [];
  const currentWorkspace = workspaces.find((w) => w.workspace_id === workspace);

  return currentWorkspace || null;
}

export async function getUserWorkspaces() {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspaces`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`get_workspaces_failed:${response.status}`);
  }

  const data = await response.json();
  return data.workspaces || [];
}

export async function getWorkspaceMembers(workspaceId) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/workspace/${workspaceId}/members`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`get_workspace_members_failed:${response.status}`);
  }

  const data = await response.json();
  return data.members || [];
}

export async function updateProfile(data) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/profile`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`profile_update_failed:${response.status}`);
  }

  return response.json();
}

function authHeaders() {
  const { token, workspace } = getRuntimeConfig();
  const user = getLoggedInUser();
  const headers = {
    authorization: `Bearer ${token}`,
    "x-workspace-id": workspace,
    "content-type": "application/json"
  };

  if (user?.email) {
    headers["x-user-email"] = user.email;
  }

  return headers;
}

export async function fetchTasks() {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/tasks`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`fetch_tasks_failed:${response.status}`);
  }

  const payload = await response.json();
  return payload.tasks || [];
}

export async function toggleTask(taskId, done) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/tasks/${taskId}/toggle`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ done })
  });

  if (!response.ok) {
    throw new Error(`toggle_failed:${response.status}`);
  }

  return response.json();
}

export async function updateTaskProgress(taskId, progress) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/tasks/${taskId}/progress`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ progress })
  });

  if (!response.ok) {
    throw new Error(`progress_update_failed:${response.status}`);
  }

  return response.json();
}

export async function bulkUpdateTasks(tasks) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/tasks/bulk`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ tasks })
  });

  if (!response.ok) {
    throw new Error(`bulk_update_failed:${response.status}`);
  }

  return response.json();
}

export async function createTask(task) {
  const { apiBase } = getRuntimeConfig();
  const response = await fetch(`${apiBase}/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ task })
  });

  if (!response.ok) {
    throw new Error(`create_task_failed:${response.status}`);
  }

  return response.json();
}

function websocketUrl() {
  const { apiBase, token, workspace } = getRuntimeConfig();
  const wsBase = apiBase.replace(/^http/, "ws");
  const url = new URL(`${wsBase}/realtime`);
  url.searchParams.set("workspace", workspace);
  url.searchParams.set("token", token);

  // User presence tracking için username ekle
  const user = JSON.parse(localStorage.getItem("todoco_user") || "null");
  if (user?.username) {
    url.searchParams.set("username", user.username);
  }

  return url.toString();
}

export function connectRealtime(onMessage) {
  const ws = new WebSocket(websocketUrl());

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "request_full_sync" }));
  });

  ws.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage(payload);
    } catch {
      // ignored invalid payload
    }
  });

  return ws;
}
