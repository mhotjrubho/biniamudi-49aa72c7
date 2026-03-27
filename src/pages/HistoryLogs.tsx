import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { RecordLink } from "@/components/RecordLink";
import { ArrowLeftRight, ShieldAlert, User } from "lucide-react";

interface Log {
  id: string;
  record_id: string;
  created_at: string;
  action_type: string | null;
  old_risk_level: string | null;
  new_risk_level: string | null;
  records?: { first_name: string; last_name: string } | null;
  profiles?: { display_name: string } | null;
}

const actionLabels: Record<string, { text: string; icon: React.ReactNode }> = {
  risk_level_changed: { text: "שינוי רמת סיכון", icon: <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> },
  reported_for_treatment: { text: "דיווח לטיפול", icon: <ShieldAlert className="h-4 w-4 text-orange-600" /> },
};

export default function HistoryLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("history_logs")
        .select("*, records(first_name, last_name), profiles(display_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const renderChange = (log: Log) => {
    if (log.old_risk_level && log.new_risk_level) {
      return (
        <div className="flex items-center gap-2">
          <RiskBadge level={log.old_risk_level} />
          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <RiskBadge level={log.new_risk_level} />
        </div>
      );
    }
    return <RiskBadge level={log.new_risk_level || "classic"} />;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">היסטוריית שינויים</h1>
      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תלמיד</TableHead>
                <TableHead>פעולה</TableHead>
                <TableHead>פירוט השינוי</TableHead>
                <TableHead>בוצע ע״י</TableHead>
                <TableHead>תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    טוען יומן...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    אין שינויים עדיין
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/5">
                    <TableCell className="font-medium">
                      {log.records ? (
                        <RecordLink recordId={log.record_id}>
                          {log.records.first_name} {log.records.last_name}
                        </RecordLink>
                      ) : <span className="text-muted-foreground italic">רשומה נמחקה</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {actionLabels[log.action_type || ""]?.icon || <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />}
                        <span>{actionLabels[log.action_type || ""]?.text || "שינוי סטטוס"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderChange(log)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{log.profiles?.display_name || <span className="italic">לא ידוע</span>}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(log.created_at).toLocaleString("he-IL", { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
