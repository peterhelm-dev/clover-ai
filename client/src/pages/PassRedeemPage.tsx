import { useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { Leaf, Check, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

/**
 * /pass/:code — a share link that grants free unlimited AI access,
 * revocable by the owner at any time. Signed-out visitors sign in first
 * and land back here; signed-in visitors redeem automatically.
 */
export default function PassRedeemPage() {
  const [, params] = useRoute("/pass/:code");
  const code = params?.code ?? "";
  const { isAuthenticated, loading, user } = useAuth();

  const infoQuery = trpc.passes.info.useQuery({ code }, { enabled: code.length >= 4 });
  const redeemMutation = trpc.passes.redeem.useMutation();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (
      isAuthenticated &&
      !loading &&
      infoQuery.data?.valid &&
      user?.loginMethod !== "anonymous" &&
      !attemptedRef.current
    ) {
      attemptedRef.current = true;
      redeemMutation.mutate({ code });
    }
  }, [isAuthenticated, loading, infoQuery.data, user, code, redeemMutation]);

  const body = () => {
    if (loading || infoQuery.isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> One moment...
        </div>
      );
    }
    if (!infoQuery.data?.valid) {
      return (
        <div className="text-center py-6 space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground stroke-1" />
          <p className="text-sm font-medium">This pass isn't active anymore.</p>
          <p className="text-xs text-muted-foreground">You can still use Clover free — 10 AI logs a month, no card needed.</p>
          <Button size="sm" className="mt-2" onClick={() => (window.location.href = "/")}>Go to Clover</Button>
        </div>
      );
    }
    if (!isAuthenticated || user?.loginMethod === "anonymous") {
      return (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm font-medium">You've been given free unlimited access to Clover.</p>
          {infoQuery.data.label && <p className="text-xs text-muted-foreground">Pass: {infoQuery.data.label}</p>}
          <p className="text-xs text-muted-foreground">Sign in to claim it — takes about ten seconds.</p>
          <Button onClick={() => (window.location.href = getLoginUrl(`/pass/${code}`))}>
            Sign in & claim
          </Button>
        </div>
      );
    }
    if (redeemMutation.isSuccess) {
      return (
        <div className="text-center py-6 space-y-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center mx-auto">
            <Check className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm font-medium">You're in — unlimited AI logging is live on your account.</p>
          <Button onClick={() => (window.location.href = "/")}>Open Clover</Button>
        </div>
      );
    }
    if (redeemMutation.isError) {
      return (
        <div className="text-center py-6 space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground stroke-1" />
          <p className="text-sm">{redeemMutation.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => (window.location.href = "/")}>Go to Clover</Button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Claiming your pass...
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-primary font-serif font-bold text-xl mb-2">
            <Leaf className="h-5 w-5" /> Clover
          </div>
          {body()}
        </CardContent>
      </Card>
    </div>
  );
}
