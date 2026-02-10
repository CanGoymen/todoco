import { useEffect, useMemo, useState } from "react";
import { createTask as buildTask } from "@todoco/shared/task";
import { AvatarFilterBar } from "./components/AvatarFilterBar.jsx";
import { InviteFriendsScreen } from "./components/InviteFriendsScreen.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { RegisterScreen } from "./components/RegisterScreen.jsx";
import { ShareModal, ShareIcon } from "./components/ShareModal.jsx";
import { TaskList } from "./components/TaskList.jsx";
import { WorkspaceJoinScreen } from "./components/WorkspaceJoinScreen.jsx";
import { WorkspaceSwitcher, LogoutIcon, SettingsIcon } from "./components/WorkspaceSwitcher.jsx";
import { bulkUpdateTasks, checkWorkspaceExists, connectRealtime, createTask, createWorkspace, fetchTasks, getUserWorkspaces, getWorkspaceInfo, joinWorkspace, login as apiLogin, register as apiRegister, toggleTask, updateTaskProgress } from "./lib/api.js";
import { readCachedTasks, writeCachedTasks } from "./lib/cache.js";
import { clearLoggedInUser, getLoggedInUser, getRuntimeConfig, setLoggedInUser } from "./lib/config.js";
import { getSystemIdleTime, isTauriRuntime, openEditorWindow, showNotification } from "./lib/tauri.js";

const UNASSIGNED = { id: "unassigned", name: "Unassigned" };

function applyTaskChanged(tasks, changed) {
  const index = tasks.findIndex((task) => task.id === changed.id);
  if (index === -1) {
    return [changed, ...tasks];
  }

  const next = [...tasks];
  next[index] = changed;
  return next;
}

function readPriority(task, fallback = 0) {
  const value = Number(task?.priority);
  return Number.isFinite(value) ? value : fallback;
}

function assigneesFromTasks(tasks, loggedInUser) {
  const base = [UNASSIGNED];
  if (loggedInUser) {
    base.push({
      id: loggedInUser.username,
      name: loggedInUser.full_name,
      avatar_base64: loggedInUser.avatar_base64 || ""
    });
  }
  const map = new Map(base.map((item) => [item.id, item]));
  tasks.forEach((task) => {
    if (!map.has(task.assignee_id)) {
      map.set(task.assignee_id, { id: task.assignee_id, name: task.assignee_name });
    }
  });
  return [...map.values()];
}

function initials(name) {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function PersonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className="person-icon"
      aria-hidden="true"
    >
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M834.3 705.7c0 82.2-66.8 149-149 149H325.9c-82.2 0-149-66.8-149-149V346.4c0-82.2 66.8-149 149-149h129.8v-42.7H325.9c-105.7 0-191.7 86-191.7 191.7v359.3c0 105.7 86 191.7 191.7 191.7h359.3c105.7 0 191.7-86 191.7-191.7V575.9h-42.7v129.8z" />
      <path d="M889.7 163.4c-22.9-22.9-53-34.4-83.1-34.4s-60.1 11.5-83.1 34.4L312 574.9c-16.9 16.9-27.9 38.8-31.2 62.5l-19 132.8c-1.6 11.4 7.3 21.3 18.4 21.3 0.9 0 1.8-0.1 2.7-0.2l132.8-19c23.7-3.4 45.6-14.3 62.5-31.2l411.5-411.5c45.9-45.9 45.9-120.3 0-166.2zM362 585.3L710.3 237 816 342.8 467.8 691.1 362 585.3zM409.7 730l-101.1 14.4L323 643.3c1.4-9.5 4.8-18.7 9.9-26.7L436.3 720c-8 5.2-17.1 8.7-26.6 10z m449.8-430.7l-13.3 13.3-105.7-105.8 13.3-13.3c14.1-14.1 32.9-21.9 52.9-21.9s38.8 7.8 52.9 21.9c29.1 29.2 29.1 76.7-0.1 105.8z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
    </svg>
  );
}

function tasksToMarkdown(tasks) {
  return tasks.map(task => {
    const checkbox = task.done ? "[x]" : "[ ]";
    const progress = task.progress > 0 ? ` (${task.progress}%)` : "";
    const assignee = task.assignee_id && task.assignee_id !== "unassigned"
      ? ` @${task.assignee_name || task.assignee_id}`
      : "";
    return `- ${checkbox} ${task.text}${progress}${assignee}`;
  }).join("\n");
}

