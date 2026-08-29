'use client';

import { useEffect } from 'react';

/**
 * Print fidelity for tool pages.
 *
 * Two browser gaps are bridged here:
 *
 *  1. Browsers print <details> collapsed, which silently drops every FAQ
 *     answer from the page — expand all details on beforeprint and restore
 *     their prior state on afterprint.
 *  2. When dark mode is active, Tailwind's `dark:` surface/text variants are
 *     still applied under print media, painting white text onto the forced
 *     white print canvas. The print stylesheet resets the body, but it cannot
 *     undo utility classes on arbitrary elements — so the `dark` class is
 *     removed for the duration of printing and restored afterwards. Printing
 *     is always a light document.
 *
 * No markup — a pure effect component.
 */
export default function PrintExpander() {
  useEffect(() => {
    let savedState: { el: HTMLDetailsElement; open: boolean }[] = [];
    let hadDark = false;

    function openAll() {
      savedState = Array.from(document.querySelectorAll('details')).map((el) => ({
        el: el as HTMLDetailsElement,
        open: (el as HTMLDetailsElement).open,
      }));
      savedState.forEach(({ el }) => {
        el.open = true;
      });
      hadDark = document.documentElement.classList.contains('dark');
      if (hadDark) document.documentElement.classList.remove('dark');
    }

    function restore() {
      savedState.forEach(({ el, open }) => {
        el.open = open;
      });
      savedState = [];
      if (hadDark) {
        document.documentElement.classList.add('dark');
        hadDark = false;
      }
    }

    window.addEventListener('beforeprint', openAll);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', openAll);
      window.removeEventListener('afterprint', restore);
    };
  }, []);

  return null;
}
