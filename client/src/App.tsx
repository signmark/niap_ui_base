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
import CalendarView from "@/pages/publish/calendar";
import TestPublish from "@/pages/publish/test-publish";
import ImageGenerationTest from "@/pages/test/image-generation";
import TransparentDialogTest from "@/pages/test/transparent-dialog-test";
import AuthBypass from "@/pages/test/auth-bypass";
import FalAiTest from "@/pages/test/fal-ai-test";
import ApiKeyPriorityTest from "@/pages/test/api-key-priority";
import ApiKeysTest from "@/pages/test/api-keys";
import UniversalImageGenTest from "@/pages/test/universal-image-gen";
import TimeDisplayTest from "@/pages/test/time-display-test";
import TestImgur from "./pages/test-imgur";
import TestPage from "@/pages/test/index";
import HtmlTagsTestPage from "@/pages/HtmlTagsTestPage";
import TelegramTestPage from "@/pages/telegram-test";
import InstagramTestPage from "@/pages/instagram-test";
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
      <Route path="/publish/calendar" component={() => <Layout><CalendarView /></Layout>} />
      <Route path="/publish/test" component={() => <Layout><TestPublish /></Layout>} />
      <Route path="/test/image-generation" component={() => <Layout><ImageGenerationTest /></Layout>} />
      <Route path="/test/transparent-dialog" component={() => <Layout><TransparentDialogTest /></Layout>} />
      <Route path="/test/auth-bypass" component={AuthBypass} />
      <Route path="/test/fal-ai-test" component={() => <Layout><FalAiTest /></Layout>} />
      <Route path="/test/api-key-priority" component={() => <Layout><ApiKeyPriorityTest /></Layout>} />
      <Route path="/test/api-keys" component={() => <Layout><ApiKeysTest /></Layout>} />
      <Route path="/test/universal-image-gen" component={() => <Layout><UniversalImageGenTest /></Layout>} />
      <Route path="/test/imgur" component={() => <Layout><TestImgur /></Layout>} />
      <Route path="/test/html-tags" component={() => <Layout><HtmlTagsTestPage /></Layout>} />
      <Route path="/test/telegram" component={TelegramTestPage} />
      <Route path="/test/instagram" component={() => <Layout><InstagramTestPage /></Layout>} />
      <Route path="/test" component={() => <Layout><TestPage /></Layout>} />
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