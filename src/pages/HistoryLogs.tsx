import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";

interface Log {
  id: string;
  record_id: string;
  old_risk_level: string | null;
  new_risk_level: string | null;
  notes: string | null;
  created_at: string;
  records?: { first_name: string; last_name: string };
}

export default function HistoryLogs() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("history_logs")
        .select("*, records(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as any[]) || []);
    };
    fetch();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">היסטוריית שינויים</h1>
      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>סטטוס קודם</TableHead>
                <TableHead>סטטוס חדש</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead>תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    אין שינויים עדיין
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.records?.first_name} {log.records?.last_name}</TableCell>
                    <TableCell>{log.old_risk_level ? <RiskBadge level={log.old_risk_level} /> : "-"}</TableCell>
                    <TableCell>{log.new_risk_level ? <RiskBadge level={log.new_risk_level} /> : "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.notes || "-"}</TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleDateString("he-IL")}</TableCell>
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
