const DEFAULT_ASSIGNEE = {
  id: "unassigned",
  name: "Unassigned"
};

function normalizeProgress(progress, done) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
  if (done) {
    return 100;
  }
  return value;
}

function normalizePriority(priority, index = 0) {
  const fallback = Number.isFinite(index) ? index : 0;
  return Number.isFinite(priority) ? Math.round(priority) : fallback;
}

function createStableId(text, assigneeId, index = 0) {
  const source = `${text}:${assigneeId}:${index}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `task_${hash.toString(16)}`;
}

export function createTask(input, index = 0) {
  const done = Boolean(input.done);
  const assigneeId = (input.assignee_id || "").trim() || DEFAULT_ASSIGNEE.id;
  const assigneeName = (input.assignee_name || "").trim() || DEFAULT_ASSIGNEE.name;

  return {
    id: (input.id || "").trim() || createStableId(input.text || "", assigneeId, index),
    text: (input.text || "").trim(),
    assignee_id: assigneeId,
    assignee_name: assigneeName,
    priority: normalizePriority(Number(input.priority), index),
    progress: normalizeProgress(Number(input.progress), done),
    done,
    updated_at: input.updated_at || new Date().toISOString()
  };
}

export function mergeTask(current, incoming) {
  if (!current) {
    return createTask(incoming);
  }

  const currentTs = Date.parse(current.updated_at || 0);
  const incomingTs = Date.parse(incoming.updated_at || 0);

  if (Number.isNaN(incomingTs) || incomingTs >= currentTs) {
    return createTask({ ...current, ...incoming });
  }

  return current;
}

export function taskToAssigneeKey(task) {
  return `${task.assignee_id}:${task.assignee_name}`;
}
