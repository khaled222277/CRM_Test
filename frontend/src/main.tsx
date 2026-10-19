import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Per-query staleTime is set where it matters; this is the floor.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider needs both the router (to redirect on 401) and the query
          client (to clear cached data on sign-out), so it sits inside both. */}
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
