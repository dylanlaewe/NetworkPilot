"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

const focusableSelector =
  'button:not(:disabled),a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])';

export function useDismissibleLayer<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  returnFocus?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const fallback = returnFocus?.current;
    const root = ref.current;
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      const target =
        previous && previous !== document.body ? previous : fallback;
      requestAnimationFrame(() => target?.focus());
    };
  }, [onClose, open, returnFocus]);
  return ref;
}

export function useOwnedScrollState<T extends HTMLElement>(
  externalRef?: RefObject<T | null>,
) {
  const [node, setNode] = useState<T | null>(null);
  const [state, setState] = useState({ scrolled: false, atEnd: true });
  const ref = useCallback((next: T | null) => {
    if (externalRef) externalRef.current = next;
    setNode(next);
  }, [externalRef]);
  const update = useCallback(() => {
    if (!node) return;
    const next = {
      scrolled: node.scrollTop > 1,
      atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 1,
    };
    setState((current) =>
      current.scrolled === next.scrolled && current.atEnd === next.atEnd
        ? current
        : next,
    );
  }, [node]);
  useEffect(() => {
    if (!node) return;
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [node, update]);
  return { ref, node, ...state, onScroll: update };
}

export function closeDetailsOnEscape(event: ReactKeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape" || !event.currentTarget.open) return;
  event.preventDefault();
  event.stopPropagation();
  const details = event.currentTarget;
  const summary = details.querySelector<HTMLElement>("summary");
  details.open = false;
  requestAnimationFrame(() => summary?.focus());
}
