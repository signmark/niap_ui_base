import React, { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

// Принудительная очистка истекшего токена
const clearExpiredToken = () => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (e) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }
};
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
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
import ErrorHandlingTest from "@/pages/test/error-handling-test";
import GlobalApiKeysPage from "@/pages/admin/global-api-keys";
import UserManagement from "@/pages/admin/UserManagement";
import TestImgur from "./pages/test-imgur";
import TestPage from "@/pages/test/index";
import HtmlTagsTestPage from "@/pages/HtmlTagsTestPage";
import TelegramTestPage from "@/pages/telegram-test";
import EditorDemoPage from "@/pages/editor-demo";
import AiImageTester from "@/pages/AiImageTester";
import BusinessQuestionnairePage from "@/pages/business-questionnaire";
import InstagramSimplePage from "@/pages/instagram-simple";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/AuthGuard";
import { useWebSocket } from "@/hooks/use-websocket";
import StoriesPage from "@/pages/stories";
import VideoEditor from "@/pages/video";
import YouTubeCallback from "@/pages/youtube-callback";
import InstagramCallback from "@/pages/instagram-callback";
import VkCallback from "@/pages/vk-callback";
import StoryEditor from "@/components/stories/StoryEditor";
import StoriesGeneratorTest from "@/pages/test/stories-generator-test";

// Создаем обертки для компонентов с Layout
const WithLayout = ({ Component }: { Component: React.ComponentType }) => (
  <Layout>
    <Component />
  </Layout>
);

// Мемоизированные компоненты с Layout
const LayoutCampaigns = React.memo(() => <WithLayout Component={Campaigns} />);
const LayoutCampaignDetails = React.memo(() => <WithLayout Component={CampaignDetails} />);
const LayoutKeywords = React.memo(() => <WithLayout Component={Keywords} />);
const LayoutContent = React.memo(() => <WithLayout Component={Content} />);
const LayoutPosts = React.memo(() => <WithLayout Component={Posts} />);

const LayoutTrends = React.memo(() => <WithLayout Component={Trends} />);
const LayoutAnalytics = React.memo(() => <WithLayout Component={Analytics} />);
const LayoutTasks = React.memo(() => <WithLayout Component={Tasks} />);
const LayoutScheduledPublications = React.memo(() => <WithLayout Component={ScheduledPublications} />);
const LayoutCalendarView = React.memo(() => <WithLayout Component={CalendarView} />);
const LayoutTestPublish = React.memo(() => <WithLayout Component={TestPublish} />);
const LayoutImageGenerationTest = React.memo(() => <WithLayout Component={ImageGenerationTest} />);
const LayoutTransparentDialogTest = React.memo(() => <WithLayout Component={TransparentDialogTest} />);
const LayoutFalAiTest = React.memo(() => <WithLayout Component={FalAiTest} />);
const LayoutApiKeyPriorityTest = React.memo(() => <WithLayout Component={ApiKeyPriorityTest} />);
const LayoutApiKeysTest = React.memo(() => <WithLayout Component={ApiKeysTest} />);
const LayoutUniversalImageGenTest = React.memo(() => <WithLayout Component={UniversalImageGenTest} />);
const LayoutTestImgur = React.memo(() => <WithLayout Component={TestImgur} />);
const LayoutHtmlTagsTestPage = React.memo(() => <WithLayout Component={HtmlTagsTestPage} />);
const LayoutAiImageTester = React.memo(() => <WithLayout Component={AiImageTester} />);
const LayoutErrorHandlingTest = React.memo(() => <WithLayout Component={ErrorHandlingTest} />);
const LayoutTestPage = React.memo(() => <WithLayout Component={TestPage} />);
const LayoutGlobalApiKeysPage = React.memo(() => <WithLayout Component={GlobalApiKeysPage} />);
const LayoutUserManagement = React.memo(() => <WithLayout Component={UserManagement} />);
const LayoutEditorDemo = React.memo(() => <WithLayout Component={EditorDemoPage} />);
const LayoutBusinessQuestionnaire = React.memo(() => <WithLayout Component={BusinessQuestionnairePage} />);
const LayoutInstagramSetup = React.memo(() => <WithLayout Component={InstagramSimplePage} />);
const LayoutStoriesGeneratorTest = React.memo(() => <WithLayout Component={StoriesGeneratorTest} />);

