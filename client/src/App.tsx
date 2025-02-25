import { Switch, Route, useLocation, Link } from "wouter";
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
import { useAuthStore } from "@/lib/store";
import { Layout } from "@/components/Layout";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const token = useAuthStore((state) => state.token);
  const [, navigate] = useLocation();

  if (!token) {
    console.log('No token found, redirecting to login');
    navigate("/auth/login");
    return null;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const [location] = useLocation();
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  console.log('Router rendering, location:', location, 'token:', !!token, 'initialized:', isInitialized);

  // Если store еще не инициализирован, показываем загрузку
  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  // Если мы на странице логина и есть токен, редиректим на главную
  if (location === "/auth/login" && token) {
    return <Link to="/campaigns" />;
  }

  return (
    <Switch>
      <Route path="/" component={() => <Link to={token ? "/campaigns" : "/auth/login"} />} />
      <Route path="/auth/login" component={Login} />
      <Route path="/campaigns" component={() => <PrivateRoute component={Campaigns} />} />
      <Route path="/campaigns/:id" component={() => <PrivateRoute component={CampaignDetails} />} />
      <Route path="/keywords" component={() => <PrivateRoute component={Keywords} />} />
      <Route path="/content" component={() => <PrivateRoute component={Content} />} />
      <Route path="/posts" component={() => <PrivateRoute component={Posts} />} />
      <Route path="/trends" component={() => <PrivateRoute component={Trends} />} />
      <Route path="/analytics" component={() => <PrivateRoute component={Analytics} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log('App rendering');
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;