import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownToTasks, serializeTasksToMarkdown } from "../src/markdown.js";

test("parse markdown rows", () => {
  const input = [
    "- [ ] Yeni versiyonu deploy et | Emre Caliskan | 20",
    "- [x] Kiosk test | Can Goymen | 100"
  ].join("\n");

  const tasks = parseMarkdownToTasks(input);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].done, false);
  assert.equal(tasks[0].progress, 20);
  assert.equal(tasks[0].priority, 0);
  assert.equal(tasks[1].done, true);
  assert.equal(tasks[1].progress, 100);
  assert.equal(tasks[1].priority, 1);
});

test("serialize markdown rows", () => {
  const rows = serializeTasksToMarkdown([
    {
      text: "Task A",
      assignee_name: "A User",
      progress: 50,
      done: false
    },
    {
      text: "Task B",
      assignee_name: "B User",
      progress: 100,
      done: true
    }
  ]);

  assert.match(rows, /- \[ \] Task A \| A User \| 50/);
  assert.match(rows, /- \[x\] Task B \| B User \| 100/);
});

test("serialize marks 100 percent as checked", () => {
  const rows = serializeTasksToMarkdown([
    {
      text: "Task C",
      assignee_name: "C User",
      progress: 100,
      done: false
    }
  ]);

  assert.match(rows, /- \[x\] Task C \| C User \| 100/);
});

test("parse marks 100 percent as done", () => {
  const tasks = parseMarkdownToTasks("- [ ] Task D | D User | 100");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].progress, 100);
  assert.equal(tasks[0].done, true);
});

test("serialize keeps open tasks first by priority", () => {
  const rows = serializeTasksToMarkdown([
    { text: "Done X", assignee_name: "U", progress: 100, done: true, priority: 0 },
    { text: "Open B", assignee_name: "U", progress: 20, done: false, priority: 2 },
    { text: "Open A", assignee_name: "U", progress: 10, done: false, priority: 1 }
  ]).split("\n");

  assert.match(rows[0], /\[ \] Open A/);
  assert.match(rows[1], /\[ \] Open B/);
  assert.match(rows[2], /\[x\] Done X/);
});
