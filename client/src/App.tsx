import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/auth/login";
import Campaigns from "@/pages/campaigns";
import Keywords from "@/pages/keywords";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";
import { useAuthStore } from "@/lib/store";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return <Component />;
}

function Router() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Switch>
      <Route path="/">
        {() => <Redirect to={isAuthenticated ? "/campaigns" : "/login"} />}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/campaigns" component={() => <PrivateRoute component={Campaigns} />} />
      <Route path="/keywords" component={() => <PrivateRoute component={Keywords} />} />
      <Route path="/analytics" component={() => <PrivateRoute component={Analytics} />} />
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