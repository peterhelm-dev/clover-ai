import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSignInPageUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Sparkles, Zap, MessageSquare, ChefHat } from "lucide-react";

export default function BetaInvitePage() {
  const [, params] = useRoute("/beta/:code");
  const code = params?.code ?? "";
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [redeemed, setRedeemed] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  const { data: invite, isLoading } = trpc.beta.getInvite.useQuery(
    { code },
    { enabled: !!code }
  );

  const redeemMutation = trpc.beta.redeemInvite.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setRedeemed(true);
      } else {
        setRedeemError(result.message);
      }
    },
    onError: () => {
      setRedeemError("Something went wrong. Please try again.");
    },
  });

  const handleRedeem = () => {
    if (!isAuthenticated) {
      // Redirect to login, come back here after (encode returnPath + inviteCode in OAuth state)
      window.location.href = getSignInPageUrl(`/beta/${code}`, code);
      return;
    }
    redeemMutation.mutate({ code });
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">C</span>
        </div>
        <span className="text-2xl font-bold text-gray-900">Clover</span>
      </div>

      {/* Redeemed success state */}
      {redeemed ? (
        <Card className="w-full max-w-md shadow-xl border-0 bg-white">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're in! 🎉</h2>
            <p className="text-gray-500 mb-6">
              Your 30-day beta access is active. You have unlimited AI calls and full Pro features.
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate("/")}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : invite?.valid === false ? (
        /* Invalid invite */
        <Card className="w-full max-w-md shadow-xl border-0 bg-white">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {invite.reason === "already_redeemed"
                ? "Invite Already Used"
                : invite.reason === "expired"
                ? "Invite Expired"
                : "Invalid Invite"}
            </h2>
            <p className="text-gray-500 mb-6">
              {invite.reason === "already_redeemed"
                ? "This invite link has already been claimed by someone else."
                : invite.reason === "expired"
                ? "This invite link has expired. Ask for a new one."
                : "This invite link is not valid. Double-check the URL."}
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Valid invite — show the offer */
        <div className="w-full max-w-lg space-y-4">
          <Card className="shadow-xl border-0 bg-white overflow-hidden">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-5 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0 text-xs font-medium">
                  Beta Access
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">You've been invited!</h1>
              <p className="text-emerald-100 text-sm mt-1">
                {invite?.note
                  ? invite.note
                  : "Join the Clover beta and get 30 days of unlimited Pro access — free."}
              </p>
            </div>

            <CardContent className="p-6">
              {/* What you get */}
              <h3 className="font-semibold text-gray-900 mb-3">What's included:</h3>
              <ul className="space-y-2 mb-6">
                {[
                  { icon: Zap, text: "Unlimited AI nutrition analysis" },
                  { icon: Sparkles, text: "Full Pro features for 30 days" },
                  { icon: MessageSquare, text: "Direct line to share feedback with the team" },
                  { icon: ChefHat, text: "AI-powered recipe suggestions" },
                  { icon: Clock, text: "No credit card required" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    {text}
                  </li>
                ))}
              </ul>

              {/* Expiry notice */}
              {invite?.expiresAt && (
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Invite expires {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
              )}

              {/* Error */}
              {redeemError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                  {redeemError}
                </p>
              )}

              {/* CTA */}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base font-semibold"
                onClick={handleRedeem}
                disabled={redeemMutation.isPending}
              >
                {redeemMutation.isPending
                  ? "Activating..."
                  : isAuthenticated
                  ? "Activate Beta Access"
                  : "Sign in to Claim Your Invite"}
              </Button>

              {!isAuthenticated && (
                <p className="text-xs text-center text-gray-400 mt-2">
                  You'll be redirected back here after signing in.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