function markdownToTasks(markdown, existingTasks) {
  const lines = markdown.split("\n").filter(line => line.trim());
  const newTasks = [];
  const usedExistingIds = new Set();
  const textCounts = new Map();

  lines.forEach((line, index) => {
    const match = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (!match) return;

    const done = match[1].toLowerCase() === "x";
    let text = match[2].trim();
    let progress = 0;
    let assignee_id = "unassigned";
    let assignee_name = "Unassigned";

    // Extract progress
    const progressMatch = text.match(/\((\d+)%\)/);
    if (progressMatch) {
      progress = parseInt(progressMatch[1], 10);
      text = text.replace(/\s*\(\d+%\)/, "");
    }

    // Extract assignee
    const assigneeMatch = text.match(/@([\w\s]+)$/);
    if (assigneeMatch) {
      assignee_name = assigneeMatch[1].trim();
      assignee_id = assignee_name.toLowerCase().replace(/\s+/g, "");
      text = text.replace(/@[\w\s]+$/, "").trim();
    }

    // Handle duplicate texts - append number if already seen
    const originalText = text;
    const count = textCounts.get(originalText) || 0;
    if (count > 0) {
      text = `${originalText} ${count + 1}`;
    }
    textCounts.set(originalText, count + 1);

    // Try to find existing task by text to preserve ID (only if not already used)
    const existing = existingTasks.find(t => t.text === text && !usedExistingIds.has(t.id));

    let task;
    if (existing) {
      task = { ...existing, done, progress, assignee_id, assignee_name };
      usedExistingIds.add(existing.id);
    } else {
      task = buildTask({ text, done, progress, assignee_id, assignee_name, priority: index });
    }

    newTasks.push(task);
  });

  return newTasks;
}

