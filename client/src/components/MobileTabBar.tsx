import { useEffect } from "react";
import { Calendar, Leaf, Menu, Mic, Sparkles } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

type TabBarProps<T extends string> = {
  activeTab: T;
  onSelect: (tab: T) => void;
  /** Tabs that live in the "More" drawer — the More button shows as active on them. */
  moreTabs: readonly T[];
  weeklyReportReady?: boolean;
};

/**
 * Phone-only bottom navigation. The four golden-path destinations are one tap
 * away; everything else lives behind "More", which opens the sidebar drawer.
 * The center "Log" button is the visual anchor, matching the Home CTA.
 */
export function MobileTabBar<T extends string>({ activeTab, onSelect, moreTabs, weeklyReportReady }: TabBarProps<T>) {
  const { setOpenMobile, openMobile } = useSidebar();
  const item = (id: T, label: string, Icon: typeof Leaf, dot = false) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={active ? "page" : undefined}
        className={`relative flex flex-1 flex-col items-center justify-center gap-1 min-h-14 text-[11px] font-medium transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        {label}
        {dot && <span className="absolute top-2 right-[calc(50%-14px)] h-2 w-2 rounded-full bg-emerald-500" />}
      </button>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-background/95 backdrop-blur pb-safe"
    >
      <div className="flex items-stretch h-16 px-1">
        {item("home" as T, "Home", Leaf)}
        {item("calendar" as T, "Past logs", Calendar)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => onSelect("voice-logger" as T)}
            aria-label="Log a meal"
            aria-current={activeTab === "voice-logger" ? "page" : undefined}
            className={`-mt-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-background transition-transform active:scale-95 ${
              activeTab === "voice-logger" ? "bg-primary/90 text-primary-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            <Mic className="h-6 w-6" />
          </button>
        </div>
        {item("weekly-report" as T, "Report", Sparkles, weeklyReportReady)}
        <button
          type="button"
          onClick={() => setOpenMobile(!openMobile)}
          aria-label="More"
          className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-14 text-[11px] font-medium transition-colors ${
            moreTabs.includes(activeTab) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

/** Closes the phone drawer whenever the user navigates — it used to stay open over the new screen. */
export function CloseMobileSidebarOnNavigate({ tab }: { tab: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [tab, setOpenMobile]);
  return null;
}
