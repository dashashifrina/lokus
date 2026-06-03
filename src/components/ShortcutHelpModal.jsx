import { useEffect, useState, useCallback } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ACTIONS, getActiveShortcuts, formatAccelerator } from "../core/shortcuts/registry.js";

/**
 * Group ACTIONS by their `category` field.
 * Returns an array of { category: string, actions: Action[] } sorted by
 * a canonical display order so the UI is predictable.
 */
const CATEGORY_ORDER = ["File", "Navigation", "Editor", "Formatting", "Insert", "View", "Tabs"];

function groupActionsByCategory(activeMap) {
  const groups = {};

  for (const action of ACTIONS) {
    const cat = action.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({
      name: action.name,
      shortcut: activeMap[action.id] ?? action.default,
    });
  }

  // Sort by canonical order, then alphabetically for any extras
  const sorted = CATEGORY_ORDER
    .filter((c) => groups[c])
    .map((c) => ({ category: c, items: groups[c] }));

  const extra = Object.keys(groups)
    .filter((c) => !CATEGORY_ORDER.includes(c))
    .sort()
    .map((c) => ({ category: c, items: groups[c] }));

  return [...sorted, ...extra];
}

/**
 * ShortcutHelpModal — displays all keyboard shortcuts grouped by category.
 *
 * Triggered by ? key, Cmd+/ (Mac) or Ctrl+/ (Windows/Linux).
 * Reads shortcut definitions dynamically from src/core/shortcuts/registry.js
 * rather than hardcoding them.
 *
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Callback to close the modal.
 */
export default function ShortcutHelpModal({ isOpen, onClose }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load active shortcuts (may include user overrides) whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    getActiveShortcuts()
      .then((activeMap) => {
        if (cancelled) return;
        setSections(groupActionsByCategory(activeMap));
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback: use default shortcuts from ACTIONS directly
        const fallbackMap = Object.fromEntries(ACTIONS.map((a) => [a.id, a.default]));
        setSections(groupActionsByCategory(fallbackMap));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  const handleOpenChange = useCallback(
    (open) => {
      if (!open) onClose();
    },
    [onClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0"
        aria-label="Keyboard shortcuts reference"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-app-border shrink-0">
          <div className="flex items-center gap-3">
            <Keyboard className="w-5 h-5 text-app-accent shrink-0" aria-hidden="true" />
            <DialogTitle className="text-lg font-semibold text-app-text">
              Keyboard Shortcuts
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-app-muted mt-1">
            All available shortcuts. User-customised bindings are shown where applicable.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto flex-1 px-6 py-4"
          role="list"
          aria-label="Keyboard shortcut categories"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-app-muted text-sm">
              Loading shortcuts…
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {sections.map(({ category, items }) => (
                <section
                  key={category}
                  role="listitem"
                  aria-label={`${category} shortcuts`}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-app-accent mb-3 pb-1 border-b border-app-border">
                    {category}
                  </h3>
                  <dl className="space-y-1">
                    {items.map(({ name, shortcut }) => (
                      <div
                        key={name}
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-app-hover transition-colors"
                      >
                        <dt className="text-sm text-app-text-secondary">{name}</dt>
                        <dd className="ml-4 shrink-0">
                          <kbd
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-app-panel border border-app-border text-app-text"
                            aria-label={`Shortcut: ${shortcut}`}
                          >
                            {formatAccelerator(shortcut)}
                          </kbd>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-app-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-app-muted">
            Press{" "}
            <kbd className="px-1 py-0.5 text-xs rounded bg-app-panel border border-app-border text-app-text">
              Esc
            </kbd>{" "}
            to close
          </p>
          <p className="text-xs text-app-muted">
            Open with{" "}
            <kbd className="px-1 py-0.5 text-xs rounded bg-app-panel border border-app-border text-app-text">
              ?
            </kbd>{" "}
            or{" "}
            <kbd className="px-1 py-0.5 text-xs rounded bg-app-panel border border-app-border text-app-text">
              Cmd+/
            </kbd>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
