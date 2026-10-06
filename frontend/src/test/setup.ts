import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { createElement, type AnchorHTMLAttributes } from 'react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// next/link necesita el router de Next; en tests alcanza con un <a>.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement('a', { href, ...rest }, children),
}));

// jsdom no implementa estas APIs que usan algunos componentes.
Element.prototype.scrollIntoView = vi.fn();
window.matchMedia = window.matchMedia ?? ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(),
  addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}));
