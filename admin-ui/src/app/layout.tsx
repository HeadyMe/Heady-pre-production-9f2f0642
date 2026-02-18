'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const headyQueryClient = new QueryClient();

export default function headyRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={headyQueryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
