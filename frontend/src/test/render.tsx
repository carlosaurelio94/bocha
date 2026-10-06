import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

/** Render con un QueryClient aislado por test. */
export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const client = createTestQueryClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options),
  };
}
