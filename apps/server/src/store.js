import crypto from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { serializeTasksToMarkdown } from "@todoco/shared/markdown";
import { createTask, mergeTask } from "@todoco/shared/task";

const SAMPLE_TASKS = [
  {
    id: "sample-new-task",
    text: "This is a new task just created.",
    assignee_id: "ec",
    assignee_name: "Emre Caliskan",
    priority: 0,
    progress: 0,
    done: false
  },
  {
    id: "sample-progress-task",
    text: "This one is in progress",
    assignee_id: "cg",
    assignee_name: "Can Goymen",
    priority: 1,
    progress: 35,
    done: false
  },
  {
    id: "sample-hardest-task",
    text: "That was the hardest task ever :P",
    assignee_id: "cg",
    assignee_name: "Can Goymen",
    priority: 2,
    progress: 100,
    done: true
  }
];

let client;
let collections;

function nowIso() {
  return new Date().toISOString();
}

export function mustInit() {
  if (!collections) {
    throw new Error("store_not_initialized");
  }
  return collections;
}

function normalizePriority(task, fallback = 0) {
  const value = Number(task?.priority);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function normalizedPriority(task) {
  const value = Number(task?.priority);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) {
      return a.done ? 1 : -1;
    }

    const byPriority = normalizedPriority(a) - normalizedPriority(b);
    if (byPriority !== 0) {
      return byPriority;
    }

    return Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [scheme, salt, expectedHash] = String(encoded || "").split("$");
  if (scheme !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    username: user.username,
    full_name: user.full_name,
    email: user.email || "",
    avatar_base64: user.avatar_base64 || "",
    is_admin: Boolean(user.is_admin),
    workspaces: Array.isArray(user.workspaces) ? user.workspaces : [],
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

async function getUserLookupMaps() {
  const { users } = mustInit();
  const rows = await users
    .find({}, { projection: { username: 1, full_name: 1 } })
    .toArray();

  const byUsername = new Map();
  const byFullName = new Map();
  const byFullNameLower = new Map();

  rows.forEach((row) => {
    const username = String(row.username || "").trim();
    const fullName = String(row.full_name || "").trim();
    if (username) {
      byUsername.set(username, row);
    }
    if (fullName) {
      byFullName.set(fullName, row);
      byFullNameLower.set(fullName.toLowerCase(), row);
    }
  });

  return { byUsername, byFullName, byFullNameLower };
}

async function mapTaskAssignees(tasks) {
  const maps = await getUserLookupMaps();

  return tasks.map((task, index) => {
    const rawAssigneeId = String(task?.assignee_id || "").trim();
    const rawAssigneeName = String(task?.assignee_name || "").trim();

    const matchedByName =
      maps.byFullName.get(rawAssigneeName) || maps.byFullNameLower.get(rawAssigneeName.toLowerCase());
    const matchedById = maps.byUsername.get(rawAssigneeId);
    const matched = matchedByName || matchedById;

    if (!matched) {
      return createTask(
        {
          ...task,
          priority: normalizePriority(task, index),
          updated_at: task?.updated_at || nowIso()
        },
        index
      );
    }

    return createTask(
      {
        ...task,
        assignee_id: matched.username,
        assignee_name: matched.full_name,
        priority: normalizePriority(task, index),
        updated_at: task?.updated_at || nowIso()
      },
      index
    );
  });
}

async function seedWorkspaceIfMissing(workspaceId) {
  const { states, versions } = mustInit();
  const existing = await states.findOne({ workspace_id: workspaceId });
  if (existing) {
    return existing;
  }

  const seededAt = nowIso();
  const seededTasks = await mapTaskAssignees(
    SAMPLE_TASKS.map((task, index) =>
      createTask(
        {
          ...task,
          priority: index,
          updated_at: seededAt
        },
        index
      )
    )
  );

  const normalized = sortTasks(seededTasks);
  const secret = generateWorkspaceSecret();
  const state = {
    workspace_id: workspaceId,
    secret,
    tasks: normalized,
    version: 1,
    updated_at: seededAt
  };

  try {
    await states.insertOne(state);
    await versions.insertOne({
      workspace_id: workspaceId,
      version: 1,
      markdown: serializeTasksToMarkdown(normalized),
      tasks: normalized,
      actor: "system:seed",
      created_at: seededAt
    });
  } catch {
    const race = await states.findOne({ workspace_id: workspaceId });
    if (race) {
      return race;
    }
    throw new Error("workspace_seed_failed");
  }

  return state;
}

async function getWorkspaceState(workspaceId) {
  const { states } = mustInit();
  const current = await states.findOne({ workspace_id: workspaceId });
  if (current) {
    return current;
  }
  return seedWorkspaceIfMissing(workspaceId);
}

async function writeWorkspaceState(workspaceId, nextTasks, actor = "system") {
  const { states, versions } = mustInit();
  const current = await getWorkspaceState(workspaceId);

  const mapped = await mapTaskAssignees(nextTasks);
  const normalized = sortTasks(mapped.map((task, index) => createTask(task, index)));
  const updatedAt = nowIso();
  const nextVersion = Number(current.version || 0) + 1;

  await states.updateOne(
    { workspace_id: workspaceId },
    {
      $set: {
        workspace_id: workspaceId,
        tasks: normalized,
        version: nextVersion,
        updated_at: updatedAt
      }
    },
    { upsert: true }
  );

  await versions.insertOne({
    workspace_id: workspaceId,
    version: nextVersion,
    markdown: serializeTasksToMarkdown(normalized),
    tasks: normalized,
    actor,
    created_at: updatedAt
  });

  return normalized;
}

function nextPriority(tasks) {
  const priorities = tasks
    .map((task) => Number(task.priority))
    .filter((value) => Number.isFinite(value));

  if (priorities.length === 0) {
    return 0;
  }

  return Math.max(...priorities) + 1;
}

export async function initStore(options = {}) {
  if (client) {
    return;
  }

  const mongoUri = options.mongo_uri || process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const mongoDb = options.mongo_db || process.env.MONGO_DB || "todoco";

  client = new MongoClient(mongoUri, {
    ignoreUndefined: true
  });
  await client.connect();

  const db = client.db(mongoDb);
  collections = {
    states: db.collection("workspace_states"),
    versions: db.collection("workspace_versions"),
    users: db.collection("users")
  };

  await Promise.all([
    collections.states.createIndex({ workspace_id: 1 }, { unique: true }),
    collections.versions.createIndex({ workspace_id: 1, version: 1 }, { unique: true }),
    collections.versions.createIndex({ workspace_id: 1, created_at: -1 }),
    collections.users.createIndex({ username: 1 }, { unique: true }),
    collections.users.createIndex({ full_name: 1 }, { unique: true }),
    collections.users.createIndex({ email: 1 }, { unique: true, sparse: true })
  ]);

  const adminUsername = String(process.env.ADMIN_USERNAME || "admin").trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "admin123");
  const adminName = String(process.env.ADMIN_FULL_NAME || "Admin User").trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || "admin@todoco.local").trim();

  const existing = await collections.users.findOne({ username: adminUsername });
  if (!existing) {
    const now = nowIso();
    await collections.users.insertOne({
      username: adminUsername,
      full_name: adminName,
      email: adminEmail,
      avatar_base64: "",
      password_hash: hashPassword(adminPassword),
      is_admin: true,
      workspaces: [],
      created_at: now,
      updated_at: now
    });
  } else if (!existing.is_admin) {
    await collections.users.updateOne(
      { _id: existing._id },
      {
        $set: {
          is_admin: true,
          updated_at: nowIso()
        }
      }
    );
  }

  // Migration: Add secrets to existing workspaces
  const workspacesWithoutSecret = await collections.states.find({
    secret: { $exists: false }
  }).toArray();

  if (workspacesWithoutSecret.length > 0) {
    await Promise.all(
      workspacesWithoutSecret.map(workspace =>
        collections.states.updateOne(
          { _id: workspace._id },
          {
            $set: {
              secret: generateWorkspaceSecret(),
              updated_at: nowIso()
            }
          }
        )
      )
    );

    console.log(`✅ Added secrets to ${workspacesWithoutSecret.length} existing workspaces`);
  }

  // Migration: Add workspaces field to existing users
  const usersWithoutWorkspaces = await collections.users.find({
    workspaces: { $exists: false }
  }).toArray();

  if (usersWithoutWorkspaces.length > 0) {
    // Get all workspace IDs
    const allWorkspaces = await collections.states.find({}).toArray();
    const workspaceIds = allWorkspaces.map(doc => doc.workspace_id);

    // Give all existing users access to all workspaces for backward compatibility
    await Promise.all(
      usersWithoutWorkspaces.map(user =>
        collections.users.updateOne(
          { _id: user._id },
          {
            $set: {
              workspaces: workspaceIds,
              updated_at: nowIso()
            }
          }
        )
      )
    );

    console.log(`✅ Migrated ${usersWithoutWorkspaces.length} users with workspace access to ${workspaceIds.length} workspaces`);
  }
}

