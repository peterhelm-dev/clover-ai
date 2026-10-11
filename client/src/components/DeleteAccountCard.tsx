import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Permanent account deletion, reachable from Settings (App Store 5.1.1(v)). */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      // The auth user is gone server-side; clear the local session too.
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/?deleted=1";
    },
    onError: (err) => toast.error(`Couldn't delete your account: ${err.message}`),
  });

  return (
    <Card className="border-border/60 py-0 gap-0">
      <CardHeader className="p-5 border-b border-border/40">
        <CardTitle className="font-serif text-base font-bold">Delete account</CardTitle>
        <CardDescription className="text-xs">
          Permanently removes your account, meal logs, photos, mood check-ins and profile, and cancels any paid plan.
          This can't be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (deleteAccount.isPending) return;
            setOpen(next);
            if (!next) setTyped("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5">
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your Clover account?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything you've logged will be permanently deleted and any subscription cancelled. Type{" "}
                <span className="font-semibold text-foreground">DELETE</span> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAccount.isPending}>Keep my account</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={typed !== "DELETE" || deleteAccount.isPending}
                onClick={() => deleteAccount.mutate({ confirm: "DELETE" })}
              >
                {deleteAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
