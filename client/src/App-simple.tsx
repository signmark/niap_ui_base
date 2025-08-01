import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-center">SMM Manager</h1>
          <p className="text-center mt-4">Приложение запущено успешно!</p>
          <div className="mt-8 text-center">
            <a href="/login" className="bg-primary text-primary-foreground px-4 py-2 rounded">
              Войти в систему
            </a>
          </div>
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}