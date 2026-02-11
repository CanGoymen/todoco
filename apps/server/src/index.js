import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import {
  canUserAccessWorkspace,
  checkWorkspaceExists,
  createUser,
  createWorkspace,
  deleteWorkspace,
  getTasks,
  getUserByEmail,
  getWorkspaceStats,
  initStore,
  joinWorkspace,
  listUsers,
  listWorkspaces,
  mustInit,
  replaceTasks,
  toggleTask,
  updateTaskProgress,
  updateUser,
  upsertTask,
  verifyAdminLogin,
  verifyUserLogin,
  verifyWorkspaceSecret
} from "./store.js";
import { createRealtimeHub } from "./realtime.js";
import { renderAdminPage } from "./admin-ui.js";

const app = Fastify({ logger: true });
const hub = createRealtimeHub();

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MVP_TOKEN = process.env.TODOCO_TOKEN || "dev-token";
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || "todoco-admin-secret";
const ADMIN_TOKEN_TTL_SEC = Number.parseInt(process.env.ADMIN_TOKEN_TTL_SEC || "43200", 10);

function readWorkspace(request) {
  return String(request.headers["x-workspace-id"] || readQueryParam(request, "workspace") || "demo");
}

function readUserEmail(request) {
  return String(request.headers["x-user-email"] || readQueryParam(request, "email") || "").trim().toLowerCase();
}

async function checkWorkspaceAccess(request, reply) {
  const workspaceId = readWorkspace(request);
  const userEmail = readUserEmail(request);

  if (!userEmail) {
    reply.code(403).send({ error: "user_email_required" });
    return false;
  }

  const hasAccess = await canUserAccessWorkspace(userEmail, workspaceId);
  if (!hasAccess) {
    reply.code(403).send({ error: "workspace_access_denied", workspace: workspaceId });
    return false;
  }

  return true; // Access granted
}

function readQueryParam(request, name) {
  const fromQuery = request?.query?.[name];
  if (Array.isArray(fromQuery)) {
    return String(fromQuery[0] || "").trim();
  }
  if (typeof fromQuery === "string") {
    return fromQuery.trim();
  }

  const rawUrl = [request?.url, request?.raw?.url, request?.req?.url]
    .map((value) => String(value || ""))
    .find((value) => value.includes("?")) || "";
  const queryString = rawUrl.includes("?") ? rawUrl.split("?")[1] : "";
  if (!queryString) {
    return "";
  }

  return String(new URLSearchParams(queryString).get(name) || "").trim();
}

function isAuthorized(request) {
  const auth = String(request.headers.authorization || "");
  const queryToken = readQueryParam(request, "token");
  return auth === `Bearer ${MVP_TOKEN}` || queryToken === MVP_TOKEN;
}

function createAdminToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SEC
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAdminToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(body).digest("base64url");
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function readAdminToken(request) {
  const auth = String(request.headers.authorization || "");
  if (auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return String(request.headers["x-admin-token"] || "").trim();
}

function readPath(request) {
  return String(request.url || "").split("?")[0];
}

function userErrorResponse(reply, error) {
  const code = String(error?.message || "unknown_error");
  const status = code === "user_already_exists" ? 409 : 400;
  return reply.code(status).send({ error: code });
}

app.register(cors, { origin: true });
app.register(websocket);

app.addHook("preHandler", async (request, reply) => {
  const path = readPath(request);

  if (path === "/health" || path === "/admin" || path === "/admin/" || path === "/admin-api/login" || path === "/auth/login" || path === "/auth/register") {
    return;
  }

  if (path.startsWith("/admin-api/")) {
    const session = verifyAdminToken(readAdminToken(request));
    if (!session) {
      return reply.code(401).send({ error: "admin_unauthorized" });
    }
    return;
  }

  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true, at: new Date().toISOString() }));

app.get("/admin", async (_, reply) => {
  reply.type("text/html").send(renderAdminPage());
});

app.post("/admin-api/login", async (request, reply) => {
  const username = String(request.body?.username || "").trim();
  const password = String(request.body?.password || "");

  const user = await verifyAdminLogin(username, password);
  if (!user) {
    return reply.code(401).send({ error: "invalid_credentials" });
  }

  return {
    token: createAdminToken(user),
    user
  };
});

