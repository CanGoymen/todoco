const TASK_CACHE_KEY = "todoco_task_cache";

export function readCachedTasks() {
  try {
    const raw = localStorage.getItem(TASK_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedTasks(tasks) {
  try {
    localStorage.setItem(TASK_CACHE_KEY, JSON.stringify(tasks));
  } catch {
    // no-op when storage is unavailable
  }
}