export async function getTasks(workspaceId) {
  const state = await getWorkspaceState(workspaceId);
  return sortTasks((state.tasks || []).map((task, index) => createTask(task, index)));
}

export async function replaceTasks(workspaceId, items, actor = "bulk_replace") {
  const normalized = items.map((task, index) =>
    createTask(
      {
        ...task,
        priority: normalizePriority(task, index),
        updated_at: task?.updated_at || nowIso()
      },
      index
    )
  );

  return writeWorkspaceState(workspaceId, normalized, actor);
}

export async function upsertTask(workspaceId, taskInput, actor = "task_update") {
  const current = await getTasks(workspaceId);
  const taskId = String(taskInput?.id || "").trim();
  const currentIndex = taskId ? current.findIndex((item) => item.id === taskId) : -1;

  const incoming = createTask(
    {
      ...taskInput,
      id: taskId || undefined,
      priority: taskInput?.priority ?? (currentIndex >= 0 ? current[currentIndex].priority : nextPriority(current)),
      updated_at: nowIso()
    },
    currentIndex >= 0 ? currentIndex : current.length
  );

  const nextTasks = [...current];
  if (currentIndex >= 0) {
    nextTasks[currentIndex] = mergeTask(current[currentIndex], incoming);
  } else {
    nextTasks.push(incoming);
  }

  const persisted = await writeWorkspaceState(workspaceId, nextTasks, actor);
  return persisted.find((task) => task.id === incoming.id) || incoming;
}

