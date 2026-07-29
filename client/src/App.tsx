import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import AdminDashboard from "./pages/AdminDashboard";
import BetaInvitePage from "./pages/BetaInvitePage";
import PassRedeemPage from "./pages/PassRedeemPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import FeaturesPage from "./pages/FeaturesPage";
import FeedbackButton from "./components/FeedbackButton";
import { useAuth } from "./_core/hooks/useAuth";

/**
 * Root route: show the marketing landing page to guests,
 * and the full dashboard to authenticated users.
 */
function RootRoute() {
  const { isAuthenticated, loading } = useAuth();

  // While the auth check is in flight show nothing (avoids flash of landing page for returning users)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <Home /> : <LandingPage />;
}

/** Floating feedback button — only shown to authenticated users */
function GlobalFeedbackButton() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <FeedbackButton />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/beta/:code" component={BetaInvitePage} />
      <Route path="/pass/:code" component={PassRedeemPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/tos" component={TermsOfService} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <GlobalFeedbackButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
