import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RecordLink } from "@/components/RecordLink";
import { toast } from "sonner";
import { Check, X, FileSpreadsheet } from "lucide-react";

interface DeletionRequest {
  id: string;
  record_id: string;
  requested_at: string;
  reason: string | null;
  status: string;
  deleted_from_excel: boolean;
  records?: { first_name: string; last_name: string; national_id: string };
}

export default function Deletions() {
  const [pending, setPending] = useState<DeletionRequest[]>([]);
  const [approved, setApproved] = useState<DeletionRequest[]>([]);

  const fetchRequests = async () => {
    const { data: pendingData } = await supabase
      .from("deletion_queue")
      .select("*, records(first_name, last_name, national_id)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setPending((pendingData as any[]) || []);

    const { data: approvedData } = await supabase
      .from("deletion_queue")
      .select("*, records(first_name, last_name, national_id)")
      .eq("status", "approved")
      .eq("deleted_from_excel", false)
      .order("requested_at", { ascending: false });
    setApproved((approvedData as any[]) || []);
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

  const handleDeletedFromExcel = async (id: string, checked: boolean) => {
    await supabase.from("deletion_queue").update({ deleted_from_excel: checked }).eq("id", id);
    if (checked) {
      toast.success("סומן כנמחק מהאקסל - יימחק בסנכרון הבא");
    }
    fetchRequests();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">בקשות מחיקה</h1>

      <Tabs defaultValue="pending" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            ממתינות לאישור ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            ממתינות למחיקה מאקסל ({approved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
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
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        אין בקשות מחיקה ממתינות
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell dir="ltr" className="font-mono text-sm">{req.records?.national_id}</TableCell>
                        <TableCell>
                          {req.records ? (
                            <RecordLink recordId={req.record_id} nationalId={req.records.national_id}>
                              {req.records.first_name} {req.records.last_name}
                            </RecordLink>
                          ) : "-"}
                        </TableCell>
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
        </TabsContent>

        <TabsContent value="approved">
          <Card className="shadow-md animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                סמן כנמחק מהאקסל — יימחק אוטומטית בסנכרון הבא
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ת.ז.</TableHead>
                    <TableHead>שם</TableHead>
                    <TableHead>תאריך אישור</TableHead>
                    <TableHead>סיבה</TableHead>
                    <TableHead>נמחק מאקסל</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        אין רשומות ממתינות למחיקה מאקסל
                      </TableCell>
                    </TableRow>
                  ) : (
                    approved.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell dir="ltr" className="font-mono text-sm">{req.records?.national_id}</TableCell>
                        <TableCell>
                          {req.records ? (
                            <RecordLink recordId={req.record_id} nationalId={req.records.national_id}>
                              {req.records.first_name} {req.records.last_name}
                            </RecordLink>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{new Date(req.requested_at).toLocaleDateString("he-IL")}</TableCell>
                        <TableCell>{req.reason || "-"}</TableCell>
                        <TableCell>
                          <Checkbox
                            checked={req.deleted_from_excel}
                            onCheckedChange={(checked) => handleDeletedFromExcel(req.id, checked as boolean)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