export async function toggleTask(workspaceId, taskId, done) {
  const current = await getTasks(workspaceId);
  const index = current.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return null;
  }

  const previous = current[index];
  const updated = createTask(
    {
      ...previous,
      done,
      progress: done ? 100 : previous.progress,
      updated_at: nowIso()
    },
    index
  );

  const nextTasks = [...current];
  nextTasks[index] = updated;

  const persisted = await writeWorkspaceState(workspaceId, nextTasks, "task_toggle");
  return persisted.find((task) => task.id === taskId) || updated;
}

export async function updateTaskProgress(workspaceId, taskId, progressInput) {
  const current = await getTasks(workspaceId);
  const index = current.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return null;
  }

  const parsed = Number(progressInput);
  const progress = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : current[index].progress;

  const updated = createTask(
    {
      ...current[index],
      progress,
      updated_at: nowIso()
    },
    index
  );

  const nextTasks = [...current];
  nextTasks[index] = updated;

  const persisted = await writeWorkspaceState(workspaceId, nextTasks, "task_progress");
  return persisted.find((task) => task.id === taskId) || updated;
}

export async function listUsers() {
  const { users } = mustInit();
  const rows = await users.find({}).sort({ full_name: 1 }).toArray();
  return rows.map(sanitizeUser);
}

