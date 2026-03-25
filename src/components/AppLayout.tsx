import { ReactNode, useState, useMemo } from "react";
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
  Home,
  AlertCircle,
  Users2,
  Anchor,
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

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navLinks = useMemo(() => {
    const baseNavLinks = [
      { to: "/dashboard", label: "לוח בקרה", icon: <Home /> },
      { to: "/records", label: "רשומות", icon: <FileText /> },
      { to: "/history", label: "היסטוריה", icon: <History /> },
    ];

    if (role === "admin") {
      return [
        ...baseNavLinks,
        { to: "/deletions", label: "בקשות מחיקה", icon: <Shield /> },
        { to: "/unresolved", label: "רשומות לטיפול", icon: <AlertCircle /> },
        { to: "/communities", label: "קהילות", icon: <Anchor /> },
        { to: "/users", label: "משתמשים", icon: <Users2 /> },
        { to: "/settings", label: "הגדרות", icon: <Settings /> },
      ];
    }

    return baseNavLinks;
  }, [role]);

  const handleSignOut = async () => {
    await signOut();
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

        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                location.pathname === link.to
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="px-4 py-2 text-xs text-sidebar-foreground/50 truncate">
            {profile?.display_name || profile?.email}
          </div>
          <button
            onClick={handleSignOut}
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
