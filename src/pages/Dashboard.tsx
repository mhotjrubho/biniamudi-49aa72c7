import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertTriangle, AlertOctagon, HeartPulse, Users } from "lucide-react";

interface Stats {
  total: number;
  classic: number;
  needsAttention: number;
  reportReceived: number;
  needsTreatment: number;
  communities: number;
}

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, classic: 0, needsAttention: 0, reportReceived: 0, needsTreatment: 0, communities: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [recordsRes, communitiesRes] = await Promise.all([
        supabase.from("records").select("risk_level").eq("is_deleted", false),
        supabase.from("communities").select("id"),
      ]);

      const records = recordsRes.data || [];
      setStats({
        total: records.length,
        classic: records.filter((r) => r.risk_level === "classic").length,
        needsAttention: records.filter((r) => r.risk_level === "needs_attention").length,
        reportReceived: records.filter((r) => r.risk_level === "report_received").length,
        needsTreatment: records.filter((r) => r.risk_level === "needs_treatment").length,
        communities: communitiesRes.data?.length || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "סה״כ רשומות", value: stats.total, icon: <FileText className="h-5 w-5" />, color: "text-foreground" },
    { label: "קלאסי", value: stats.classic, icon: <Users className="h-5 w-5" />, color: "text-risk-classic" },
    { label: "דורש תשומת לב", value: stats.needsAttention, icon: <AlertTriangle className="h-5 w-5" />, color: "text-risk-attention" },
    { label: "התקבל דיווח", value: stats.reportReceived, icon: <AlertOctagon className="h-5 w-5" />, color: "text-risk-report" },
    { label: "דורש טיפול", value: stats.needsTreatment, icon: <HeartPulse className="h-5 w-5" />, color: "text-risk-treatment" },
  ];

  if (role === "admin") {
    cards.push({ label: "קהילות", value: stats.communities, icon: <Users className="h-5 w-5" />, color: "text-primary" });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">לוח בקרה</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <Card
            key={card.label}
            className="animate-slide-up shadow-md hover:shadow-lg transition-shadow"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <span className={card.color}>{card.icon}</span>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
