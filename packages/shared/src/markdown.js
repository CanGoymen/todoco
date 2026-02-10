import { createTask } from "./task.js";

const MARKDOWN_LINE = /^-\s\[( |x|X)\]\s(.+)$/;

function splitFields(raw) {
  return raw.split("|").map((part) => part.trim());
}

function resolveAssignee(rawName, assigneeLookup) {
  const name = (rawName || "").trim();
  if (!name) {
    return { id: "unassigned", name: "Unassigned" };
  }

  if (assigneeLookup && assigneeLookup[name]) {
    return {
      id: assigneeLookup[name].id,
      name
    };
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unassigned";
  return { id, name };
}

export function parseMarkdownToTasks(markdown, options = {}) {
  const lines = String(markdown || "").split(/\r?\n/);
  const tasks = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const match = trimmed.match(MARKDOWN_LINE);
    if (!match) {
      return;
    }

    const checkboxDone = match[1].toLowerCase() === "x";
    const [textField, assigneeField, progressField] = splitFields(match[2]);
    const assignee = resolveAssignee(assigneeField, options.assigneeLookup);
    const progress = Number.parseInt(progressField, 10);
    const normalizedProgress = Number.isFinite(progress) ? progress : checkboxDone ? 100 : 0;
    const done = checkboxDone || normalizedProgress >= 100;

    tasks.push(
      createTask(
        {
          text: textField || "",
          assignee_id: assignee.id,
          assignee_name: assignee.name,
          priority: index,
          progress: normalizedProgress,
          done
        },
        index
      )
    );
  });

  return tasks;
}

export function serializeTasksToMarkdown(tasks) {
  const ordered = [...tasks].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) {
      return a.done ? 1 : -1;
    }
    return Number(a.priority || 0) - Number(b.priority || 0);
  });

  return ordered
    .map((task) => {
      const progress = Number.isFinite(Number(task.progress)) ? Math.max(0, Math.min(100, Math.round(Number(task.progress)))) : 0;
      const mark = task.done || progress >= 100 ? "x" : " ";
      return `- [${mark}] ${task.text} | ${task.assignee_name} | ${progress}`;
    })
    .join("\n");
}
