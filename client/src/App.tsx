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
import Tasks from "@/pages/tasks";
import ScheduledPublications from "@/pages/publish/scheduled";
import ImageGenerationTest from "@/pages/test/image-generation";
import TransparentDialogTest from "@/pages/test/transparent-dialog-test";
import AuthBypass from "@/pages/test/auth-bypass";
import FalAiTest from "@/pages/test/fal-ai-test";
import ApiKeyPriorityTest from "@/pages/test/api-key-priority";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/AuthGuard";

function Router() {
  return (
    <Switch>
      <Route path="/auth/login" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/campaigns" component={() => <Layout><Campaigns /></Layout>} />
      <Route path="/campaigns/:id" component={() => <Layout><CampaignDetails /></Layout>} />
      <Route path="/keywords" component={() => <Layout><Keywords /></Layout>} />
      <Route path="/content" component={() => <Layout><Content /></Layout>} />
      <Route path="/posts" component={() => <Layout><Posts /></Layout>} />
      <Route path="/trends" component={() => <Layout><Trends /></Layout>} />
      <Route path="/analytics" component={() => <Layout><Analytics /></Layout>} />
      <Route path="/tasks" component={() => <Layout><Tasks /></Layout>} />
      <Route path="/publish/scheduled" component={() => <Layout><ScheduledPublications /></Layout>} />
      <Route path="/test/image-generation" component={() => <Layout><ImageGenerationTest /></Layout>} />
      <Route path="/test/transparent-dialog" component={() => <Layout><TransparentDialogTest /></Layout>} />
      <Route path="/test/auth-bypass" component={AuthBypass} />
      <Route path="/test/fal-ai-test" component={() => <Layout><FalAiTest /></Layout>} />
      <Route path="/test/api-key-priority" component={() => <Layout><ApiKeyPriorityTest /></Layout>} />
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
      <AuthProvider>
        <AuthGuard>
          <Router />
          <Toaster />
        </AuthGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;