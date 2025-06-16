"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState, type PropsWithChildren } from 'react'

export function Provider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
      },
      mutations: {
        retry: false,
      },
    },
  }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