export async function verifyAdminLogin(username, password) {
  const { users } = mustInit();
  const normalizedUsername = String(username || "").trim();
  const rawPassword = String(password || "");
  if (!normalizedUsername || !rawPassword) {
    return null;
  }

  const user = await users.findOne({ username: normalizedUsername });
  if (!user || !user.is_admin) {
    return null;
  }

  if (!verifyPassword(rawPassword, user.password_hash)) {
    return null;
  }

  return sanitizeUser(user);
}

export async function verifyUserLogin(email, password) {
  const { users } = mustInit();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  if (!normalizedEmail || !rawPassword) {
    return null;
  }

  const user = await users.findOne({ email: normalizedEmail });
  if (!user) {
    return null;
  }

  if (!verifyPassword(rawPassword, user.password_hash)) {
    return null;
  }

  return sanitizeUser(user);
}

export async function createUser(input) {
  const { users } = mustInit();

  const username = String(input?.username || "")
    .trim()
    .toLowerCase();
  const fullName = String(input?.full_name || "").trim();
  const email = String(input?.email || "").trim();
  const password = String(input?.password || "");

  if (!username) {
    throw new Error("username_required");
  }
  if (!fullName) {
    throw new Error("full_name_required");
  }
  if (!password) {
    throw new Error("password_required");
  }

  const now = nowIso();
  const document = {
    username,
    full_name: fullName,
    email,
    avatar_base64: String(input?.avatar_base64 || ""),
    password_hash: hashPassword(password),
    is_admin: Boolean(input?.is_admin),
    workspaces: Array.isArray(input?.workspaces) ? input.workspaces : [],
    created_at: now,
    updated_at: now
  };

  try {
    const result = await users.insertOne(document);
    const inserted = await users.findOne({ _id: result.insertedId });
    return sanitizeUser(inserted);
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error("user_already_exists");
    }
    throw error;
  }
}

export async function updateUser(userId, input) {
  const { users } = mustInit();

  let objectId;
  try {
    objectId = new ObjectId(String(userId));
  } catch {
    throw new Error("invalid_user_id");
  }

  const existing = await users.findOne({ _id: objectId });
  if (!existing) {
    return null;
  }

  const set = {
    updated_at: nowIso()
  };

  if (typeof input?.username === "string") {
    const username = input.username.trim().toLowerCase();
    if (!username) {
      throw new Error("username_required");
    }
    set.username = username;
  }

  if (typeof input?.full_name === "string") {
    const fullName = input.full_name.trim();
    if (!fullName) {
      throw new Error("full_name_required");
    }
    set.full_name = fullName;
  }

  if (typeof input?.email === "string") {
    set.email = input.email.trim();
  }

  if (typeof input?.avatar_base64 === "string") {
    set.avatar_base64 = input.avatar_base64;
  }

  if (typeof input?.is_admin === "boolean") {
    set.is_admin = input.is_admin;
  }

  if (typeof input?.password === "string" && input.password.trim()) {
    set.password_hash = hashPassword(input.password.trim());
  }

  if (Array.isArray(input?.workspaces)) {
    set.workspaces = input.workspaces;
  }

  try {
    const { users } = mustInit();

    await users.updateOne({ _id: objectId }, { $set: set });
    const updated = await users.findOne({ _id: objectId });

    // TODO: Update tasks in workspace_states when username or full_name changes
    // Tasks are stored within workspace_states documents, not in a separate collection

    return sanitizeUser(updated);
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error("user_already_exists");
    }
    throw error;
  }
}

