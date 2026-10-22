import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour: moves focus in on open (to [data-autofocus] or the first control),
 * traps Tab, closes on Escape, locks page scroll, and restores focus on close.
 * Attach the returned ref to the dialog container (a node with role="dialog").
 */
export default function useDialog({ isOpen, onClose, canClose = true }) {
  const ref = useRef(null);
  const latest = useRef({ onClose, canClose });
  latest.current = { onClose, canClose };

  useEffect(() => {
    if (!isOpen) return undefined;
    const node = ref.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const controls = () => (node ? Array.from(node.querySelectorAll(FOCUSABLE)) : []);
    (node?.querySelector('[data-autofocus]') || controls()[0] || node)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (latest.current.canClose) {
          e.stopPropagation();
          latest.current.onClose?.();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = controls();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return ref;
}
