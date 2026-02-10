export function createRealtimeHub() {
  const clientsByWorkspace = new Map();
  const clientMetadata = new Map(); // Map<ws, {workspaceId, username}>

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

  function notifyPresence(workspaceId) {
    const clients = getWorkspaceClients(workspaceId);

    // Unique user'ları say (aynı user birden fazla connection açabilir)
    const uniqueUsers = new Set();
    clients.forEach((ws) => {
      const metadata = clientMetadata.get(ws);
      console.log("🔍 Client metadata:", metadata);
      if (metadata?.username) {
        uniqueUsers.add(metadata.username);
      }
    });

    console.log("📢 Broadcasting presence:", {
      workspaceId,
      connected: uniqueUsers.size,
      online_users: Array.from(uniqueUsers)
    });

    broadcast(workspaceId, {
      type: "user_presence_update",
      payload: {
        workspace_id: workspaceId,
        connected: uniqueUsers.size,
        online_users: Array.from(uniqueUsers)
      }
    });
  }

  function addClient(workspaceId, ws, username) {
    const clients = getWorkspaceClients(workspaceId);
    clients.add(ws);

    // Client metadata sakla
    if (username) {
      clientMetadata.set(ws, { workspaceId, username });
      console.log("✅ Stored client metadata:", { workspaceId, username, totalMetadata: clientMetadata.size });
    } else {
      console.log("⚠️  No username provided for client");
    }

    notifyPresence(workspaceId);
  }

  function removeClient(workspaceId, ws) {
    const clients = getWorkspaceClients(workspaceId);
    clients.delete(ws);
    clientMetadata.delete(ws);
    notifyPresence(workspaceId);
  }

  return {
    addClient,
    removeClient,
    send,
    broadcast
  };
}
