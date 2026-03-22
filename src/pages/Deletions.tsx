import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface DeletionRequest {
  id: string;
  record_id: string;
  requested_at: string;
  reason: string | null;
  status: string;
  records?: { first_name: string; last_name: string; national_id: string };
}

export default function Deletions() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("deletion_queue")
      .select("*, records(first_name, last_name, national_id)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setRequests((data as any[]) || []);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: string, recordId: string, action: "approved" | "rejected") => {
    await supabase.from("deletion_queue").update({ status: action }).eq("id", id);
    if (action === "approved") {
      await supabase.from("records").update({ is_deleted: true }).eq("id", recordId);
    }
    toast.success(action === "approved" ? "בקשת מחיקה אושרה" : "בקשת מחיקה נדחתה");
    fetchRequests();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">בקשות מחיקה ממתינות</h1>
      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ת.ז.</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>תאריך בקשה</TableHead>
                <TableHead>סיבה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    אין בקשות מחיקה ממתינות
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell dir="ltr" className="font-mono text-sm">{req.records?.national_id}</TableCell>
                    <TableCell>{req.records?.first_name} {req.records?.last_name}</TableCell>
                    <TableCell>{new Date(req.requested_at).toLocaleDateString("he-IL")}</TableCell>
                    <TableCell>{req.reason || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="text-success hover:bg-success/10" onClick={() => handleAction(req.id, req.record_id, "approved")}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleAction(req.id, req.record_id, "rejected")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
