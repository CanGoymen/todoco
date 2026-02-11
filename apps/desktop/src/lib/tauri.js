export function isTauriRuntime() {
  return Boolean(window.__TAURI__);
}

export async function getSystemIdleTime() {
  if (!isTauriRuntime()) {
    return 0;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    const idleTime = await invoke("get_system_idle_time");
    return idleTime;
  } catch (error) {
    console.error("Failed to get system idle time:", error);
    return 0;
  }
}

export async function showNotification(title, body) {
  if (!isTauriRuntime()) {
    // Web fallback: use browser Notification API
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
        }
      }
    }
    return;
  }

  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/api/notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }

    if (granted) {
      sendNotification({ title, body });
    } else {
      console.warn("Notification permission not granted");
    }
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}

export async function openEditorWindow() {
  if (!isTauriRuntime()) {
    window.open("/editor.html", "todoco-editor", "width=760,height=560");
    return;
  }

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/window");

    // Mevcut editor window varsa onu focus et
    const existingLabel = "markdown-editor";
    const { getCurrent, WebviewWindow: WW } = await import("@tauri-apps/api/window");

    try {
      const existing = WW.getByLabel(existingLabel);
      if (existing) {
        await existing.setFocus();
        return;
      }
    } catch {
      // Window yok, yenisini oluştur
    }

    const editor = new WebviewWindow(existingLabel, {
      url: "/editor.html",
      width: 760,
      height: 560,
      title: "TodoCo Markdown Editor",
      resizable: true,
      center: true
    });

    editor.once("tauri://error", (event) => {
      console.error("Failed to open editor window:", event);
    });
  } catch (error) {
    console.error("Failed to open editor window:", error);
  }
}
