import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
// Also expose on globalThis for tests that access localStorage directly
// Use defineProperty to avoid assignment to readonly property
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// Mock fetch for API calls with Response-like shape
// Default resolves with ok:true and empty text/json
// Individual tests can override with vi.fn().mockResolvedValueOnce
global.fetch = vi.fn((input?: RequestInfo) => {
  // Provide a Response-like object; tests may override with mockResolvedValueOnce
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as any);
});

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
