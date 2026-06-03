/**
 * FocusMode ProseMirror plugin
 *
 * When active, adds the CSS class `has-focus` to the top-level block node
 * that contains the cursor. Combined with editor.css `.focus-mode` rules,
 * all other blocks are dimmed to 0.3 opacity.
 *
 * Usage:
 *   import { createFocusModePlugin } from './FocusMode.js';
 *   const plugin = createFocusModePlugin();
 *   // add to plugins array
 */

import { Plugin } from 'prosemirror-state';

/**
 * Returns the DOM node for the top-level block that contains pos.
 * @param {import('prosemirror-view').EditorView} view
 * @param {number} pos
 * @returns {Element|null}
 */
function getTopLevelBlockDOM(view, pos) {
  if (pos < 0 || pos > view.state.doc.content.size) return null;

  const $pos = view.state.doc.resolve(pos);
  // Walk up to depth 1 (direct child of doc)
  const depth = Math.min(1, $pos.depth);
  const nodePos = $pos.before(depth);

  try {
    return view.nodeDOM(nodePos);
  } catch {
    return null;
  }
}

/**
 * Creates a ProseMirror plugin that tracks the focused block and applies
 * `has-focus` CSS class to it. The plugin is always in the plugins list;
 * the `.focus-mode` class on the container controls whether dimming is visible.
 */
export function createFocusModePlugin() {
  return new Plugin({
    view(editorView) {
      return new FocusModePluginView(editorView);
    },
  });
}

class FocusModePluginView {
  constructor(view) {
    this.view = view;
    this._lastFocusedDOM = null;
    this.update(view, null);
  }

  update(view, prevState) {
    const { state } = view;

    // Only re-run when selection changes
    if (prevState && prevState.selection.eq(state.selection)) return;

    const { from } = state.selection;

    // Remove class from previous focused node
    if (this._lastFocusedDOM && this._lastFocusedDOM.classList) {
      this._lastFocusedDOM.classList.remove('has-focus');
    }

    // Add class to current focused node
    const dom = getTopLevelBlockDOM(view, from);
    if (dom && dom.classList) {
      dom.classList.add('has-focus');
      this._lastFocusedDOM = dom;
    } else {
      this._lastFocusedDOM = null;
    }
  }

  destroy() {
    if (this._lastFocusedDOM && this._lastFocusedDOM.classList) {
      this._lastFocusedDOM.classList.remove('has-focus');
    }
    this._lastFocusedDOM = null;
  }
}
