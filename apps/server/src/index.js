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

  if (path === "/" || path === "/health" || path === "/admin" || path === "/admin/" || path === "/admin-api/login" || path === "/auth/login" || path === "/auth/register") {
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

app.get("/", async (_, reply) => {
  reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ToDoCo — Realtime Task Execution</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#fff;overflow:hidden}
.bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.bg::before{content:'';position:absolute;top:-20%;right:-10%;width:600px;height:600px;background:radial-gradient(circle,rgba(59,130,246,0.12),transparent 70%);border-radius:50%}
.bg::after{content:'';position:absolute;bottom:-20%;left:-10%;width:500px;height:500px;background:radial-gradient(circle,rgba(16,185,129,0.08),transparent 70%);border-radius:50%}
.container{position:relative;z-index:1;text-align:center;padding:40px 24px;max-width:560px}
.logo{margin-bottom:32px}
.logo-icon{width:120px;height:120px;margin:0 auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);border-radius:28px}
.logo-icon svg{width:100%;height:100%;display:block}
h1{font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:24px}
.tagline{font-size:40px;font-weight:700;letter-spacing:-0.03em;line-height:1.15;margin-bottom:8px;background:linear-gradient(135deg,#fff 0%,#94a3b8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.tagline em{font-style:normal;background:linear-gradient(135deg,#3b82f6,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{font-size:18px;color:#6b7280;margin-bottom:16px;letter-spacing:-0.01em}
.opensource{font-size:13px;color:#4b5563;margin-bottom:40px;letter-spacing:0.01em}
.opensource a{color:#6b7280;text-decoration:none;border-bottom:1px solid rgba(107,114,128,0.3);transition:color 0.2s}
.opensource a:hover{color:#fff}
.links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;text-decoration:none;transition:all 0.2s ease}
.btn-primary{background:#fff;color:#0a0a0a}
.btn-primary:hover{background:#e5e7eb;transform:translateY(-1px)}
.btn-outline{background:transparent;color:#d1d5db;border:1px solid rgba(255,255,255,0.12)}
.btn-outline:hover{border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.04);transform:translateY(-1px)}
.btn svg{width:18px;height:18px}
#stars:not(:empty)::before{content:'\\2605\\00a0'}
#stars{font-variant-numeric:tabular-nums}
.download{margin-top:12px}
.download a{font-size:13px;color:#6b7280;text-decoration:none;transition:color 0.2s}
.download a:hover{color:#fff}
</style>
</head>
<body>
<div class="bg"></div>
<div class="container">
<div class="logo">
<div class="logo-icon">
<svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="1024" height="1024" rx="200" fill="white"/>
<circle cx="513" cy="512" r="371" fill="#747474"/>
<path d="M513 93C744.407 93 932 280.593 932 512C932 743.407 744.407 931 513 931C281.593 931 94 743.407 94 512C94 280.593 281.593 93 513 93ZM377.66 728.028C356.655 728.029 339.373 744.863 339.373 766.167C339.373 787.173 356.654 804.156 377.66 804.156C398.815 804.156 415.948 787.173 415.948 766.167C415.948 744.863 398.815 728.028 377.66 728.028ZM547.588 728.028C526.582 728.029 509.301 744.863 509.301 766.167C509.301 787.173 526.582 804.156 547.588 804.156C568.743 804.156 585.876 787.173 585.876 766.167C585.876 744.863 568.743 728.028 547.588 728.028ZM701.658 728.028C680.652 728.028 663.371 744.863 663.371 766.167C663.371 787.173 680.652 804.156 701.658 804.156C722.813 804.156 739.945 787.173 739.945 766.167C739.945 744.863 722.813 728.028 701.658 728.028ZM477.571 693.913C476.231 693.913 475.337 694.807 475.337 696.147V735.478C470.868 731.008 465.057 728.178 457.608 728.178C437.198 728.178 422.301 745.013 422.301 766.316C422.301 787.322 437.199 803.71 457.608 803.71C466.696 803.71 473.102 800.134 477.571 794.92L478.316 800.432C478.465 801.772 479.21 802.667 480.551 802.667H497.684C499.024 802.667 499.918 801.772 499.918 800.432V696.147C499.918 694.807 499.024 693.913 497.684 693.913H477.571ZM629.771 728.178C608.765 728.178 592.229 744.714 592.229 765.571C592.229 786.875 608.765 803.71 629.771 803.71C641.391 803.71 651.67 798.644 658.523 790.748C659.417 789.705 659.268 788.514 658.374 787.62L646.158 775.851C645.115 774.808 644.073 774.957 642.881 775.851C638.71 779.426 634.687 780.767 630.516 780.767C622.024 780.767 615.916 774.063 615.916 765.571C615.916 757.526 622.024 750.972 630.516 750.972C634.389 750.972 638.411 752.312 642.434 755.888C643.625 756.931 644.668 757.228 645.711 756.186L657.928 744.268C658.822 743.374 658.97 742.181 658.076 741.139C651.223 733.243 641.093 728.178 629.771 728.178ZM298.695 707.321C297.355 707.321 296.461 708.215 296.461 709.556V729.668H284.542C283.201 729.668 282.308 730.562 282.308 731.902V747.247C282.308 748.588 283.201 749.481 284.542 749.481H296.461V800.432C296.461 801.772 297.355 802.667 298.695 802.667H318.808C320.148 802.667 321.042 801.772 321.042 800.432V749.481H332.96C334.301 749.481 335.195 748.588 335.195 747.247V731.902C335.195 730.562 334.301 729.668 332.96 729.668H321.042V709.556C321.042 708.215 320.148 707.321 318.808 707.321H298.695ZM377.66 750.822C385.705 750.822 392.261 757.228 392.261 766.167C392.261 774.808 385.705 781.214 377.66 781.214C369.616 781.214 363.061 774.808 363.061 766.167C363.061 757.229 369.616 750.822 377.66 750.822ZM460.588 750.524C469.377 750.525 475.187 757.377 475.188 766.167C475.188 774.957 469.377 781.214 460.588 781.214C452.096 781.214 445.988 775.255 445.988 766.167C445.988 756.93 452.096 750.524 460.588 750.524ZM547.588 750.822C555.633 750.822 562.188 757.228 562.188 766.167C562.188 774.808 555.633 781.214 547.588 781.214C539.543 781.214 532.988 774.808 532.988 766.167C532.988 757.229 539.543 750.823 547.588 750.822ZM701.658 750.822C709.703 750.822 716.258 757.228 716.258 766.167C716.258 774.808 709.703 781.214 701.658 781.214C693.613 781.214 687.059 774.808 687.059 766.167C687.059 757.228 693.613 750.822 701.658 750.822ZM729.025 266.735C709.273 250.275 679.917 252.944 663.457 272.696L495.952 473.701C479.811 493.071 470.736 503.795 463.491 510.385C463.398 510.47 463.305 510.553 463.215 510.634C463.117 510.561 463.017 510.488 462.916 510.411C455.104 504.504 445.096 494.646 427.268 476.817L359.697 409.247C341.516 391.066 312.038 391.066 293.857 409.247C275.677 427.428 275.677 456.906 293.857 475.087L361.428 542.657C377.31 558.539 392.585 573.964 406.757 584.68C421.997 596.204 441.957 607.041 467.535 605.881C493.113 604.72 512.009 592.121 526.144 579.265C539.287 567.31 553.104 550.564 567.482 533.31L734.986 332.304C751.447 312.551 748.778 283.196 729.025 266.735Z" fill="white"/>
</svg>
</div>
</div>
<p class="tagline">Agile is evolving into <em>AIGILE</em></p>
<p class="subtitle">Realtime task execution for modern teams</p>
<p class="opensource">Free &amp; <a href="https://github.com/CanGoymen/todoco" target="_blank">open-source</a> collaborative task management</p>
<div class="links">
<a class="btn btn-outline" href="https://github.com/CanGoymen/todoco" target="_blank">
<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
GitHub <span id="stars"></span>
</a>
<a href="https://www.producthunt.com/products/todoco?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-todoco" target="_blank" rel="noopener noreferrer"><img alt="todoco - AIGILE tool for realtime task collaboration | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1077549&amp;theme=light&amp;t=1770787440530" style="border-radius:12px"/></a>
</div>
<div class="download">
<a href="https://github.com/CanGoymen/todoco/releases/latest" target="_blank">
<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
Download for macOS
</a>
</div>
</div>
<script>fetch('https://api.github.com/repos/CanGoymen/todoco').then(r=>r.json()).then(d=>{if(d.stargazers_count!=null)document.getElementById('stars').textContent=d.stargazers_count}).catch(()=>{})</script>
</body>
</html>`);
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
      hub.send(socket, hub.getPresencePayload(workspaceId));
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
          hub.send(socket, hub.getPresencePayload(workspaceId));
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