function Router() {
  return (
    <Switch>
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />
      <Route path="/login" component={Login} />
      
      {/* Stories routes - нужно поставить ДО других роутов */}
      <Route path="/stories/:storyId/edit" component={() => <WithLayout Component={StoriesPage} />} />
      <Route path="/stories/new" component={() => <WithLayout Component={StoriesPage} />} />
      <Route path="/stories" component={() => <WithLayout Component={StoriesPage} />} />
      
      <Route path="/campaigns" component={LayoutCampaigns} />
      <Route path="/campaigns/:id" component={LayoutCampaignDetails} />
      <Route path="/campaigns/:campaignId/stories/new" component={() => <WithLayout Component={StoriesPage} />} />
      <Route path="/campaigns/:campaignId/stories/edit/:storyId" component={() => <WithLayout Component={StoriesPage} />} />
      <Route path="/business-questionnaire/:id" component={LayoutBusinessQuestionnaire} />
      <Route path="/keywords" component={LayoutKeywords} />
      <Route path="/content" component={LayoutContent} />
      <Route path="/posts" component={LayoutPosts} />

      <Route path="/trends" component={LayoutTrends} />
      <Route path="/analytics" component={LayoutAnalytics} />
      <Route path="/tasks" component={LayoutTasks} />
      <Route path="/publish/scheduled" component={LayoutScheduledPublications} />
      <Route path="/publish/calendar" component={LayoutCalendarView} />
      <Route path="/publish/test" component={LayoutTestPublish} />
      <Route path="/test/image-generation" component={LayoutImageGenerationTest} />
      <Route path="/test/transparent-dialog" component={LayoutTransparentDialogTest} />
      <Route path="/test/auth-bypass" component={AuthBypass} />
      <Route path="/test/fal-ai-test" component={LayoutFalAiTest} />
      <Route path="/test/api-key-priority" component={LayoutApiKeyPriorityTest} />
      <Route path="/test/api-keys" component={LayoutApiKeysTest} />
      <Route path="/editor-demo" component={LayoutEditorDemo} />
      <Route path="/test/universal-image-gen" component={LayoutUniversalImageGenTest} />
      <Route path="/test/imgur" component={LayoutTestImgur} />
      <Route path="/test/html-tags" component={LayoutHtmlTagsTestPage} />
      <Route path="/test/telegram" component={TelegramTestPage} />
      <Route path="/test/ai-image" component={LayoutAiImageTester} />
      <Route path="/test/error-handling" component={LayoutErrorHandlingTest} />
      <Route path="/test/stories-generator" component={LayoutStoriesGeneratorTest} />
      <Route path="/test" component={LayoutTestPage} />
      <Route path="/admin/global-api-keys" component={LayoutGlobalApiKeysPage} />
      <Route path="/admin/users" component={LayoutUserManagement} />
      <Route path="/settings/instagram-setup" component={LayoutInstagramSetup} />
      
      {/* Video routes */}
      <Route path="/video" component={() => <WithLayout Component={VideoEditor} />} />
      
      {/* OAuth callbacks */}
      <Route path="/api/youtube/auth/callback" component={YouTubeCallback} />
      <Route path="/youtube-callback" component={YouTubeCallback} />
      <Route path="/instagram-callback" component={InstagramCallback} />
      <Route path="/vk-callback" component={VkCallback} />
      

      
      {/* Добавляем корневой роут */}
      <Route path="/" component={LayoutCampaigns} />
      {/* NotFound должен быть последним */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Инициализируем WebSocket соединение для real-time уведомлений
  useWebSocket();

  // ПРИНУДИТЕЛЬНАЯ проверка токенов каждую секунду
  useEffect(() => {
    // Первоначальная проверка
    clearExpiredToken();
    
    // Интервальная проверка
    const interval = setInterval(() => {
      clearExpiredToken();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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