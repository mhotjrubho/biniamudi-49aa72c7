import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertTriangle, AlertOctagon, HeartPulse, Users } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface Stats {
  total: number;
  classic: number;
  needsAttention: number;
  reportReceived: number;
  needsTreatment: number;
  communities: number;
}

interface CommunityData {
  name: string;
  count: number;
}

const riskColors = {
  classic: "hsl(152, 60%, 40%)",
  needs_attention: "hsl(38, 92%, 50%)",
  report_received: "hsl(20, 80%, 52%)",
  needs_treatment: "hsl(0, 72%, 51%)",
};

const riskLabels: Record<string, string> = {
  classic: "קלאסי",
  needs_attention: "דורש תשומת לב",
  report_received: "התקבל דיווח",
  needs_treatment: "דורש טיפול",
};

const pieConfig: ChartConfig = {
  classic: { label: "קלאסי", color: riskColors.classic },
  needs_attention: { label: "דורש תשומת לב", color: riskColors.needs_attention },
  report_received: { label: "התקבל דיווח", color: riskColors.report_received },
  needs_treatment: { label: "דורש טיפול", color: riskColors.needs_treatment },
};

const barConfig: ChartConfig = {
  count: { label: "רשומות", color: "hsl(var(--primary))" },
};

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, classic: 0, needsAttention: 0, reportReceived: 0, needsTreatment: 0, communities: 0 });
  const [communityData, setCommunityData] = useState<CommunityData[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [recordsRes, communitiesRes] = await Promise.all([
        supabase.from("records").select("risk_level, community_id, communities(name)").eq("is_deleted", false),
        supabase.from("communities").select("id"),
      ]);

      const records = recordsRes.data || [];
      setStats({
        total: records.length,
        classic: records.filter((r: any) => r.risk_level === "classic").length,
        needsAttention: records.filter((r: any) => r.risk_level === "needs_attention").length,
        reportReceived: records.filter((r: any) => r.risk_level === "report_received").length,
        needsTreatment: records.filter((r: any) => r.risk_level === "needs_treatment").length,
        communities: communitiesRes.data?.length || 0,
      });

      // Community breakdown
      const commMap: Record<string, number> = {};
      records.forEach((r: any) => {
        const name = r.communities?.name || "לא ידוע";
        commMap[name] = (commMap[name] || 0) + 1;
      });
      setCommunityData(
        Object.entries(commMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );
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

  const pieData = [
    { name: "classic", value: stats.classic, fill: riskColors.classic },
    { name: "needs_attention", value: stats.needsAttention, fill: riskColors.needs_attention },
    { name: "report_received", value: stats.reportReceived, fill: riskColors.report_received },
    { name: "needs_treatment", value: stats.needsTreatment, fill: riskColors.needs_treatment },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">לוח בקרה</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <Card
            key={card.label}
            className="animate-slide-up shadow-sm hover:shadow-md transition-shadow"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
              <span className={card.color}>{card.icon}</span>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Risk Distribution */}
        <Card className="shadow-sm animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">התפלגות רמות סיכון</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-[280px]">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="name"
                        formatter={(value, name) => (
                          <span>{riskLabels[name as string] || name}: {value}</span>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                אין נתונים להצגה
              </div>
            )}
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-muted-foreground">{riskLabels[d.name]}</span>
                  <span className="font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - By Community */}
        <Card className="shadow-sm animate-slide-up" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">רשומות לפי קהילה</CardTitle>
          </CardHeader>
          <CardContent>
            {communityData.length > 0 ? (
              <ChartContainer config={barConfig} className="max-h-[320px]">
                <BarChart data={communityData} layout="vertical" margin={{ right: 16, left: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
