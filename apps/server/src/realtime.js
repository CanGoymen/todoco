export function createRealtimeHub() {
  const clientsByWorkspace = new Map();
  const clientMetadata = new Map(); // Map<ws, {workspaceId, username}>
  const aliveClients = new Set();
  const idleUsersByWorkspace = new Map(); // Map<workspaceId, Set<username>>
  const userStatusByWorkspace = new Map(); // Map<workspaceId, Map<username, { emoji, text }>>
  const dndUsersByWorkspace = new Map();   // Map<workspaceId, Set<username>>
  const userLocationByWorkspace = new Map(); // Map<workspaceId, Map<username, string>>

  // Heartbeat: 30s ping, terminate if no pong within next cycle
  const PING_INTERVAL = 30_000;
  const heartbeat = setInterval(() => {
    clientMetadata.forEach((meta, ws) => {
      if (!aliveClients.has(ws)) {
        // No pong since last ping — dead connection
        const workspaceId = meta.workspaceId;
        ws.terminate();
        const clients = clientsByWorkspace.get(workspaceId);
        if (clients) clients.delete(ws);
        clientMetadata.delete(ws);
        aliveClients.delete(ws);
        if (meta.username) {
          clearIdleStatus(workspaceId, meta.username);
          const dndSet = dndUsersByWorkspace.get(workspaceId);
          if (dndSet) dndSet.delete(meta.username);
          const statusMap = userStatusByWorkspace.get(workspaceId);
          if (statusMap) statusMap.delete(meta.username);
          const locationMap = userLocationByWorkspace.get(workspaceId);
          if (locationMap) locationMap.delete(meta.username);
        }
        if (workspaceId) notifyPresence(workspaceId);
        return;
      }
      aliveClients.delete(ws);
      ws.ping();
    });
  }, PING_INTERVAL);
  heartbeat.unref();

  function getWorkspaceClients(workspaceId) {
    if (!clientsByWorkspace.has(workspaceId)) {
      clientsByWorkspace.set(workspaceId, new Set());
    }
    return clientsByWorkspace.get(workspaceId);
  }

  function getIdleUsers(workspaceId) {
    if (!idleUsersByWorkspace.has(workspaceId)) {
      idleUsersByWorkspace.set(workspaceId, new Set());
    }
    return idleUsersByWorkspace.get(workspaceId);
  }

  function getDndUsers(workspaceId) {
    if (!dndUsersByWorkspace.has(workspaceId)) {
      dndUsersByWorkspace.set(workspaceId, new Set());
    }
    return dndUsersByWorkspace.get(workspaceId);
  }

  function getUserStatuses(workspaceId) {
    if (!userStatusByWorkspace.has(workspaceId)) {
      userStatusByWorkspace.set(workspaceId, new Map());
    }
    return userStatusByWorkspace.get(workspaceId);
  }

  function getUserLocations(workspaceId) {
    if (!userLocationByWorkspace.has(workspaceId)) {
      userLocationByWorkspace.set(workspaceId, new Map());
    }
    return userLocationByWorkspace.get(workspaceId);
  }

  function setUserLocation(workspaceId, username, location) {
    if (!username) return;
    const locationMap = getUserLocations(workspaceId);
    if (!location) {
      locationMap.delete(username);
    } else {
      locationMap.set(username, location);
    }
    notifyPresence(workspaceId);
  }

  function setUserStatus(workspaceId, username, { emoji, text }) {
    if (!username) return;
    const statusMap = getUserStatuses(workspaceId);
    if (!emoji && !text) {
      statusMap.delete(username);
    } else {
      statusMap.set(username, { emoji: emoji || "", text: text || "" });
    }
    notifyPresence(workspaceId);
  }

  function setUserDnd(workspaceId, username, dnd) {
    if (!username) return;
    const dndSet = getDndUsers(workspaceId);
    if (dnd) {
      dndSet.add(username);
    } else {
      dndSet.delete(username);
    }
    notifyPresence(workspaceId);
  }

  function clearIdleStatus(workspaceId, username) {
    const idleSet = idleUsersByWorkspace.get(workspaceId);
    if (idleSet) idleSet.delete(username);
  }

  function send(ws, payload) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function broadcast(workspaceId, payload) {
    const clients = getWorkspaceClients(workspaceId);
    clients.forEach((ws) => send(ws, payload));
  }

  function broadcastAll(payload) {
    clientsByWorkspace.forEach((clients) => {
      clients.forEach((ws) => send(ws, payload));
    });
  }

  function getPresencePayload(workspaceId) {
    const clients = getWorkspaceClients(workspaceId);
    const uniqueUsers = new Set();
    clients.forEach((ws) => {
      const metadata = clientMetadata.get(ws);
      if (metadata?.username) uniqueUsers.add(metadata.username);
    });
    const idleSet = getIdleUsers(workspaceId);
    // Only include idle users who are actually online
    const idleUsers = Array.from(idleSet).filter((u) => uniqueUsers.has(u));
    // Only include DND users who are actually online
    const dndSet = getDndUsers(workspaceId);
    const dndUsers = Array.from(dndSet).filter((u) => uniqueUsers.has(u));
    // Only include statuses for online users
    const statusMap = getUserStatuses(workspaceId);
    const userStatuses = {};
    statusMap.forEach((status, username) => {
      if (uniqueUsers.has(username)) {
        userStatuses[username] = status;
      }
    });
    // Only include locations for online users
    const locationMap = getUserLocations(workspaceId);
    const userLocations = {};
    locationMap.forEach((location, username) => {
      if (uniqueUsers.has(username)) {
        userLocations[username] = location;
      }
    });
    return {
      type: "user_presence_update",
      payload: {
        workspace_id: workspaceId,
        connected: uniqueUsers.size,
        online_users: Array.from(uniqueUsers),
        idle_users: idleUsers,
        dnd_users: dndUsers,
        user_statuses: userStatuses,
        user_locations: userLocations
      }
    };
  }

  function notifyPresence(workspaceId) {
    broadcast(workspaceId, getPresencePayload(workspaceId));
  }

  function addClient(workspaceId, ws, username) {
    const clients = getWorkspaceClients(workspaceId);
    clients.add(ws);

    // Heartbeat tracking
    aliveClients.add(ws);
    ws.on("pong", () => aliveClients.add(ws));

    // Always store client metadata so heartbeat covers all connections
    clientMetadata.set(ws, { workspaceId, username: username || null });

    notifyPresence(workspaceId);
  }

  function removeClient(workspaceId, ws) {
    const meta = clientMetadata.get(ws);
    const clients = getWorkspaceClients(workspaceId);
    clients.delete(ws);
    clientMetadata.delete(ws);
    aliveClients.delete(ws);
    if (meta?.username) {
      clearIdleStatus(workspaceId, meta.username);
      const dndSet = dndUsersByWorkspace.get(workspaceId);
      if (dndSet) dndSet.delete(meta.username);
      const statusMap = userStatusByWorkspace.get(workspaceId);
      if (statusMap) statusMap.delete(meta.username);
      const locationMap = userLocationByWorkspace.get(workspaceId);
      if (locationMap) locationMap.delete(meta.username);
    }
    notifyPresence(workspaceId);
  }

  function setIdleStatus(workspaceId, username, idle) {
    if (!username) return;
    const idleSet = getIdleUsers(workspaceId);
    if (idle) {
      idleSet.add(username);
    } else {
      idleSet.delete(username);
    }
    notifyPresence(workspaceId);
  }

  return {
    addClient,
    removeClient,
    send,
    broadcast,
    broadcastAll,
    getPresencePayload,
    setIdleStatus,
    setUserStatus,
    setUserDnd,
    setUserLocation
  };
}
