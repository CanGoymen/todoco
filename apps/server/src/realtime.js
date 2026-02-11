export function createRealtimeHub() {
  const clientsByWorkspace = new Map();
  const clientMetadata = new Map(); // Map<ws, {workspaceId, username}>
  const aliveClients = new Set();

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
    return {
      type: "user_presence_update",
      payload: {
        workspace_id: workspaceId,
        connected: uniqueUsers.size,
        online_users: Array.from(uniqueUsers)
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

    // Client metadata sakla
    if (username) {
      clientMetadata.set(ws, { workspaceId, username });
    }

    notifyPresence(workspaceId);
  }

  function removeClient(workspaceId, ws) {
    const clients = getWorkspaceClients(workspaceId);
    clients.delete(ws);
    clientMetadata.delete(ws);
    aliveClients.delete(ws);
    notifyPresence(workspaceId);
  }

  return {
    addClient,
    removeClient,
    send,
    broadcast,
    broadcastAll,
    getPresencePayload
  };
}
