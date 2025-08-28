import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
import ContentCreator from "@/pages/content-creator";
import Analytics from "@/pages/analytics";
import Trends from "@/pages/trends";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/content-creator" component={ContentCreator} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/trends" component={Trends} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <MainLayout>
            <Router />
          </MainLayout>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
