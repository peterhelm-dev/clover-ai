import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import FeedbackButton from "./components/FeedbackButton";
import { useAuth } from "./_core/hooks/useAuth";

const Home = lazy(() => import("./pages/Home"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BetaInvitePage = lazy(() => import("./pages/BetaInvitePage"));
const PassRedeemPage = lazy(() => import("./pages/PassRedeemPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const JoinBetaPage = lazy(() => import("./pages/JoinBetaPage"));
const BetaFeedbackPage = lazy(() => import("./pages/BetaFeedbackPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 rounded-full border-2 border-green-700 border-t-transparent animate-spin" />
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/login" component={LoginPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/join" component={JoinBetaPage} />
      {/* Must come before /beta/:code, which would otherwise treat "feedback" as an invite code. */}
      <Route path="/beta/feedback" component={BetaFeedbackPage} />
      <Route path="/beta/:code" component={BetaInvitePage} />
      <Route path="/pass/:code" component={PassRedeemPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/tos" component={TermsOfService} />
      {/* Old features page retired; send old links to the landing page's "How it works" section. */}
      <Route path="/features">{() => { window.location.replace("/#how"); return null; }}</Route>
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
