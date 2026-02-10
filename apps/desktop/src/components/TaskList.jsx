import { Fragment, useEffect, useRef, useState } from "react";

function initials(name) {
  const value = String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return value || "?";
}

function progressValue(task) {
  const raw = Number(task.progress);
  if (!Number.isFinite(raw)) {
    return task.done ? 100 : 0;
  }
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function PersonIcon() {
  return (
    <svg
      width="12"
      height="12"
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

function ChevronIcon({ direction }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={`chevron-icon ${direction}`}
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  );
}

export function TaskList({
  tasks,
  onToggle,
  onProgressChange,
  onTextChange,
  onAssigneeChange,
  assigneeOptions,
  onReorder,
  canReorder
}) {
  const [progressEditor, setProgressEditor] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [doneExpanded, setDoneExpanded] = useState(true);

  const dragTaskIdRef = useRef(null);
  const dropIndexRef = useRef(null);
  const openTasksRef = useRef([]);
  const openRowRefs = useRef(new Map());
  const pointerDraggingRef = useRef(false);

  const openTasks = tasks.filter((task) => !task.done);
  const doneTasks = tasks.filter((task) => task.done);

  useEffect(() => {
    openTasksRef.current = openTasks;
  }, [openTasks]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!progressEditor) return;

      const target = event.target;
      const isInsidePopover = target.closest('.task-progress-popover');
      const isInsideAvatar = target.closest('.task-avatar-button');

      // Close the entire progress editor if clicking outside
      if (!isInsidePopover && !isInsideAvatar) {
        setProgressEditor(null);
      }
    }

    if (progressEditor) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [progressEditor]);

  function setDropIndexValue(value) {
    dropIndexRef.current = value;
    setDropIndex(value);
  }

  function cleanupPointerListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }

  function clearDragState() {
    pointerDraggingRef.current = false;
    cleanupPointerListeners();
    dragTaskIdRef.current = null;
    dropIndexRef.current = null;
    setDragTaskId(null);
    setDropIndex(null);
  }

  function readProgress(task) {
    if (progressEditor?.taskId === task.id) {
      return progressEditor.value;
    }
    return progressValue(task);
  }

  function toggleProgressEditor(task) {
    setProgressEditor((current) => {
      if (current?.taskId === task.id) {
        return null;
      }
      return { taskId: task.id, value: progressValue(task), assigneeMenuOpen: false };
    });
    setTextEditor(null);
  }

  function commitProgress(task, value) {
    onProgressChange(task, value);
  }

  function startTextEditor(task) {
    setTextEditor({ taskId: task.id, value: task.text });
    setProgressEditor(null);
  }

  function commitText(task) {
    if (!textEditor || textEditor.taskId !== task.id) {
      return;
    }

    const nextText = textEditor.value.trim();
    setTextEditor(null);
    if (!nextText || nextText === task.text) {
      return;
    }

    onTextChange(task, nextText);
  }

  function toggleAssigneeMenu(task) {
    setProgressEditor((current) => {
      if (!current || current.taskId !== task.id) {
        return current;
      }
      return {
        ...current,
        assigneeMenuOpen: !current.assigneeMenuOpen
      };
    });
  }

  function pickAssignee(task, assignee) {
    onAssigneeChange(task, assignee);
    setProgressEditor((current) => {
      if (!current || current.taskId !== task.id) {
        return current;
      }
      return {
        ...current,
        assigneeMenuOpen: false
      };
    });
  }

  function reorderAt(insertIndex) {
    if (!canReorder || typeof onReorder !== "function") {
      clearDragState();
      return;
    }

    const draggingId = dragTaskIdRef.current;
    if (!draggingId) {
      clearDragState();
      return;
    }

    const ids = openTasksRef.current.map((task) => task.id);
    const from = ids.indexOf(draggingId);
    if (from === -1) {
      clearDragState();
      return;
    }

    const bounded = Math.max(0, Math.min(insertIndex, ids.length));
    const next = [...ids];
    next.splice(from, 1);
    const target = from < bounded ? bounded - 1 : bounded;
    next.splice(target, 0, draggingId);

    onReorder(next);
    clearDragState();
  }

  function updateDropIndexFromPointer(clientY) {
    const ids = openTasksRef.current.map((task) => task.id);
    if (ids.length === 0) {
      setDropIndexValue(0);
      return;
    }

    let insertIndex = ids.length;

    for (let index = 0; index < ids.length; index += 1) {
      const element = openRowRefs.current.get(ids[index]);
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        insertIndex = index;
        break;
      }
    }

    setDropIndexValue(insertIndex);
  }

  function handlePointerMove(event) {
    if (!pointerDraggingRef.current || !dragTaskIdRef.current) {
      return;
    }

    event.preventDefault();
    updateDropIndexFromPointer(event.clientY);
  }

  function handlePointerUp() {
    if (!pointerDraggingRef.current || !dragTaskIdRef.current) {
      clearDragState();
      return;
    }

    const currentDrop = Number.isFinite(dropIndexRef.current)
      ? dropIndexRef.current
      : openTasksRef.current.findIndex((task) => task.id === dragTaskIdRef.current);

    reorderAt(Number.isFinite(currentDrop) ? currentDrop : 0);
  }

  function startPointerDrag(event, task) {
    if (!canReorder || task.done || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setProgressEditor(null);
    setTextEditor(null);

    pointerDraggingRef.current = true;
    dragTaskIdRef.current = task.id;
    setDragTaskId(task.id);

    const currentIndex = openTasksRef.current.findIndex((item) => item.id === task.id);
    setDropIndexValue(currentIndex >= 0 ? currentIndex : 0);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function renderDropSlot(index) {
    if (!canReorder || !dragTaskId) {
      return null;
    }

    return <li key={`drop-slot-${index}`} className={`task-drop-slot ${dragTaskId && dropIndex === index ? "active" : ""}`} />;
  }

  function renderTask(task, openIndex = null) {
    const isEditingText = textEditor?.taskId === task.id;
    const currentProgress = readProgress(task);
    const draggable = canReorder && !task.done;

    return (
      <li
        key={task.id}
        ref={
          openIndex === null
            ? undefined
            : (node) => {
                if (node) {
                  openRowRefs.current.set(task.id, node);
                } else {
                  openRowRefs.current.delete(task.id);
                }
              }
        }
        className={`task-row ${dragTaskId === task.id ? "dragging" : ""}`}
      >
        <div className="task-main-row">
          <span
            className={`task-drag-handle ${draggable ? "active" : ""}`}
            onPointerDown={(event) => startPointerDrag(event, task)}
          >
            ↕
          </span>
          <input
            className="task-checkbox task-no-drag"
            type="checkbox"
            checked={task.done}
            onChange={(event) => onToggle(task, event.target.checked)}
          />

          {isEditingText ? (
            <input
              className="task-text-input task-no-drag"
              type="text"
              autoFocus
              value={textEditor.value}
              onChange={(event) => {
                setTextEditor((current) => ({ ...current, value: event.target.value }));
              }}
              onBlur={() => commitText(task)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitText(task);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setTextEditor(null);
                }
              }}
            />
          ) : (
            <button className="task-text-button task-no-drag" type="button" onClick={() => startTextEditor(task)}>
              <span className={`task-text ${task.done ? "done" : ""}`}>{task.text}</span>
            </button>
          )}

          <button
            className="task-avatar-button task-no-drag"
            type="button"
            onClick={() => toggleProgressEditor(task)}
            title={`${task.assignee_name} • %${currentProgress}`}
          >
            <span
              className="task-avatar-ring"
              style={{
                "--progress": `${currentProgress}%`,
                "--ring-color": currentProgress === 100 ? "#16a34a" : "#2563eb"
              }}
            >
              <span className="task-avatar-inner">{initials(task.assignee_name)}</span>
            </span>
          </button>
        </div>

        {progressEditor?.taskId === task.id ? (
          <div className="task-progress-popover task-no-drag">
            <div className="task-progress-assignee-wrap">
              <button
                className="task-progress-assignee-trigger"
                type="button"
                title={task.assignee_name}
                onClick={() => toggleAssigneeMenu(task)}
              >
                <span className={`task-mini-avatar ${task.assignee_id === "unassigned" ? "unassigned" : ""}`}>
                  {task.assignee_id === "unassigned" ? <PersonIcon /> : initials(task.assignee_name)}
                </span>
              </button>
              {progressEditor.assigneeMenuOpen ? (
                <div className="task-assignee-menu">
                  {assigneeOptions.map((assignee) => (
                    <button
                      key={assignee.id}
                      className={`task-assignee-option ${task.assignee_id === assignee.id ? "active" : ""}`}
                      type="button"
                      onClick={() => pickAssignee(task, assignee)}
                    >
                      <span className={`task-mini-avatar ${assignee.id === "unassigned" ? "unassigned" : ""}`}>
                        {assignee.id === "unassigned" ? <PersonIcon /> : initials(assignee.name)}
                      </span>
                      <span>{assignee.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              className="task-progress-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={progressEditor.value}
              onChange={(event) => {
                const value = Number(event.target.value);
                setProgressEditor((current) => ({
                  taskId: task.id,
                  value,
                  assigneeMenuOpen: current?.assigneeMenuOpen || false
                }));
              }}
              onMouseUp={() => commitProgress(task, progressEditor.value)}
              onTouchEnd={() => commitProgress(task, progressEditor.value)}
              onKeyUp={(event) => {
                if (event.key === "Enter") {
                  commitProgress(task, progressEditor.value);
                }
              }}
            />
            <span className="task-progress-value">%{progressEditor.value}</span>
          </div>
        ) : null}
      </li>
    );
  }

  if (tasks.length === 0) {
    return <div className="empty">No tasks found.</div>;
  }

  return (
    <ul className="task-list">
      {openTasks.map((task, index) => (
        <Fragment key={`open-fragment-${task.id}`}>
          {renderDropSlot(index)}
          {renderTask(task, index)}
        </Fragment>
      ))}
      {renderDropSlot(openTasks.length)}
      {doneTasks.length > 0 ? (
        <li className="done-separator">
          <button
            className="done-toggle"
            type="button"
            onClick={() => setDoneExpanded(!doneExpanded)}
          >
            <span className="done-chevron-circle">
              <ChevronIcon direction={doneExpanded ? "up" : "down"} />
            </span>
            <span className="done-text">
              done ({doneTasks.length})
            </span>
          </button>
        </li>
      ) : null}
      {doneExpanded && doneTasks.map((task) => renderTask(task))}
    </ul>
  );
}
