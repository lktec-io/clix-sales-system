import { useEffect, useLayoutEffect, useRef } from 'react';

// Declarative keyboard bindings for transaction screens (Retail POS,
// Pharmacy sale, Restaurant order). Keys are combo strings built the same
// way toCombo() below builds them from an event:
//   'F2', 'Escape', 'Enter', 'Delete', '/', 'Mod+k', 'Alt+n', 'Shift+F4'
// 'Mod' is Ctrl on Windows/Linux and Cmd on macOS.
//
// A binding is either a handler function or an options object:
//   { handler, allowWhileTyping = false, preventDefault = true }
// Function keys (F1–F12) and Escape default to allowWhileTyping: true,
// since a cashier presses those mid-search; everything else is ignored
// while focus is inside a text field so typing never triggers a shortcut.
//
// Bindings are read through a ref, so callers can pass a fresh object
// every render without re-subscribing the window listener.

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ALWAYS_ACTIVE_KEY = /^(F\d{1,2}|Escape)$/;

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

function toCombo(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('Mod');
  if (event.altKey) parts.push('Alt');
  // Shift is implied by printable characters ('?' vs '/'), so it's only
  // part of the combo for named keys.
  if (event.shiftKey && event.key.length > 1) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

function normalizeBinding(combo, binding) {
  const options = typeof binding === 'function' ? { handler: binding } : binding;
  return {
    handler: options.handler,
    allowWhileTyping: options.allowWhileTyping ?? ALWAYS_ACTIVE_KEY.test(combo),
    preventDefault: options.preventDefault ?? true,
  };
}

export function usePOSHotkeys(bindings, { enabled = true } = {}) {
  const bindingsRef = useRef(bindings);

  useLayoutEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event) => {
      // A focused control that already handled the key (e.g. the search
      // box's own Enter) wins over the page-level shortcut.
      if (event.defaultPrevented || event.isComposing || event.repeat) return;

      const combo = toCombo(event);
      const raw = bindingsRef.current[combo];
      if (!raw) return;

      const binding = normalizeBinding(combo, raw);
      if (!binding.handler) return;
      if (!binding.allowWhileTyping && isTypingTarget(event.target)) return;

      if (binding.preventDefault) event.preventDefault();
      binding.handler(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

export default usePOSHotkeys;
