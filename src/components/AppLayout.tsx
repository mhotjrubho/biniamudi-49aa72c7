import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Trash2,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "רשומות", href: "/records", icon: <FileText className="h-5 w-5" /> },
  { label: "בקשות מחיקה", href: "/deletions", icon: <Trash2 className="h-5 w-5" />, roles: ["admin"] },
  { label: "היסטוריה", href: "/history", icon: <History className="h-5 w-5" /> },
  { label: "ניהול משתמשים", href: "/users", icon: <Users className="h-5 w-5" />, roles: ["admin"] },
  { label: "קהילות", href: "/communities", icon: <Shield className="h-5 w-5" />, roles: ["admin"] },
  { label: "הגדרות סנכרון", href: "/settings", icon: <Settings className="h-5 w-5" />, roles: ["admin"] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const roleLabels: Record<string, string> = {
    admin: "מנהל ראשי",
    community_manager: "מנהל קהילה",
    tiferet_david: "נציג תפארת דוד",
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-l border-sidebar-border flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary">ניהול קהילות</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">
              {role ? roleLabels[role] : ""}
            </p>
          </div>
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="px-4 py-2 text-xs text-sidebar-foreground/50 truncate">
            {profile?.display_name || profile?.email}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            התנתק
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
