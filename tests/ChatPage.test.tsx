import { render } from '@testing-library/react';
import React from 'react';
import ChatPage from '../src/pages/ChatPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { test, expect } from 'vitest';

test('renders chat page without crashing', () => {
  const queryClient = new QueryClient();
  
  // Catch React errors
  const originalError = console.error;
  console.error = (...args) => {
    throw new Error(args.join(' '));
  };
  
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatPage />
      </QueryClientProvider>
    );
  } finally {
    console.error = originalError;
  }
});
