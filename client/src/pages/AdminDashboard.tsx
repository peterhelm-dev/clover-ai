import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users,
  FlaskConical,
  CreditCard,
  Clock,
  Mail,
  Share2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  Link2,
  Star,
  Copy,
  Check,
  MessageSquarePlus,
} from "lucide-react";

type Tab = "overview" | "users" | "waitlist" | "referrals" | "beta_invites" | "beta_feedback" | "access_passes";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [userPage, setUserPage] = useState(1);
  const [waitlistPage, setWaitlistPage] = useState(1);

  // Redirect non-admins
  if (!loading && (!isAuthenticated || user?.role !== "admin")) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Clover Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            ← Back to App
          </Button>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {(["overview", "users", "waitlist", "referrals", "beta_invites", "beta_feedback", "access_passes"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "users" && (
          <UsersTab page={userPage} onPageChange={setUserPage} />
        )}
        {activeTab === "waitlist" && (
          <WaitlistTab page={waitlistPage} onPageChange={setWaitlistPage} />
        )}
        {activeTab === "referrals" && <ReferralsTab />}
        {activeTab === "beta_invites" && <BetaInvitesTab />}
        {activeTab === "beta_feedback" && <BetaFeedbackTab />}
        {activeTab === "access_passes" && <AccessPassesTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab() {
  const { data: stats, isLoading } = trpc.admin.getStats.useQuery();

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-600" },
    { label: "Active Trials", value: stats?.activeTrials ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Paid Subscribers", value: stats?.paidSubscribers ?? 0, icon: CreditCard, color: "text-green-600" },
    { label: "Testers", value: stats?.testers ?? 0, icon: FlaskConical, color: "text-purple-600" },
    { label: "Waitlist", value: stats?.totalWaitlist ?? 0, icon: Mail, color: "text-rose-600" },
    { label: "Referrals", value: stats?.totalReferrals ?? 0, icon: Share2, color: "text-teal-600" },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview</h2>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isLoading, refetch } = trpc.admin.listUsers.useQuery({ page, pageSize: 25 });
  const setTester = trpc.admin.setTester.useMutation({ onSuccess: () => { toast.success("Updated"); refetch(); } });
  const setRole = trpc.admin.setRole.useMutation({ onSuccess: () => { toast.success("Role updated"); refetch(); } });
  const overrideSub = trpc.admin.overrideSubscription.useMutation({ onSuccess: () => { toast.success("Subscription updated"); refetch(); } });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Users ({data?.total ?? "…"})</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>AI Calls</TableHead>
                  <TableHead>Tester</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : data?.users.map((u) => {
                      const trialDaysLeft = u.trialEndsAt
                        ? Math.max(0, Math.ceil((new Date(u.trialEndsAt).getTime() - Date.now()) / 86400000))
                        : null;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{u.name ?? "—"}</p>
                              <p className="text-xs text-gray-400">{u.email ?? "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                u.tier === "pro"
                                  ? "border-purple-400 text-purple-700"
                                  : u.tier === "plus"
                                  ? "border-blue-400 text-blue-700"
                                  : "border-gray-300 text-gray-600"
                              }
                            >
                              {u.tier ?? "free"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {trialDaysLeft !== null && trialDaysLeft > 0 ? (
                              <span className="text-xs text-amber-600 font-medium">{trialDaysLeft}d left</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {u.aiCallsUsedThisMonth ?? 0}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setTester.mutate({ userId: u.id, isTester: !u.isTester })}
                              className={`w-8 h-5 rounded-full transition-colors relative ${
                                u.isTester ? "bg-purple-500" : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                  u.isTester ? "translate-x-3" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={u.tier ?? "free"}
                                onValueChange={(tier) =>
                                  overrideSub.mutate({ userId: u.id, tier: tier as "free" | "plus" | "pro" })
                                }
                              >
                                <SelectTrigger className="h-7 w-20 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="plus">Plus</SelectItem>
                                  <SelectItem value="pro">Pro</SelectItem>
                                </SelectContent>
                              </Select>
                              {u.role !== "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setRole.mutate({ userId: u.id, role: "admin" })}
                                >
                                  <Shield className="w-3 h-3 mr-1" /> Admin
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waitlist tab
// ---------------------------------------------------------------------------
function WaitlistTab({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isLoading } = trpc.admin.listWaitlist.useQuery({ page, pageSize: 50 });
  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Waitlist ({data?.total ?? "…"})</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Signed Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.entries.map((entry, idx) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-gray-400 text-sm">{(page - 1) * 50 + idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{entry.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{entry.source}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referrals tab
// ---------------------------------------------------------------------------
function ReferralsTab() {
  const { data, isLoading } = trpc.admin.listReferrals.useQuery();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Referrals ({data?.length ?? "…"})</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{r.referrerName ?? "—"}</p>
                          <p className="text-xs text-gray-400">{r.referrerEmail ?? "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{r.code}</code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "credited" ? "default" : "secondary"}
                          className={r.status === "credited" ? "bg-green-100 text-green-700 border-green-200" : ""}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beta Invites tab
// ---------------------------------------------------------------------------
function BetaInvitesTab() {
  const { data: invites, isLoading, refetch } = trpc.beta.listInvites.useQuery();
  const { data: stats } = trpc.beta.getStats.useQuery();
  const [note, setNote] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const createInvite = trpc.beta.createInvite.useMutation({
    onSuccess: () => {
      toast.success("Beta invite created!");
      setNote("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createInvite.mutate({ note: note || undefined, origin: window.location.origin });
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/beta/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Beta Invites ({invites?.length ?? "…"})
        </h2>
        {stats && (
          <span className="text-sm text-gray-500">
            {stats.redeemedInvites} redeemed · {stats.pendingInvites} pending
          </span>
        )}
      </div>

      {/* Create invite */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Generate New Invite Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Optional note (e.g. 'For Alice — beta group 1')"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={255}
            />
            <Button
              onClick={handleCreate}
              disabled={createInvite.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {createInvite.isPending ? "Creating…" : "Create Invite"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Invite links expire 30 days after creation and grant unlimited Pro access.
          </p>
        </CardContent>
      </Card>

      {/* Invites table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Redeemed By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Copy Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : invites?.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>No invites yet. Create your first one above.</p>
                        </TableCell>
                      </TableRow>
                    )
                  : invites?.map((inv) => {
                      const isRedeemed = !!inv.redeemedAt;
                      const isExpired = !isRedeemed && new Date(inv.expiresAt) < new Date();
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                              {inv.code}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {inv.note ?? <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                isRedeemed
                                  ? "border-green-400 text-green-700"
                                  : isExpired
                                  ? "border-red-300 text-red-600"
                                  : "border-blue-300 text-blue-700"
                              }
                            >
                              {isRedeemed ? "Redeemed" : isExpired ? "Expired" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inv.redeemedByName ? (
                              <div>
                                <p className="text-sm font-medium">{inv.redeemedByName}</p>
                                <p className="text-xs text-gray-400">{inv.redeemedByEmail}</p>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {!isRedeemed && !isExpired && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => copyLink(inv.code)}
                              >
                                {copiedCode === inv.code ? (
                                  <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied!</>
                                ) : (
                                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beta Feedback tab
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  bug: "Bug",
  feature_request: "Feature Request",
  ux: "UX / Design",
  performance: "Performance",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  bug: "bg-red-100 text-red-700",
  feature_request: "bg-blue-100 text-blue-700",
  ux: "bg-purple-100 text-purple-700",
  performance: "bg-amber-100 text-amber-700",
};

function BetaFeedbackTab() {
  const { data: feedback, isLoading } = trpc.beta.listFeedback.useQuery();
  const { data: stats } = trpc.beta.getStats.useQuery();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Beta Feedback ({feedback?.length ?? "…"})
        </h2>
        {stats && stats.totalFeedback > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-amber-700">{stats.avgRating.toFixed(1)}</span>
            <span className="text-xs text-amber-600">avg rating</span>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : feedback?.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                          <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>No feedback yet. Beta testers will see a feedback button in the app.</p>
                        </TableCell>
                      </TableRow>
                    )
                  : feedback?.map((fb) => (
                      <TableRow key={fb.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{fb.userName ?? "—"}</p>
                            <p className="text-xs text-gray-400">{fb.userEmail ?? "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < fb.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-gray-500 ml-1">{fb.rating}/5</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              CATEGORY_COLORS[fb.category] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {CATEGORY_LABELS[fb.category] ?? fb.category}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-gray-700 line-clamp-2">{fb.message}</p>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {new Date(fb.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access Passes tab — shareable free-unlimited-access links, revocable anytime
// ---------------------------------------------------------------------------
function AccessPassesTab() {
  const { data: passes, isLoading, refetch } = trpc.passes.adminList.useQuery();
  const [label, setLabel] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const createPass = trpc.passes.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("Pass created — copy the link and send it.");
      setLabel("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const setActive = trpc.passes.adminSetActive.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Pass re-activated" : "Pass revoked — redeemers lose unlimited access");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pass/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-gray-900">Access Passes ({passes?.length ?? "…"})</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Each pass is a link that grants free unlimited AI access to whoever signs in and claims it.
        Turn a pass off at any time — its redeemers drop back to the normal free tier instantly.
      </p>

      <div className="flex gap-2 mb-6 max-w-md">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Label (e.g. "For Alice — recruiting")'
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") createPass.mutate({ label: label || undefined }); }}
        />
        <Button size="sm" disabled={createPass.isPending} onClick={() => createPass.mutate({ label: label || undefined })}>
          {createPass.isPending ? "Creating..." : "Create pass"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (passes ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">No passes yet — create one above.</p>
      ) : (
        <div className="space-y-2">
          {(passes ?? []).map((p) => (
            <Card key={p.id} className={p.active ? "" : "opacity-60"}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{p.code}</span>
                    <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "active" : "revoked"}</Badge>
                    <span className="text-xs text-gray-500">{p.redemptions} redeemed</span>
                  </div>
                  {p.label && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.label}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => copyLink(p.code)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    {copiedCode === p.code ? "Copied!" : "Copy link"}
                  </Button>
                  <Button
                    size="sm"
                    variant={p.active ? "destructive" : "default"}
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ id: p.id, active: !p.active })}
                  >
                    {p.active ? "Turn off" : "Turn on"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