app.post("/auth/login", async (request, reply) => {
  const email = String(request.body?.email || "").trim();
  const password = String(request.body?.password || "");

  const user = await verifyUserLogin(email, password);
  if (!user) {
    return reply.code(401).send({ error: "invalid_credentials" });
  }

  return { token: MVP_TOKEN, user };
});

app.post("/auth/register", async (request, reply) => {
  try {
    const { email, password, full_name } = request.body || {};

    if (!email || !password || !full_name) {
      return reply.code(400).send({ error: "email_password_fullname_required" });
    }

    // Generate username from email
    const username = email.split('@')[0].toLowerCase();

    const user = await createUser({
      username,
      email: email.trim().toLowerCase(),
      password,
      full_name: full_name.trim(),
      workspaces: []
    });

    return { token: MVP_TOKEN, user };
  } catch (error) {
    if (error.message === "user_already_exists") {
      return reply.code(409).send({ error: "user_already_exists" });
    }
    return reply.code(400).send({ error: error.message });
  }
});

app.patch("/profile", async (request, reply) => {
  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const userEmail = request.headers["x-user-email"];
    if (!userEmail) {
      return reply.code(400).send({ error: "user_email_required" });
    }

    const user = await getUserByEmail(userEmail);
    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    const body = request.body || {};
    const allowedFields = {};
    if (typeof body.full_name === "string") allowedFields.full_name = body.full_name;
    if (typeof body.avatar_base64 === "string") allowedFields.avatar_base64 = body.avatar_base64;

    const updated = await updateUser(user.id, allowedFields);

    if (allowedFields.full_name || allowedFields.avatar_base64 !== undefined) {
      hub.broadcastAll({
        type: "user:updated",
        payload: {
          old_username: user.username,
          username: updated.username,
          full_name: updated.full_name,
          avatar_base64: updated.avatar_base64 || ""
        }
      });
    }

    return { user: updated };
  } catch (error) {
    app.log.error("Error updating profile:", error);
    return reply.code(500).send({ error: "profile_update_failed" });
  }
});

app.get("/workspaces", async (request, reply) => {
  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const userEmail = request.headers["x-user-email"];
    if (!userEmail) {
      return reply.code(400).send({ error: "user_email_required" });
    }

    const user = await getUserByEmail(userEmail);
    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // Return workspaces with their IDs and secrets
    const { states } = mustInit();
    const workspaces = await Promise.all(
      (user.workspaces || []).map(async (wsId) => {
        const wsState = await states.findOne({ workspace_id: wsId });
        return {
          workspace_id: wsId,
          secret: wsState?.secret || null
        };
      })
    );

    return { workspaces };
  } catch (error) {
    app.log.error("Error getting user workspaces:", error);
    return reply.code(500).send({ error: "failed_to_get_workspaces" });
  }
});

app.get("/workspace/check/:id", async (request) => {
  if (!isAuthorized(request)) {
    return { error: "unauthorized" };
  }

  const { id } = request.params;
  return await checkWorkspaceExists(id);
});

app.get("/workspace/:id/members", async (request, reply) => {
  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const { id } = request.params;
    const workspaceId = String(id || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

    // Get all users who are members of this workspace
    const { users } = mustInit();
    const members = await users
      .find({ workspaces: workspaceId })
      .toArray();

    // Return sanitized user info
    const memberList = members.map(user => ({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      avatar_base64: user.avatar_base64 || ""
    }));

    return { members: memberList };
  } catch (error) {
    app.log.error("Error getting workspace members:", error);
    return reply.code(500).send({ error: "failed_to_get_members" });
  }
});

app.post("/workspace/join", async (request, reply) => {
  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const { workspaceId, secret, userEmail } = request.body || {};

    if (!workspaceId || !secret || !userEmail) {
      return reply.code(400).send({ error: "workspace_secret_email_required" });
    }

    const user = await joinWorkspace(userEmail, workspaceId, secret);
    return { user, workspace: { id: workspaceId } };
  } catch (error) {
    if (error.message === "workspace_not_found") {
      return reply.code(404).send({ error: "workspace_not_found" });
    }
    if (error.message === "invalid_secret") {
      return reply.code(403).send({ error: "invalid_secret" });
    }
    return reply.code(400).send({ error: error.message });
  }
});

