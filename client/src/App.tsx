import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/auth/login";
import Campaigns from "@/pages/campaigns";
import CampaignDetails from "@/pages/campaigns/[id]";
import Keywords from "@/pages/keywords";
import Posts from "@/pages/posts";
import Analytics from "@/pages/analytics";
import Trends from "@/pages/trends";
import Content from "@/pages/content";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";

function Router() {
  return (
    <Switch>
      <Route path="/auth/login" component={Login} />
      <Route path="/campaigns" component={() => <Layout><Campaigns /></Layout>} />
      <Route path="/campaigns/:id" component={() => <Layout><CampaignDetails /></Layout>} />
      <Route path="/keywords" component={() => <Layout><Keywords /></Layout>} />
      <Route path="/content" component={() => <Layout><Content /></Layout>} />
      <Route path="/posts" component={() => <Layout><Posts /></Layout>} />
      <Route path="/trends" component={() => <Layout><Trends /></Layout>} />
      <Route path="/analytics" component={() => <Layout><Analytics /></Layout>} />
      {/* Добавляем корневой роут */}
      <Route path="/" component={() => <Layout><Campaigns /></Layout>} />
      {/* NotFound должен быть последним */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;