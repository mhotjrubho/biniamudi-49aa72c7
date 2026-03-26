import { ReactNode, useMemo, useState } from "react";
import {
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Home,
  AlertCircle,
  Users2,
  Anchor,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  History,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = {
  admin: "מנהל ראשי",
  community_manager: "מנהל קהילה",
  tiferet_david: "נציג תפארת דוד",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navLinks = useMemo(() => {
    const baseNavLinks = [
      { to: "/dashboard", label: "לוח בקרה", icon: <Home className="h-5 w-5" /> },
      { to: "/records", label: "רשומות", icon: <FileText className="h-5 w-5" /> },
      { to: "/history", label: "היסטוריה", icon: <History className="h-5 w-5" /> },
    ];

    if (role === "admin") {
      return [
        ...baseNavLinks,
        { to: "/deletions", label: "בקשות מחיקה", icon: <Shield className="h-5 w-5" /> },
        { to: "/unresolved", label: "רשומות לטיפול", icon: <AlertCircle className="h-5 w-5" /> },
        { to: "/communities", label: "קהילות", icon: <Anchor className="h-5 w-5" /> },
        { to: "/users", label: "משתמשים", icon: <Users2 className="h-5 w-5" /> },
        { to: "/settings", label: "הגדרות", icon: <Settings className="h-5 w-5" /> },
      ];
    }

    return baseNavLinks;
  }, [role]);

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 md:sticky md:top-0 md:h-screen",
          sidebarCollapsed ? "w-[88px]" : "w-64",
          sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex items-center border-b border-sidebar-border", sidebarCollapsed ? "justify-center px-3 py-5" : "justify-between p-6")}>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-sidebar-primary">ניהול קהילות</h1>
              <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">
                {role ? roleLabels[role] : ""}
              </p>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              {sidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 lg:px-3">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                sidebarCollapsed ? "justify-center" : "gap-3",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
              title={sidebarCollapsed ? link.label : undefined}
            >
              <span className="shrink-0">{link.icon}</span>
              {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!sidebarCollapsed && (
            <div className="mb-2 truncate px-3 py-2 text-xs text-sidebar-foreground/50">
              {profile?.display_name || profile?.email}
            </div>
          )}
          <button
            onClick={signOut}
            className={cn(
              "flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              sidebarCollapsed ? "justify-center" : "gap-3"
            )}
            title={sidebarCollapsed ? "התנתק" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>התנתק</span>}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-md">
          <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <div className="mr-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 min-w-0 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
