import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Download,
  Trash2,
  MessageSquare,
  NotebookPen,
  ShieldAlert,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Record {
  id: string;
  national_id: string;
  last_name: string;
  first_name: string;
  community_id: string;
  school: string | null;
  grade_class: string | null;
  risk_level: string;
  treatment_status: string | null;
  notes: string | null;
  td_notes: string | null;
  phone: string | null;
  communities?: { name: string };
  community_notes?: { id: string }[];
}

interface Community {
  id: string;
  name: string;
}

export default function Records() {
  const { role, user } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [search, setSearch] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; record: Record | null }>({ open: false, record: null });
  const [communityNoteDialog, setCommunityNoteDialog] = useState<{ open: boolean; record: Record | null }>({ open: false, record: null });
  const [tdNoteText, setTdNoteText] = useState("");
  const [communityNoteText, setCommunityNoteText] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    national_id: "",
    last_name: "",
    first_name: "",
    community_id: "",
    school: "",
    grade_class: "",
    risk_level: "classic",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [recordsRes, communitiesRes] = await Promise.all([
      supabase
        .from("records")
        .select("*, communities(name), community_notes(id)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      supabase.from("communities").select("*"),
    ]);
    setRecords((recordsRes.data as any[]) || []);
    setCommunities(communitiesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!form.national_id || !form.last_name || !form.first_name || !form.community_id) {
      toast.error("נא למלא את כל השדות החובה");
      return;
    }
    const { error } = await supabase.from("records").insert({
      national_id: form.national_id.trim(),
      last_name: form.last_name.trim(),
      first_name: form.first_name.trim(),
      community_id: form.community_id,
      school: form.school.trim() || null,
      grade_class: form.grade_class.trim() || null,
      risk_level: form.risk_level as any,
      notes: form.notes.trim() || null,
    });
    if (error) {
      if (error.code === "23505") toast.error("מספר ת.ז. כבר קיים במערכת");
      else toast.error("שגיאה בהוספת רשומה: " + error.message);
      return;
    }
    toast.success("רשומה נוספה בהצלחה");
    setDialogOpen(false);
    setForm({ national_id: "", last_name: "", first_name: "", community_id: "", school: "", grade_class: "", risk_level: "classic", notes: "" });
    fetchData();
  };

  const handleSoftDelete = async (recordId: string) => {
    if (role === "admin") {
      await supabase.from("records").update({ is_deleted: true }).eq("id", recordId);
      toast.success("רשומה נמחקה");
    } else {
      if (!user) return;
      await supabase.from("deletion_queue").insert({ record_id: recordId, requested_by: user.id });
      toast.success("בקשת מחיקה נשלחה לאישור מנהל");
    }
    fetchData();
  };

  const handleRiskChange = async (record: Record, newLevel: string, action: string = "risk_level_changed") => {
    const oldLevel = record.risk_level;
    const { error } = await supabase.from("records").update({ risk_level: newLevel as any }).eq("id", record.id);
    if (error) {
      toast.error("שגיאה בעדכון רמת סיכון");
      return;
    }
    if (user) {
      await supabase.from("history_logs").insert({
        record_id: record.id,
        changed_by: user.id,
        old_risk_level: oldLevel as any,
        new_risk_level: newLevel as any,
        action_type: action,
      });
    }
    // Update locally without full refetch
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, risk_level: newLevel } : r));
    toast.success("רמת סיכון עודכנה");
  };

  const handleTreatmentChange = async (record: Record, newStatus: string) => {
    await supabase.from("records").update({ treatment_status: newStatus as any }).eq("id", record.id);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, treatment_status: newStatus } : r));
    toast.success("סטטוס טיפול עודכן");
  };

  const openNotesDialog = (record: Record) => {
    setNotesDialog({ open: true, record });
    setTdNoteText(record.td_notes || "");
  };

  const saveNotes = async () => {
    if (!notesDialog.record) return;
    const { error } = await supabase
      .from("records")
      .update({ td_notes: tdNoteText.trim() || null })
      .eq("id", notesDialog.record.id);
    if (error) {
      toast.error("שגיאה בשמירת הערה");
      return;
    }
    setRecords((prev) =>
      prev.map((r) => r.id === notesDialog.record!.id ? { ...r, td_notes: tdNoteText.trim() || null } : r)
    );
    setNotesDialog({ open: false, record: null });
    toast.success("הערה נשמרה");
  };

  const openCommunityNoteDialog = (record: Record) => {
    setCommunityNoteDialog({ open: true, record });
    setCommunityNoteText("");
  };

  const saveCommunityNote = async () => {
    if (!communityNoteDialog.record || !user) return;
    if (communityNoteText.trim() === "") {
      toast.error("הערה לא יכולה להיות ריקה");
      return;
    }
    const { error } = await supabase.from("community_notes").insert({
      record_id: communityNoteDialog.record.id,
      user_id: user.id,
      note: communityNoteText.trim(),
    });

    if (error) {
      toast.error("שגיאה בשמירת הערה: " + error.message);
      return;
    }
    toast.success("הערה נוספה בהצלחה");
    setCommunityNoteDialog({ open: false, record: null });
    fetchData(); // Refetch to update note indicator
  };

  const handleExport = () => {
    const headers = ["שם פרטי", "שם משפחה", "קהילה", "ישיבה", "שיעור", "רמת סיכון"];
    const rows = filtered.map((r) => [
      r.first_name,
      r.last_name,
      r.communities?.name || "",
      r.school || "",
      r.grade_class || "",
      r.risk_level,
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "records.csv";
    a.click();
  };

  const filtered = records.filter((r) => {
    const matchSearch =
      r.first_name.includes(search) ||
      r.last_name.includes(search) ||
      (role === "admin" && r.national_id.includes(search));
    const matchCommunity = filterCommunity === "all" || r.community_id === filterCommunity;
    const matchRisk = filterRisk === "all" || r.risk_level === filterRisk;
    return matchSearch && matchCommunity && matchRisk;
  });

  const showNotes = role === "admin" || role === "tiferet_david";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <h1 className="text-2xl font-bold">רשומות</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 ml-1" />
            ייצוא
          </Button>
          {role !== "tiferet_david" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 ml-1" />
                  הוסף רשומה
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>רשומה חדשה</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>מספר ת.ז. *</Label>
                      <Input dir="ltr" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>שם פרטי *</Label>
                      <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>שם משפחה *</Label>
                      <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>קהילה *</Label>
                      <Select value={form.community_id} onValueChange={(v) => setForm({ ...form, community_id: v })}>
                        <SelectTrigger><SelectValue placeholder="בחר קהילה" /></SelectTrigger>
                        <SelectContent>
                          {communities.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ישיבה</Label>
                      <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>שיעור</Label>
                      <Input value={form.grade_class} onChange={(e) => setForm({ ...form, grade_class: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>רמת סיכון</Label>
                    <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic"> classics</SelectItem>
                        <SelectItem value="needs_attention">דורש תשומת לב</SelectItem>
                        <SelectItem value="report_received">התקבל דיווח</SelectItem>
                        <SelectItem value="needs_treatment">דורש טיפול</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>הערות</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <Button onClick={handleAdd}>שמור</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="animate-slide-up" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterCommunity} onValueChange={setFilterCommunity}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="כל הקהילות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקהילות</SelectItem>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="כל הרמות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הרמות</SelectItem>
                <SelectItem value="classic"> classics</SelectItem>
                <SelectItem value="needs_attention">דורש תשומת לב</SelectItem>
                <SelectItem value="report_received">התקבל דיווח</SelectItem>
                <SelectItem value="needs_treatment">דורש טיפול</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} רשומות {search || filterCommunity !== "all" || filterRisk !== "all" ? "(מסוננות)" : ""}
      </div>

      {/* Table */}
      <Card className="shadow-sm animate-slide-up" style={{ animationDelay: "160ms", animationFillMode: "both" }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {role === "admin" && <TableHead className="font-semibold">ת.ז.</TableHead>}
                  <TableHead className="font-semibold">שם פרטי</TableHead>
                  <TableHead className="font-semibold">שם משפחה</TableHead>
                  <TableHead className="font-semibold">קהילה</TableHead>
                  <TableHead className="font-semibold">ישיבה</TableHead>
                  <TableHead className="font-semibold">שיעור</TableHead>
                  <TableHead className="font-semibold">טלפון</TableHead>
                  <TableHead className="font-semibold">רמת סיכון</TableHead>
                  {role === "tiferet_david" && <TableHead className="font-semibold">סטטוס טיפול</TableHead>}
                  {showNotes && <TableHead className="font-semibold">הערות ת״ד</TableHead>}
                  <TableHead className="font-semibold w-20">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                      טוען...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                      לא נמצאו רשומות
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                      {role === "admin" && <TableCell dir="ltr" className="font-mono text-xs">{record.national_id}</TableCell>}
                      <TableCell className="font-medium">{record.first_name}</TableCell>
                      <TableCell>{record.last_name}</TableCell>
                      <TableCell>{record.communities?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{record.school || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{record.grade_class || "—"}</TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">{record.phone || "—"}</TableCell>
                      <TableCell>
                        {role !== "tiferet_david" ? (
                          <Select
                            value={record.risk_level}
                            onValueChange={(v) => handleRiskChange(record, v)}
                          >
                            <SelectTrigger className="w-36 h-8 border-0 bg-transparent p-0">
                              <RiskBadge level={record.risk_level} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="classic"> classics</SelectItem>
                              <SelectItem value="needs_attention">דורש תשומת לב</SelectItem>
                              <SelectItem value="report_received">התקבל דיווח</SelectItem>
                              <SelectItem value="needs_treatment">דורש טיפול</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <RiskBadge level={record.risk_level} />
                        )}
                      </TableCell>
                      {role === "tiferet_david" && (
                        <TableCell>
                          <Select
                            value={record.treatment_status || "unknown"}
                            onValueChange={(v) => handleTreatmentChange(record, v)}
                          >
                            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="known">מוכר</SelectItem>
                              <SelectItem value="unknown">לא מוכר</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {showNotes && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 gap-1 ${record.td_notes ? "text-primary" : "text-muted-foreground"}`}
                            onClick={() => openNotesDialog(record)}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {record.td_notes ? "צפה" : "הוסף"}
                          </Button>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {role === "community_manager" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => openCommunityNoteDialog(record)}
                              title="הוסף הערת קהילה"
                            >
                              <NotebookPen className={`h-4 w-4 ${record.community_notes && record.community_notes.length > 0 ? 'text-primary' : ''}`} />
                            </Button>
                          )}
                          {role !== "tiferet_david" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-600 hover:text-orange-600 hover:bg-orange-500/10"
                                  disabled={record.risk_level === 'needs_treatment'}
                                  title="דווח כדורש טיפול"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>דיווח כדורש טיפול</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    האם אתה בטוח? פעולה זו תשנה את רמת הסיכון של {record.first_name} {record.last_name} ל"דורש טיפול" ותתועד במערכת.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRiskChange(record, 'needs_treatment', 'reported_for_treatment')}>
                                    אשר דיווח
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {role !== "tiferet_david" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleSoftDelete(record.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(open) => !open && setNotesDialog({ open: false, record: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              הערות תפארת דוד — {notesDialog.record?.first_name} {notesDialog.record?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={tdNoteText}
              onChange={(e) => setTdNoteText(e.target.value)}
              placeholder="כתוב הערה..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">הערה זו גלויה רק למנהל ראשי ולנציגי תפארת דוד</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNotesDialog({ open: false, record: null })}>
                ביטול
              </Button>
              <Button onClick={saveNotes}>שמור</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Community Note Dialog */}
      <Dialog open={communityNoteDialog.open} onOpenChange={(open) => !open && setCommunityNoteDialog({ open: false, record: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              הוספת הערה — {communityNoteDialog.record?.first_name} {communityNoteDialog.record?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              ההערה תירשם באופן אנונימי (עבורך) ותהיה גלויה רק למנהל המערכת ולנציגי תפארת דוד. לא תוכל לראות או לערוך אותה לאחר השליחה.
            </p>
            <Textarea
              value={communityNoteText}
              onChange={(e) => setCommunityNoteText(e.target.value)}
              placeholder="כתוב הערה..."
              rows={5}
              maxLength={2000}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCommunityNoteDialog({ open: false, record: null })}>
                ביטול
              </Button>
              <Button onClick={saveCommunityNote}>שמור הערה</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