app.post("/workspace/create", async (request, reply) => {
  if (!isAuthorized(request)) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const { workspaceId, userEmail } = request.body || {};

    if (!workspaceId || !userEmail) {
      return reply.code(400).send({ error: "workspace_id_email_required" });
    }

    const workspace = await createWorkspace(workspaceId);

    // Automatically join the creator to the workspace
    const user = await joinWorkspace(userEmail, workspaceId, workspace.secret);

    return { workspace, user };
  } catch (error) {
    if (error.message === "Workspace already exists") {
      return reply.code(409).send({ error: "workspace_already_exists" });
    }
    return reply.code(400).send({ error: error.message });
  }
});

app.get("/admin-api/users", async () => {
  return { users: await listUsers() };
});

app.post("/admin-api/users", async (request, reply) => {
  try {
    const user = await createUser(request.body || {});
    return { user };
  } catch (error) {
    return userErrorResponse(reply, error);
  }
});

app.put("/admin-api/users/:id", async (request, reply) => {
  try {
    const body = request.body || {};

    // Eski username'i al (değişmeden önce)
    const oldUser = await listUsers().then(users =>
      users.find(u => u.id === request.params.id)
    );

    const user = await updateUser(request.params.id, body);
    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // If username/full_name/avatar changed, notify all connected workspaces.
    if (body.username !== undefined || body.full_name !== undefined || body.avatar_base64 !== undefined) {
      hub.broadcastAll({
        type: "user:updated",
        payload: {
          old_username: oldUser?.username,
          username: user.username,
          full_name: user.full_name,
          avatar_base64: user.avatar_base64 || ""
        }
      });
    }

    return { user };
  } catch (error) {
    return userErrorResponse(reply, error);
  }
});

app.get("/admin-api/workspaces", async (request, reply) => {
  try {
    const workspaces = await listWorkspaces();
    return { workspaces };
  } catch (error) {
    app.log.error("Error listing workspaces:", error);
    return reply.code(500).send({ error: "Failed to list workspaces" });
  }
});

app.get("/admin-api/workspaces/:id/stats", async (request, reply) => {
  try {
    const { id } = request.params;
    const stats = await getWorkspaceStats(id);
    return stats;
  } catch (error) {
    app.log.error("Error getting workspace stats:", error);
    return reply.code(500).send({ error: "Failed to get workspace stats" });
  }
});

app.post("/admin-api/workspaces", async (request, reply) => {
  try {
    const { workspaceId } = request.body || {};

    if (!workspaceId || typeof workspaceId !== "string" || workspaceId.length < 2) {
      return reply.code(400).send({ error: "Invalid workspace ID (min 2 characters)" });
    }

    const result = await createWorkspace(workspaceId);
    return result;
  } catch (error) {
    app.log.error("Error creating workspace:", error);
    if (error.message === "Workspace already exists") {
      return reply.code(409).send({ error: error.message });
    }
    return reply.code(500).send({ error: "Failed to create workspace" });
  }
});

app.delete("/admin-api/workspaces/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await deleteWorkspace(id);
    return result;
  } catch (error) {
    app.log.error("Error deleting workspace:", error);
    return reply.code(500).send({ error: "Failed to delete workspace" });
  }
});

app.get("/tasks", async (request, reply) => {
  const hasAccess = await checkWorkspaceAccess(request, reply);
  if (!hasAccess) return;

  const workspaceId = readWorkspace(request);
  return { tasks: await getTasks(workspaceId) };
});

app.post("/tasks/bulk", async (request, reply) => {
  const hasAccess = await checkWorkspaceAccess(request, reply);
  if (!hasAccess) return;

  const workspaceId = readWorkspace(request);
  const body = request.body || {};
  const items = Array.isArray(body.tasks) ? body.tasks : [];

  await replaceTasks(workspaceId, items, "api:bulk_replace");
  const all = await getTasks(workspaceId);

  hub.broadcast(workspaceId, { type: "task_list_full", payload: { tasks: all } });
  return { tasks: all };
});