export function App() {
  const [user, setUser] = useState(() => getLoggedInUser());
  const [tasks, setTasks] = useState([]);
  const [activeAssignee, setActiveAssignee] = useState("all");
  const [presence, setPresence] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAssigneeId, setQuickAssigneeId] = useState(() => {
    const saved = getLoggedInUser();
    return saved?.username || UNASSIGNED.id;
  });
  const [quickAssigneeMenuOpen, setQuickAssigneeMenuOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [creating, setCreating] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  // Registration flow state
  const [authView, setAuthView] = useState("login"); // "login" | "register" | "workspace-join" | "invite-friends"
  const [registrationData, setRegistrationData] = useState(null);
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentWorkspaceSecret, setCurrentWorkspaceSecret] = useState("...");
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [userWorkspaces, setUserWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(() => getRuntimeConfig().workspace);
  const [markdownEditMode, setMarkdownEditMode] = useState(false);
  const [markdownText, setMarkdownText] = useState("");

  async function handleLogin(email, password) {
    const response = await apiLogin(email, password);

    // Check if user has a valid workspace
    const currentWorkspace = localStorage.getItem("todoco_workspace");

    if (!currentWorkspace) {
      // No workspace selected, prompt user to join/create one
      setRegistrationData({
        email,
        token: response.token,
        user: response.user
      });
      setAuthView("workspace-join");
      return;
    }

    // User has workspace, proceed with login
    setLoggedInUser(response.user, response.token);
    setUser(response.user);
  }

  async function handleRegister(email, password, fullName) {
    const response = await apiRegister(email, password, fullName);
    setRegistrationData({
      email,
      token: response.token,
      user: response.user
    });
    setAuthView("workspace-join");
  }

  async function handleJoinWorkspace(workspaceId, secret, userEmail) {
    const response = await joinWorkspace(workspaceId, secret, userEmail);
    localStorage.setItem("todoco_workspace", workspaceId);
    setLoggedInUser(response.user, registrationData.token);
    setUser(response.user);
    setRegistrationData(null);
    setAuthView("login");
  }

  async function handleCreateWorkspace(workspaceId, userEmail) {
    const response = await createWorkspace(workspaceId, userEmail);
    localStorage.setItem("todoco_workspace", workspaceId);
    setWorkspaceInfo({
      name: workspaceId,
      secret: response.workspace.secret
    });
    setLoggedInUser(response.user, registrationData.token);
    setAuthView("invite-friends");
  }

  function handleContinueToApp() {
    setUser(getLoggedInUser());
    setWorkspaceInfo(null);
    setRegistrationData(null);
    setAuthView("login");
  }

  function handleLogout() {
    clearLoggedInUser();
    setUser(null);
    setTasks([]);
    setAuthView("login");
    setRegistrationData(null);
    setWorkspaceInfo(null);
    setUserWorkspaces([]);
  }

  async function handleOpenShareModal() {
    try {
      const workspace = await getWorkspaceInfo();
      if (workspace?.secret) {
        setCurrentWorkspaceSecret(workspace.secret);
      }
      setShareModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch workspace secret:", err);
      setShareModalOpen(true);
    }
  }

  function handleToggleMarkdownMode() {
    if (markdownEditMode) {
      // Exiting markdown mode - save changes
      const newTasks = markdownToTasks(markdownText, tasks);
      bulkUpdateTasks(newTasks).catch(console.error);
      setTasks(newTasks);
      writeCachedTasks(newTasks);
      setMarkdownEditMode(false);
    } else {
      // Entering markdown mode
      const markdown = tasksToMarkdown(tasks);
      setMarkdownText(markdown);
      setMarkdownEditMode(true);
    }
  }

  async function handleOpenWorkspaceSwitcher() {
    setWorkspaceSwitcherOpen(true);
    try {
      const workspaces = await getUserWorkspaces();
      setUserWorkspaces(workspaces.map(w => w.workspace_id));
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
    }
  }

  async function handleSwitchWorkspace(workspaceId) {
    localStorage.setItem("todoco_workspace", workspaceId);
    setCurrentWorkspace(workspaceId);
    // Reload tasks for the new workspace
    await syncNow();
  }

  async function syncNow() {
    try {
      const next = await fetchTasks();
      setTasks(next);
      writeCachedTasks(next);
    } catch (err) {
      if (String(err?.message || "").includes("401")) {
        handleLogout();
        return;
      }
      setTasks(readCachedTasks());
    }
  }

  useEffect(() => {
    let ws;
    let onOpen;
    let onClose;
    let onError;
    let reconnectTimer;
    let stopped = false;

    syncNow();

    function handleRealtimeMessage(message) {
      if (message.type === "task_list_full") {
        const next = message.payload?.tasks || [];
        setTasks(next);
        writeCachedTasks(next);
      }

      if (message.type === "task_changed") {
        setTasks((current) => {
          const task = message.payload.task;
          const updatedBy = message.payload.updated_by;
          const existingIndex = current.findIndex((t) => t.id === task.id);
          const isNew = existingIndex === -1;

          console.log("📨 task_changed:", {
            taskAssignee: task.assignee_id,
            updatedBy: updatedBy,
            currentUser: user?.username,
            shouldNotify: updatedBy && updatedBy !== user?.username,
            isNew
          });

          // Bildirim göster (sadece başka kullanıcıların değişiklikleri için)
          if (updatedBy && updatedBy !== user?.username) {
            if (isNew) {
              console.log("🔔 New task notification");
              showNotification("New Task", `+ ${task.text}`);
            } else {
              const oldTask = current[existingIndex];
              console.log("🔔 Comparing:", {
                oldDone: oldTask.done,
                newDone: task.done,
                oldProgress: oldTask.progress,
                newProgress: task.progress,
                oldAssignee: oldTask.assignee_id,
                newAssignee: task.assignee_id,
                oldText: oldTask.text,
                newText: task.text
              });

              if (oldTask.done !== task.done) {
                console.log("🔔 Done changed notification");
                showNotification(
                  task.done ? "Task Completed" : "Task Reopened",
                  `${task.done ? "✓" : "○"} ${task.text}`
                );
              } else if (oldTask.progress !== task.progress) {
                console.log("🔔 Progress changed notification");
                showNotification("Progress Updated", `(${oldTask.progress}%→${task.progress}%) ${task.text}`);
              } else if (oldTask.assignee_id !== task.assignee_id) {
                console.log("🔔 Assignment changed notification");
                const oldAssignee = oldTask.assignee_name || oldTask.assignee_id || "Unassigned";
                const newAssignee = task.assignee_name || task.assignee_id || "Unassigned";
                showNotification("Task Assigned", `${oldAssignee}→${newAssignee}: ${task.text}`);
              } else if (oldTask.text !== task.text) {
                console.log("🔔 Text changed notification");
                showNotification("Task Updated", `✏️ ${task.text}`);
              } else {
                console.log("🔔 No changes detected");
              }
            }
          }

          const next = applyTaskChanged(current, task);
          writeCachedTasks(next);
          return next;
        });
      }

      if (message.type === "user_presence_update") {
        const newCount = message.payload?.connected || 0;
        const oldCount = presence;
        const onlineUsersList = message.payload?.online_users || [];

        console.log("👥 Presence update:", {
          connected: newCount,
          online_users: onlineUsersList,
          current_user: user?.username
        });

        // Presence değişikliğinde bildirim
        if (newCount > oldCount) {
          showNotification("User Joined", "👋 Someone joined the workspace!");
        } else if (newCount < oldCount && newCount > 0) {
          showNotification("User Left", "👋 Someone left the workspace");
        }

        setPresence(newCount);
        setOnlineUsers(onlineUsersList);
      }

      if (message.type === "user:updated") {
        const { old_username, username, full_name, avatar_base64 } = message.payload || {};
        const oldUsername = old_username || username;

        // Logged-in user ise user state'ini güncelle
        if (user?.username === oldUsername) {
          const updatedUser = { ...user, username, full_name, avatar_base64: avatar_base64 || "" };
          setUser(updatedUser);
          setLoggedInUser(updatedUser, getRuntimeConfig().token);
        }

        // Task'lardaki assignee_id ve assignee_name'leri güncelle
        setTasks((current) => {
          const updated = current.map((task) =>
            task.assignee_id === oldUsername
              ? { ...task, assignee_id: username, assignee_name: full_name }
              : task
          );
          writeCachedTasks(updated);
          return updated;
        });
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    }

    function connect() {
      if (stopped) {
        return;
      }

      ws = connectRealtime(handleRealtimeMessage);

      onOpen = () => {
        setIsRealtimeConnected(true);
      };
      onClose = () => {
        setIsRealtimeConnected(false);
        setPresence(0);
        if (stopped) {
          return;
        }
        clearReconnectTimer();
        reconnectTimer = setTimeout(connect, 1500);
      };
      onError = () => {
        setIsRealtimeConnected(false);
      };

      ws.addEventListener("open", onOpen);
      ws.addEventListener("close", onClose);
      ws.addEventListener("error", onError);
    }

    if (user) {
      connect();
    }

    return () => {
      stopped = true;
      clearReconnectTimer();
      if (ws) {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("close", onClose);
        ws.removeEventListener("error", onError);
        ws.close();
      }
    };
  }, [user, currentWorkspace]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlistenOpen;
    let unlistenSync;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlistenOpen = await listen("open-editor", () => {
        openEditorWindow();
      });
      unlistenSync = await listen("sync-now", () => {
        syncNow();
      });
    })();

    return () => {
      if (unlistenOpen) {
        unlistenOpen();
      }
      if (unlistenSync) {
        unlistenSync();
      }
    };
  }, []);

  // Idle detection: Tauri system idle veya browser activity tracking
  useEffect(() => {
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 dakika
    const CHECK_INTERVAL = 30 * 1000; // 30 saniye

    async function checkIdle() {
      let idleTime = 0;

      // Tauri runtime ise sistem düzeyinde idle time al
      if (isTauriRuntime()) {
        idleTime = await getSystemIdleTime();
      } else {
        // Browser için fallback: son aktiviteden beri geçen süre
        const now = Date.now();
        idleTime = now - lastActivity;
      }

      const shouldBeIdle = idleTime >= IDLE_TIMEOUT;

      if (shouldBeIdle !== isIdle) {
        setIsIdle(shouldBeIdle);
      }
    }

    let lastActivity = Date.now();

    function updateActivity() {
      lastActivity = Date.now();
    }

    // Activity event listeners (browser fallback için)
    if (!isTauriRuntime()) {
      document.addEventListener("mousemove", updateActivity);
      document.addEventListener("mousedown", updateActivity);
      document.addEventListener("keydown", updateActivity);
      document.addEventListener("touchstart", updateActivity);
      document.addEventListener("scroll", updateActivity);
    }

    // Check idle status periodically
    const intervalId = setInterval(checkIdle, CHECK_INTERVAL);
    checkIdle(); // İlk kontrolü hemen yap

    return () => {
      if (!isTauriRuntime()) {
        document.removeEventListener("mousemove", updateActivity);
        document.removeEventListener("mousedown", updateActivity);
        document.removeEventListener("keydown", updateActivity);
        document.removeEventListener("touchstart", updateActivity);
        document.removeEventListener("scroll", updateActivity);
      }
      clearInterval(intervalId);
    };
  }, [isIdle]);

  const addAssignees = useMemo(() => assigneesFromTasks(tasks, user), [tasks, user]);

  useEffect(() => {
    if (!addAssignees.some((assignee) => assignee.id === quickAssigneeId)) {
      setQuickAssigneeId(UNASSIGNED.id);
    }
  }, [addAssignees, quickAssigneeId]);

  const selectedQuickAssignee = useMemo(
    () => addAssignees.find((item) => item.id === quickAssigneeId) || UNASSIGNED,
    [addAssignees, quickAssigneeId]
  );

  const filters = useMemo(() => {
    const unique = new Map();
    if (user) {
      unique.set(user.username, { name: user.full_name, avatar_base64: user.avatar_base64 || "" });
    }
    tasks.forEach((task) => {
      if (!unique.has(task.assignee_id)) {
        unique.set(task.assignee_id, { name: task.assignee_name, avatar_base64: "" });
      }
    });

    return [
      { id: "all", label: "ALL" },
      ...[...unique.entries()].map(([id, data]) => ({
        id,
        label: data.name,
        avatar_base64: data.avatar_base64
      }))
    ];
  }, [tasks, user]);

  const visibleTasks = useMemo(() => {
    if (activeAssignee === "all") {
      return tasks;
    }
    return tasks.filter((task) => task.assignee_id === activeAssignee);
  }, [tasks, activeAssignee]);

  async function handleToggleDone(task, done) {
    const previous = { done: task.done, progress: task.progress };
    setTasks((current) => {
      const next = current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              done,
              progress: done ? 100 : item.progress
            }
          : item
      );
      writeCachedTasks(next);
      return next;
    });

    try {
      await toggleTask(task.id, done);
    } catch {
      setTasks((current) => {
        const next = current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                done: previous.done,
                progress: previous.progress
              }
            : item
        );
        writeCachedTasks(next);
        return next;
      });
    }
  }

  async function handleProgressChange(task, nextProgress) {
    const previousProgress = task.progress;
    const progress = Math.max(0, Math.min(100, Math.round(Number(nextProgress) || 0)));

    setTasks((current) => {
      const next = current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              progress
            }
          : item
      );
      writeCachedTasks(next);
      return next;
    });

    try {
      await updateTaskProgress(task.id, progress);
    } catch {
      setTasks((current) => {
        const next = current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                progress: previousProgress
              }
            : item
        );
        writeCachedTasks(next);
        return next;
      });
    }
  }

  async function handleTextChange(task, nextText) {
    const text = nextText.trim();
    if (!text || text === task.text) {
      return;
    }

    const previousText = task.text;
    setTasks((current) => {
      const next = current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              text
            }
          : item
      );
      writeCachedTasks(next);
      return next;
    });

    try {
      const response = await createTask({
        ...task,
        text
      });
      if (response.task) {
        setTasks((current) => {
          const next = applyTaskChanged(current, response.task);
          writeCachedTasks(next);
          return next;
        });
      }
    } catch {
      setTasks((current) => {
        const next = current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                text: previousText
              }
            : item
        );
        writeCachedTasks(next);
        return next;
      });
    }
  }

  async function handleAssigneeChange(task, assignee) {
    if (!assignee || (task.assignee_id === assignee.id && task.assignee_name === assignee.name)) {
      return;
    }

    const previous = { id: task.assignee_id, name: task.assignee_name };
    setTasks((current) => {
      const next = current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              assignee_id: assignee.id,
              assignee_name: assignee.name
            }
          : item
      );
      writeCachedTasks(next);
      return next;
    });

    try {
      const response = await createTask({
        ...task,
        assignee_id: assignee.id,
        assignee_name: assignee.name
      });
      if (response.task) {
        setTasks((current) => {
          const next = applyTaskChanged(current, response.task);
          writeCachedTasks(next);
          return next;
        });
      }
    } catch {
      setTasks((current) => {
        const next = current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                assignee_id: previous.id,
                assignee_name: previous.name
              }
            : item
        );
        writeCachedTasks(next);
        return next;
      });
    }
  }

  async function handleCreateTask() {
    const text = quickText.trim();
    if (!text || creating) {
      return;
    }

    const assignee = selectedQuickAssignee;
    const openPriorities = tasks
      .filter((item) => !item.done)
      .map((item) => readPriority(item))
      .filter((value) => Number.isFinite(value));
    const topPriority = openPriorities.length > 0 ? Math.min(...openPriorities) - 1 : 0;

    const optimisticTask = buildTask({
      id: `task_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      text,
      assignee_id: assignee.id,
      assignee_name: assignee.name,
      priority: topPriority,
      progress: 0,
      done: false,
      updated_at: new Date().toISOString()
    });

    setCreating(true);
    setQuickText("");
    setQuickAddOpen(false);
    setQuickAssigneeMenuOpen(false);
    setQuickAssigneeId(user?.username || UNASSIGNED.id);

    setTasks((current) => {
      const next = [optimisticTask, ...current];
      writeCachedTasks(next);
      return next;
    });

    try {
      const response = await createTask(optimisticTask);
      if (response.task) {
        setTasks((current) => {
          const next = applyTaskChanged(current, response.task);
          writeCachedTasks(next);
          return next;
        });
      }
    } catch {
      setTasks((current) => {
        const next = current.filter((task) => task.id !== optimisticTask.id);
        writeCachedTasks(next);
        return next;
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleReorderOpenTasks(orderedOpenTaskIds) {
    if (!Array.isArray(orderedOpenTaskIds) || orderedOpenTaskIds.length === 0) {
      return;
    }

    const byId = new Map(tasks.map((task) => [task.id, task]));
    const currentOpen = tasks.filter((task) => !task.done).sort((a, b) => readPriority(a) - readPriority(b));
    const selectedOpen = orderedOpenTaskIds.map((id) => byId.get(id)).filter((task) => task && !task.done);
    const selectedIds = new Set(selectedOpen.map((task) => task.id));
    const remainingOpen = currentOpen.filter((task) => !selectedIds.has(task.id));
    const reorderedOpen = [...selectedOpen, ...remainingOpen];
    const doneTasks = tasks.filter((task) => task.done).sort((a, b) => readPriority(a) - readPriority(b));
    const updatedAt = new Date().toISOString();

    const next = [
      ...reorderedOpen.map((task, index) => ({
        ...task,
        priority: index,
        updated_at: updatedAt
      })),
      ...doneTasks.map((task, index) => ({
        ...task,
        priority: reorderedOpen.length + index,
        updated_at: updatedAt
      }))
    ];

    setTasks(next);
    writeCachedTasks(next);

    try {
      await bulkUpdateTasks(next);
    } catch {
      // Keep local order for offline mode; next sync will reconcile with server.
    }
  }

  const presenceLabel = isRealtimeConnected ? (presence > 0 ? `Online: ${presence}` : "Online") : "Offline";

  // Registration flow screens
  if (!user) {
    if (authView === "register") {
      return (
        <RegisterScreen
          onRegister={handleRegister}
          onBackToLogin={() => setAuthView("login")}
        />
      );
    }

    if (authView === "workspace-join" && registrationData) {
      return (
        <WorkspaceJoinScreen
          userEmail={registrationData.email}
          onJoinWorkspace={handleJoinWorkspace}
          onCheckWorkspaceExists={checkWorkspaceExists}
          onCreateWorkspace={handleCreateWorkspace}
        />
      );
    }

    if (authView === "invite-friends" && workspaceInfo) {
      return (
        <InviteFriendsScreen
          workspaceName={workspaceInfo.name}
          workspaceSecret={workspaceInfo.secret}
          onContinue={handleContinueToApp}
        />
      );
    }

    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={() => setAuthView("register")}
      />
    );
  }

  return (
    <>
      <main className={`popup-root ${markdownEditMode ? 'markdown-mode' : ''}`}>
      {!markdownEditMode && (
        <header className="popup-header">
          <AvatarFilterBar
            options={filters}
            active={activeAssignee}
            onChange={setActiveAssignee}
            loggedInUserId={user?.username}
            onlineUsers={onlineUsers}
            isConnected={isRealtimeConnected}
            isIdle={isIdle}
          />
        </header>
      )}

      <section className="popup-body">
        {!markdownEditMode && quickAddOpen ? (
          <div className="quick-add">
            <div className="quick-add-row">
              <div className="quick-assignee-wrap">
                <button
                  className="quick-assignee-trigger"
                  type="button"
                  title={selectedQuickAssignee.name}
                  onClick={() => setQuickAssigneeMenuOpen((current) => !current)}
                >
                  <span className={`quick-add-avatar ${quickAssigneeId === UNASSIGNED.id ? "unassigned" : ""}`}>
                    {quickAssigneeId === UNASSIGNED.id ? <PersonIcon /> : initials(selectedQuickAssignee.name)}
                  </span>
                </button>
                {quickAssigneeMenuOpen ? (
                  <div className="quick-assignee-menu">
                    {addAssignees.map((assignee) => (
                      <button
                        key={assignee.id}
                        className={`quick-assignee-option ${quickAssigneeId === assignee.id ? "active" : ""}`}
                        type="button"
                        onClick={() => {
                          setQuickAssigneeId(assignee.id);
                          setQuickAssigneeMenuOpen(false);
                        }}
                      >
                        <span className={`quick-add-avatar ${assignee.id === UNASSIGNED.id ? "unassigned" : ""}`}>
                          {assignee.id === UNASSIGNED.id ? <PersonIcon /> : initials(assignee.name)}
                        </span>
                        <span>{assignee.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                className="quick-add-input"
                type="text"
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="Task aciklamasi yaz..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateTask();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setQuickAddOpen(false);
                    setQuickText("");
                    setQuickAssigneeId(user?.username || UNASSIGNED.id);
                    setQuickAssigneeMenuOpen(false);
                  }
                }}
              />
            </div>
          </div>
        ) : null}
        {markdownEditMode ? (
          <textarea
            className="markdown-editor"
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder="Edit tasks as markdown..."
            autoFocus
          />
        ) : (
          <TaskList
            tasks={visibleTasks}
            onToggle={handleToggleDone}
            onProgressChange={handleProgressChange}
            onTextChange={handleTextChange}
            onAssigneeChange={handleAssigneeChange}
            assigneeOptions={addAssignees}
            onReorder={handleReorderOpenTasks}
            canReorder={activeAssignee === "all"}
          />
        )}
      </section>

      <footer className="popup-footer">
        <div className="footer-left">
          <button
            className="add-button"
            type="button"
            title="New task"
            aria-label="New task"
            onClick={() =>
              setQuickAddOpen((current) => {
                const next = !current;
                if (!next) {
                  setQuickText("");
                  setQuickAssigneeId(user?.username || UNASSIGNED.id);
                  setQuickAssigneeMenuOpen(false);
                }
                return next;
              })
            }
          >
            +
          </button>
          <span className={`presence ${isRealtimeConnected ? "online" : "offline"}`}>{presenceLabel}</span>
        </div>
        <div className="footer-right">
          <button
            className="share-button"
            type="button"
            title="Share Workspace"
            aria-label="Share Workspace"
            onClick={handleOpenShareModal}
          >
            <ShareIcon />
          </button>
          <button
            className="markdown-button"
            type="button"
            title={markdownEditMode ? "Save Markdown" : "Edit as Markdown"}
            aria-label={markdownEditMode ? "Save Markdown" : "Edit as Markdown"}
            onClick={handleToggleMarkdownMode}
          >
            {markdownEditMode ? <SaveIcon /> : <EditIcon />}
          </button>
          <button
            className="settings-button"
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={handleOpenWorkspaceSwitcher}
          >
            <SettingsIcon />
          </button>
        </div>
      </footer>
    </main>

    <ShareModal
      isOpen={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
      workspaceName={getRuntimeConfig().workspace}
      workspaceSecret={currentWorkspaceSecret}
    />

    <WorkspaceSwitcher
      isOpen={workspaceSwitcherOpen}
      onClose={() => setWorkspaceSwitcherOpen(false)}
      currentWorkspace={getRuntimeConfig().workspace}
      userWorkspaces={userWorkspaces}
      onSwitchWorkspace={handleSwitchWorkspace}
      onLogout={handleLogout}
    />
  </>
  );
}