function generateWorkspaceSecret() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters (0, O, I, 1)
  let secret = '';
  for (let i = 0; i < 6; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export async function listWorkspaces() {
  const { states } = mustInit();
  const docs = await states.find({}).toArray();
  return docs.map(doc => ({
    id: doc.workspace_id,
    secret: doc.secret || '',
    taskCount: doc.tasks?.length || 0,
    lastModified: doc.updated_at || doc._id.getTimestamp()
  }));
}

export async function getWorkspaceStats(workspaceId) {
  const state = await getWorkspaceState(workspaceId);
  const taskCount = state.tasks?.length || 0;

  // Count unique users who created tasks in this workspace
  const uniqueUsers = new Set(state.tasks?.map(t => t.created_by) || []);

  return {
    id: workspaceId,
    taskCount,
    userCount: uniqueUsers.size,
    tasks: state.tasks || []
  };
}

function normalizeWorkspaceId(workspaceId) {
  return String(workspaceId || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
}

export async function createWorkspace(workspaceId) {
  const { states, versions } = mustInit();
  const normalizedId = normalizeWorkspaceId(workspaceId);

  if (!normalizedId) {
    throw new Error("invalid_workspace_name");
  }

  // Check if workspace already exists
  const existing = await states.findOne({ workspace_id: normalizedId });
  if (existing) {
    throw new Error("Workspace already exists");
  }

  const now = nowIso();
  const secret = generateWorkspaceSecret();

  // Create empty workspace
  await states.insertOne({
    workspace_id: normalizedId,
    secret,
    tasks: [],
    version: 0,
    updated_at: now
  });

  await versions.insertOne({
    workspace_id: normalizedId,
    version: 0,
    markdown: "",
    tasks: [],
    actor: "system:create",
    created_at: now
  });

  return { id: workspaceId, secret, taskCount: 0 };
}

export async function deleteWorkspace(workspaceId) {
  const { states, versions, users } = mustInit();
  const normalizedId = normalizeWorkspaceId(workspaceId);

  // First try exact match with normalized ID, then try case-insensitive for old workspaces
  const workspace = await states.findOne({ workspace_id: normalizedId }) ||
                    await states.findOne({ workspace_id: new RegExp(`^${workspaceId}$`, 'i') });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const actualId = workspace.workspace_id;

  // Remove workspace from all users (both exact and case-insensitive)
  await users.updateMany(
    { workspaces: actualId },
    { $pull: { workspaces: actualId }, $set: { updated_at: nowIso() } }
  );

  // Delete workspace state and history
  await states.deleteOne({ workspace_id: actualId });
  await versions.deleteMany({ workspace_id: actualId });

  return { success: true, id: actualId };
}

export async function getUserByEmail(email) {
  const { users } = mustInit();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const user = await users.findOne({ email: normalizedEmail });
  return sanitizeUser(user);
}

export async function canUserAccessWorkspace(userEmail, workspaceId) {
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  // Admins can access all workspaces
  if (user.is_admin) {
    return true;
  }

  // Check if user has access to this workspace
  return user.workspaces.includes(workspaceId);
}

export async function checkWorkspaceExists(workspaceId) {
  const { states } = mustInit();
  const normalizedId = normalizeWorkspaceId(workspaceId);
  const workspace = await states.findOne({ workspace_id: normalizedId });
  return workspace ? { exists: true, secret: workspace.secret } : { exists: false };
}

export async function verifyWorkspaceSecret(workspaceId, secret) {
  const { states } = mustInit();
  const workspace = await states.findOne({ workspace_id: workspaceId });
  if (!workspace) {
    return false;
  }
  return workspace.secret === secret;
}

export async function joinWorkspace(userEmail, workspaceId, secret) {
  const { users, states } = mustInit();
  const normalizedId = normalizeWorkspaceId(workspaceId);

  // Verify workspace exists and secret is correct
  const workspace = await states.findOne({ workspace_id: normalizedId });
  if (!workspace) {
    throw new Error("workspace_not_found");
  }

  if (workspace.secret !== secret) {
    throw new Error("invalid_secret");
  }

  // Get user
  const user = await users.findOne({ email: userEmail.trim().toLowerCase() });
  if (!user) {
    throw new Error("user_not_found");
  }

  // Add workspace to user's workspaces if not already there
  if (!user.workspaces || !user.workspaces.includes(normalizedId)) {
    await users.updateOne(
      { _id: user._id },
      {
        $addToSet: { workspaces: normalizedId },
        $set: { updated_at: nowIso() }
      }
    );
  }

  return sanitizeUser(await users.findOne({ _id: user._id }));
}