app.post("/tasks", async (request, reply) => {
  const hasAccess = await checkWorkspaceAccess(request, reply);
  if (!hasAccess) return;

  const workspaceId = readWorkspace(request);
  const userEmail = readUserEmail(request);
  const user = await getUserByEmail(userEmail);
  const username = user?.username || null;

  const taskInput = request.body?.task;
  if (!taskInput) {
    return reply.code(400).send({ error: "task_required" });
  }

  const task = await upsertTask(workspaceId, taskInput, "api:task_update");

  hub.broadcast(workspaceId, { type: "task_changed", payload: { task, updated_by: username } });
  return { task };
});

app.patch("/tasks/:id/toggle", async (request, reply) => {
  const hasAccess = await checkWorkspaceAccess(request, reply);
  if (!hasAccess) return;

  const workspaceId = readWorkspace(request);
  const userEmail = readUserEmail(request);
  const user = await getUserByEmail(userEmail);
  const username = user?.username || null;

  const done = Boolean(request.body?.done);
  const task = await toggleTask(workspaceId, request.params.id, done);

  if (!task) {
    return reply.code(404).send({ error: "task_not_found" });
  }

  hub.broadcast(workspaceId, { type: "task_changed", payload: { task, updated_by: username } });
  return { task };
});

app.patch("/tasks/:id/progress", async (request, reply) => {
  const hasAccess = await checkWorkspaceAccess(request, reply);
  if (!hasAccess) return;

  const workspaceId = readWorkspace(request);
  const userEmail = readUserEmail(request);
  const user = await getUserByEmail(userEmail);
  const username = user?.username || null;

  const progress = request.body?.progress;
  const task = await updateTaskProgress(workspaceId, request.params.id, progress);

  if (!task) {
    return reply.code(404).send({ error: "task_not_found" });
  }

  hub.broadcast(workspaceId, { type: "task_changed", payload: { task, updated_by: username } });
  return { task };
});

app.register(async function (fastify) {
  fastify.get("/realtime", { websocket: true }, (socket, request) => {
    const workspaceId = readWorkspace(request);
    if (!isAuthorized(request)) {
      socket.close(1008, "unauthorized");
      return;
    }

    // Username'i query param'dan al (opsiyonel, varsa unique user counting için)
    const username = readQueryParam(request, "username") || null;
    const userEmail = readUserEmail(request);
    console.log("🔌 WebSocket connection:", { workspaceId, username, userEmail });

    hub.addClient(workspaceId, socket, username);

    (async () => {
      // Check workspace access
      if (userEmail) {
        const hasAccess = await canUserAccessWorkspace(userEmail, workspaceId);
        if (!hasAccess) {
          socket.close(1008, "workspace_access_denied");
          return;
        }
      }

      hub.send(socket, {
        type: "task_list_full",
        payload: { tasks: await getTasks(workspaceId) }
      });
    })().catch(() => {
      socket.close(1011, "init_failed");
    });

    socket.on("message", (raw) => {
      (async () => {
        const message = JSON.parse(String(raw || "{}"));

        if (message.type === "request_full_sync") {
          hub.send(socket, {
            type: "task_list_full",
            payload: { tasks: await getTasks(workspaceId) }
          });
          return;
        }

        if (message.type === "task_update" && message.payload?.task) {
          const task = await upsertTask(workspaceId, message.payload.task, "ws:task_update");
          console.log("📤 Broadcasting task_changed:", {
            taskId: task.id,
            username: username,
            workspaceId: workspaceId
          });
          hub.broadcast(workspaceId, {
            type: "task_changed",
            payload: { task, updated_by: username }
          });
          return;
        }

        if (message.type === "task_bulk_update" && Array.isArray(message.payload?.tasks)) {
          await replaceTasks(workspaceId, message.payload.tasks, "ws:bulk_replace");
          hub.broadcast(workspaceId, {
            type: "task_list_full",
            payload: { tasks: await getTasks(workspaceId) }
          });
        }
      })().catch(() => {
        hub.send(socket, {
          type: "error",
          payload: { message: "invalid_message" }
        });
      });
    });

    socket.on("close", () => {
      hub.removeClient(workspaceId, socket);
    });
  });
});

async function start() {
  await initStore();
  await app.listen({ port: PORT, host: HOST });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
