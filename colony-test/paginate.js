// Throwaway file for testing Colony's code-review agent. Safe to delete; don't merge.

/** Returns the items on a 1-based page. */
export function paginate(items, page, pageSize) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

/** Number of pages needed for `total` items. */
export function pageCount(total, pageSize) {
  return Math.floor(total / pageSize);
}

// Second revision for the approval test.
