import { useEffect, useMemo, useState } from "react";
import { bulkUpdateTasks, fetchTasks } from "../lib/api.js";
import { readCachedTasks, writeCachedTasks } from "../lib/cache.js";
import { parseMarkdownToTasks, serializeTasksToMarkdown } from "@todoco/shared/markdown";

function assigneeLookupFromTasks(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.assignee_name] = {
      id: task.assignee_id
    };
    return acc;
  }, {});
}

function taskIdentityKey(task) {
  return `${String(task.text || "").trim().toLowerCase()}|${String(task.assignee_name || "")
    .trim()
    .toLowerCase()}`;
}

function buildIdentityQueues(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const key = taskIdentityKey(task);
    const list = map.get(key) || [];
    list.push(task);
    map.set(key, list);
  });
  return map;
}

export function MarkdownEditorPage() {
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState([]);

  useEffect(() => {
    fetchTasks()
      .then((tasks) => {
        setExisting(tasks);
        setRaw(serializeTasksToMarkdown(tasks));
        writeCachedTasks(tasks);
      })
      .catch(() => {
        const cached = readCachedTasks();
        setExisting(cached);
        setRaw(serializeTasksToMarkdown(cached));
        setError("Could not load tasks. Using local cache.");
      });
  }, []);

  const assigneeLookup = useMemo(() => assigneeLookupFromTasks(existing), [existing]);
  const existingByIdentityQueues = useMemo(() => buildIdentityQueues(existing), [existing]);

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const consumedByIdentity = new Map();
      const parsed = parseMarkdownToTasks(raw, { assigneeLookup }).map((task) => {
        const key = taskIdentityKey(task);
        const queue = existingByIdentityQueues.get(key) || [];
        const consumed = consumedByIdentity.get(key) || 0;
        consumedByIdentity.set(key, consumed + 1);
        const previous = queue[consumed];
        if (!previous) {
          return task;
        }
        return {
          ...task,
          id: previous.id
        };
      });
      const payload = await bulkUpdateTasks(parsed);
      const next = payload.tasks || parsed;
      setExisting(next);
      setRaw(serializeTasksToMarkdown(next));
      writeCachedTasks(next);
    } catch {
      setError("Save failed. Check backend and markdown format.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="editor-root">
      <h1 className="editor-title">TodoCo Markdown Editor</h1>
      <textarea
        className="editor-textarea"
        spellCheck={false}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
      />
      {error ? <p className="error-text">{error}</p> : null}
      <button className="editor-save" type="button" disabled={saving} onClick={handleSave}>
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
