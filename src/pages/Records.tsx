import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  Download,
  MessageSquare,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

interface Note {
  id: string | number;
  created_at: string;
  note: string;
  record_id: string;
  user_id: string;
  profiles?: { display_name: string } | null;
}

interface RecordItem {
  id: string;
  national_id: string;
  last_name: string;
  first_name: string;
  community_id: string;
  school: string | null;
  grade_class: string | null;
  risk_level: string;
  treatment_status: string | null;
  phone: string | null;
  communities?: { name: string } | null;
  community_notes?: Note[];
  td_notes?: Note[];
}

interface Community {
  id: string;
  name: string;
}

type CachedRecordsState = {
  communities: Community[];
  records: RecordItem[];
  role: string;
  userId: string;
};

let recordsCache: CachedRecordsState | null = null;

export default function Records() {
  const { role, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [search, setSearch] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; record: RecordItem | null; notes: Note[] }>({ open: false, record: null, notes: [] });
  const [communityNoteDialog, setCommunityNoteDialog] = useState<{ open: boolean; mode: "note" | "report"; notes: Note[]; record: RecordItem | null }>({ open: false, mode: "note", notes: [], record: null });
  const [newNoteText, setNewNoteText] = useState("");
  const [communityNoteText, setCommunityNoteText] = useState("");
  const [editingTdNoteId, setEditingTdNoteId] = useState<Note["id"] | null>(null);
  const [editingCommunityNoteId, setEditingCommunityNoteId] = useState<Note["id"] | null>(null);
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

  const syncLocalRecord = useCallback((recordId: string, updater: (record: RecordItem) => RecordItem) => {
    setRecords((prev) => {
      const next = prev.map((record) => (record.id === recordId ? updater(record) : record));
      if (recordsCache?.userId === user?.id && recordsCache?.role === role) {
        recordsCache = { ...recordsCache, records: next };
      }
      return next;
    });
  }, [role, user?.id]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (!user || !role) return;
    if (showLoader) setLoading(true);

    const [recordsRes, communitiesRes, tdNotesRes, communityNotesRes] = await Promise.all([
      supabase.from("records").select("*, communities(name)").eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("communities").select("*").order("name"),
      role === "admin" || role === "tiferet_david"
        ? supabase.from("td_notes").select("id, created_at, note, record_id, user_id, profiles(display_name)").order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      supabase.from("community_notes").select("id, created_at, note, record_id, user_id, profiles(display_name)").order("created_at", { ascending: true }),
    ]);

    const error = recordsRes.error || communitiesRes.error || tdNotesRes.error || communityNotesRes.error;
    if (error) {
      toast.error("שגיאה בטעינת הרשומות: " + error.message);
      if (showLoader) setLoading(false);
      return;
    }

    const tdNotesMap = new Map<string, Note[]>();
    (tdNotesRes.data || []).forEach((note: Note) => {
      if (!tdNotesMap.has(note.record_id)) tdNotesMap.set(note.record_id, []);
      tdNotesMap.get(note.record_id)?.push(note);
    });

    const communityNotesMap = new Map<string, Note[]>();
    (communityNotesRes.data || []).forEach((note: Note) => {
      if (!communityNotesMap.has(note.record_id)) communityNotesMap.set(note.record_id, []);
      communityNotesMap.get(note.record_id)?.push(note);
    });

    const nextRecords = ((recordsRes.data as RecordItem[]) || []).map((record) => ({
      ...record,
      td_notes: tdNotesMap.get(record.id) || [],
      community_notes: communityNotesMap.get(record.id) || [],
    }));

    const nextCommunities = (communitiesRes.data as Community[]) || [];
    setRecords(nextRecords);
    setCommunities(nextCommunities);
    recordsCache = { userId: user.id, role, records: nextRecords, communities: nextCommunities };
    if (showLoader) setLoading(false);
  }, [role, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !role) {
      setRecords([]);
      setCommunities([]);
      setLoading(false);
      return;
    }

    if (recordsCache?.userId === user.id && recordsCache?.role === role) {
      setRecords(recordsCache.records);
      setCommunities(recordsCache.communities);
      setLoading(false);
      return;
    }

    void fetchData();
  }, [authLoading, fetchData, role, user]);

  useEffect(() => {
    const targetRecordId = searchParams.get("record");
    const targetNationalId = searchParams.get("nationalId");
    if (loading || records.length === 0 || (!targetRecordId && !targetNationalId)) return;

    const record = records.find((item) => item.id === targetRecordId || item.national_id === targetNationalId);
    if (!record) return;

    setSearch("");
    setFilterCommunity("all");
    setFilterRisk("all");
    setHighlightedRecordId(record.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`record-row-${record.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setHighlightedRecordId(null), 2500);
    setSearchParams({}, { replace: true });

    return () => window.clearTimeout(timeout);
  }, [loading, records, searchParams, setSearchParams]);

  const updateRiskLevel = async (record: RecordItem, newLevel: string, action = "risk_level_changed", successMessage = "רמת סיכון עודכנה") => {
    const oldLevel = record.risk_level;
    const { error } = await supabase.from("records").update({ risk_level: newLevel as any }).eq("id", record.id);
    if (error) {
      toast.error("שגיאה בעדכון רמת סיכון");
      return false;
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

    syncLocalRecord(record.id, (current) => ({ ...current, risk_level: newLevel }));
    toast.success(successMessage);
    return true;
  };

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
      toast.error(error.code === "23505" ? "מספר ת.ז. כבר קיים במערכת" : `שגיאה בהוספת רשומה: ${error.message}`);
      return;
    }

    setDialogOpen(false);
    setForm({ national_id: "", last_name: "", first_name: "", community_id: "", school: "", grade_class: "", risk_level: "classic", notes: "" });
    toast.success("רשומה נוספה בהצלחה");
    void fetchData(false);
  };

  const handleSoftDelete = async (recordId: string) => {
    if (role === "admin") {
      await supabase.from("records").update({ is_deleted: true }).eq("id", recordId);
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
      if (recordsCache?.userId === user?.id && recordsCache?.role === role) {
        recordsCache = { ...recordsCache, records: recordsCache.records.filter((record) => record.id !== recordId) };
      }
      toast.success("רשומה נמחקה");
      return;
    }

    if (!user) return;
    await supabase.from("deletion_queue").insert({ record_id: recordId, requested_by: user.id });
    toast.success("בקשת מחיקה נשלחה לאישור מנהל");
  };

  const handleRiskChange = async (record: RecordItem, newLevel: string, action = "risk_level_changed") => {
    await updateRiskLevel(record, newLevel, action);
  };

  const handleTreatmentChange = async (record: RecordItem, newStatus: string) => {
    await supabase.from("records").update({ treatment_status: newStatus as any }).eq("id", record.id);
    syncLocalRecord(record.id, (current) => ({ ...current, treatment_status: newStatus }));
    toast.success("סטטוס טיפול עודכן");
  };

  const openNotesDialog = (record: RecordItem) => {
    setNotesDialog({ open: true, record, notes: record.td_notes || [] });
    setNewNoteText("");
    setEditingTdNoteId(null);
  };

  const openCommunityNoteDialog = (record: RecordItem, mode: "note" | "report" = "note") => {
    setCommunityNoteDialog({ open: true, mode, notes: record.community_notes || [], record });
    setCommunityNoteText("");
    setEditingCommunityNoteId(null);
  };

  const upsertTdNoteLocally = (savedNote: Note) => {
    setNotesDialog((prev) => {
      const exists = prev.notes.some((note) => note.id === savedNote.id);
      return {
        ...prev,
        notes: exists ? prev.notes.map((note) => (note.id === savedNote.id ? savedNote : note)) : [...prev.notes, savedNote],
      };
    });
    syncLocalRecord(savedNote.record_id, (record) => {
      const notes = record.td_notes || [];
      const exists = notes.some((note) => note.id === savedNote.id);
      return { ...record, td_notes: exists ? notes.map((note) => (note.id === savedNote.id ? savedNote : note)) : [...notes, savedNote] };
    });
  };

  const upsertCommunityNoteLocally = (savedNote: Note) => {
    setCommunityNoteDialog((prev) => {
      const exists = prev.notes.some((note) => note.id === savedNote.id);
      return {
        ...prev,
        notes: exists ? prev.notes.map((note) => (note.id === savedNote.id ? savedNote : note)) : [...prev.notes, savedNote],
      };
    });
    syncLocalRecord(savedNote.record_id, (record) => {
      const notes = record.community_notes || [];
      const exists = notes.some((note) => note.id === savedNote.id);
      return { ...record, community_notes: exists ? notes.map((note) => (note.id === savedNote.id ? savedNote : note)) : [...notes, savedNote] };
    });
  };

  const saveNewNote = async () => {
    if (!notesDialog.record || !newNoteText.trim() || !user) return;

    if (editingTdNoteId !== null) {
      const { data, error } = await supabase
        .from("td_notes")
        .update({ note: newNoteText.trim() })
        .eq("id", editingTdNoteId)
        .select("id, created_at, note, record_id, user_id, profiles(display_name)")
        .single();

      if (error) {
        toast.error("שגיאה בעדכון ההערה: " + error.message);
        return;
      }

      upsertTdNoteLocally(data as Note);
      setEditingTdNoteId(null);
      setNewNoteText("");
      toast.success("ההערה עודכנה בהצלחה");
      return;
    }

    const { data, error } = await supabase
      .from("td_notes")
      .insert({ record_id: notesDialog.record.id, user_id: user.id, note: newNoteText.trim() })
      .select("id, created_at, note, record_id, user_id, profiles(display_name)")
      .single();

    if (error) {
      toast.error("שגיאה בשמירת הערה: " + error.message);
      return;
    }

    upsertTdNoteLocally(data as Note);
    setNewNoteText("");
    toast.success("הערה נשמרה בהצלחה");
  };

  const deleteTdNote = async (note: Note) => {
    const { error } = await supabase.from("td_notes").delete().eq("id", note.id);
    if (error) {
      toast.error("שגיאה במחיקת ההערה: " + error.message);
      return;
    }
    setNotesDialog((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== note.id) }));
    syncLocalRecord(note.record_id, (record) => ({ ...record, td_notes: (record.td_notes || []).filter((item) => item.id !== note.id) }));
    toast.success("ההערה נמחקה");
  };

  const saveCommunityNote = async () => {
    if (!communityNoteDialog.record || !user || !communityNoteText.trim()) {
      toast.error("חייבים לכתוב הערה");
      return;
    }

    if (editingCommunityNoteId !== null) {
      const { data, error } = await supabase
        .from("community_notes")
        .update({ note: communityNoteText.trim() })
        .eq("id", editingCommunityNoteId)
        .select("id, created_at, note, record_id, user_id, profiles(display_name)")
        .single();

      if (error) {
        toast.error("שגיאה בעדכון ההערה: " + error.message);
        return;
      }

      upsertCommunityNoteLocally(data as Note);
      setCommunityNoteText("");
      setEditingCommunityNoteId(null);
      toast.success("ההערה עודכנה בהצלחה");
      return;
    }

    const { data, error } = await supabase
      .from("community_notes")
      .insert({ record_id: communityNoteDialog.record.id, user_id: user.id, note: communityNoteText.trim() })
      .select("id, created_at, note, record_id, user_id, profiles(display_name)")
      .single();

    if (error) {
      toast.error("שגיאה בשמירת הערה: " + error.message);
      return;
    }

    upsertCommunityNoteLocally(data as Note);
    setCommunityNoteText("");

    if (communityNoteDialog.mode === "report") {
      const updated = await updateRiskLevel(communityNoteDialog.record, "needs_treatment", "reported_for_treatment", "הדיווח נשמר והועבר לטיפול");
      if (updated) {
        setCommunityNoteDialog({ open: false, mode: "note", notes: [], record: null });
      }
      return;
    }

    toast.success("הערה נוספה בהצלחה");
  };

  const deleteCommunityNote = async (note: Note) => {
    const { error } = await supabase.from("community_notes").delete().eq("id", note.id);
    if (error) {
      toast.error("שגיאה במחיקת ההערה: " + error.message);
      return;
    }
    setCommunityNoteDialog((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== note.id) }));
    syncLocalRecord(note.record_id, (record) => ({ ...record, community_notes: (record.community_notes || []).filter((item) => item.id !== note.id) }));
    toast.success("ההערה נמחקה");
  };

  const handleExport = () => {
    const headers = ["שם פרטי", "שם משפחה", "קהילה", "ישיבה", "שיעור", "רמת סיכון"];
    const rows = filtered.map((item) => [item.first_name, item.last_name, item.communities?.name || "", item.school || "", item.grade_class || "", item.risk_level]);
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "records.csv";
    a.click();
  };

  const filtered = useMemo(() => records.filter((item) => {
    const matchSearch = item.first_name.includes(search) || item.last_name.includes(search) || item.communities?.name?.includes(search) || item.school?.includes(search) || (role === "admin" && item.national_id.includes(search));
    const matchCommunity = filterCommunity === "all" || item.community_id === filterCommunity;
    const matchRisk = filterRisk === "all" || item.risk_level === filterRisk;
    return matchSearch && matchCommunity && matchRisk;
  }), [filterCommunity, filterRisk, records, role, search]);

  const showNotes = role === "admin" || role === "tiferet_david";

  return (
    <div className="space-y-4">
      <div className="flex animate-fade-in flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold">רשומות</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            רענן
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            ייצוא
          </Button>
          {role !== "tiferet_david" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  הוסף רשומה
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
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
                      <Select value={form.community_id} onValueChange={(value) => setForm({ ...form, community_id: value })}>
                        <SelectTrigger><SelectValue placeholder="בחר קהילה" /></SelectTrigger>
                        <SelectContent>
                          {communities.map((community) => <SelectItem key={community.id} value={community.id}>{community.name}</SelectItem>)}
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
                    <Select value={form.risk_level} onValueChange={(value) => setForm({ ...form, risk_level: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">קלאסי</SelectItem>
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

      <Card className="animate-slide-up" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
        <CardContent className="pb-3 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="חיפוש לפי שם, קהילה או ישיבה..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterCommunity} onValueChange={setFilterCommunity}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="כל הקהילות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקהילות</SelectItem>
                {communities.map((community) => <SelectItem key={community.id} value={community.id}>{community.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="כל הרמות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הרמות</SelectItem>
                <SelectItem value="classic">קלאסי</SelectItem>
                <SelectItem value="needs_attention">דורש תשומת לב</SelectItem>
                <SelectItem value="report_received">התקבל דיווח</SelectItem>
                <SelectItem value="needs_treatment">דורש טיפול</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {filtered.length} רשומות {search || filterCommunity !== "all" || filterRisk !== "all" ? "(מסוננות)" : ""}
      </div>

      <Card className="animate-slide-up shadow-sm" style={{ animationDelay: "160ms", animationFillMode: "both" }}>
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
                  <TableHead className="w-24 font-semibold">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={20} className="py-12 text-center text-muted-foreground">טוען...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="py-12 text-center text-muted-foreground">לא נמצאו רשומות</TableCell>
                  </TableRow>
                ) : filtered.map((record) => (
                  <TableRow key={record.id} id={`record-row-${record.id}`} className={highlightedRecordId === record.id ? "bg-accent/70" : "hover:bg-muted/30"}>
                    {role === "admin" && <TableCell dir="ltr" className="font-mono text-xs">{record.national_id}</TableCell>}
                    <TableCell className="font-medium">{record.first_name}</TableCell>
                    <TableCell>{record.last_name}</TableCell>
                    <TableCell>{record.communities?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{record.school || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{record.grade_class || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">{record.phone || "—"}</TableCell>
                    <TableCell>
                      {role !== "tiferet_david" ? (
                        <Select value={record.risk_level} onValueChange={(value) => handleRiskChange(record, value)}>
                          <SelectTrigger className="h-8 w-36 border-0 bg-transparent p-0"><RiskBadge level={record.risk_level} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="classic">קלאסי</SelectItem>
                            <SelectItem value="needs_attention">דורש תשומת לב</SelectItem>
                            <SelectItem value="report_received">התקבל דיווח</SelectItem>
                            <SelectItem value="needs_treatment">דורש טיפול</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <RiskBadge level={record.risk_level} />}
                    </TableCell>
                    {role === "tiferet_david" && (
                      <TableCell>
                        <Select value={record.treatment_status || "unknown"} onValueChange={(value) => handleTreatmentChange(record, value)}>
                          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="known">מוכר</SelectItem>
                            <SelectItem value="unknown">לא מוכר</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {showNotes && (
                      <TableCell>
                        <Button variant="ghost" size="sm" className={`h-7 gap-1 ${record.td_notes && record.td_notes.length > 0 ? "font-semibold text-primary" : "text-muted-foreground"}`} onClick={() => openNotesDialog(record)}>
                          <MessageSquare className="h-3.5 w-3.5" />
                          {record.td_notes && record.td_notes.length > 0 ? `צפה (${record.td_notes.length})` : "הערות"}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {role !== "tiferet_david" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openCommunityNoteDialog(record)} title="הערות על תלמיד">
                            <NotebookPen className={`h-4 w-4 ${(record.community_notes?.length || 0) > 0 ? "text-primary" : ""}`} />
                          </Button>
                        )}
                        {role !== "tiferet_david" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:bg-warning/10 hover:text-warning" disabled={record.risk_level === "needs_treatment"} onClick={() => openCommunityNoteDialog(record, "report")} title="דווח כדורש טיפול">
                            <ShieldAlert className="h-4 w-4" />
                          </Button>
                        )}
                        {role !== "tiferet_david" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleSoftDelete(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={notesDialog.open} onOpenChange={(open) => !open && setNotesDialog({ open: false, record: null, notes: [] })}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>הערות ת״ד — {notesDialog.record?.first_name} {notesDialog.record?.last_name}</DialogTitle>
          </DialogHeader>
          <div className="flex h-[60vh] flex-col">
            <ScrollArea className="mb-4 flex-1">
              <div className="space-y-4">
                {notesDialog.notes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">אין עדיין הערות</p> : notesDialog.notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback>{note.profiles?.display_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                    <div className="flex-1 rounded-lg bg-muted p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold">{note.profiles?.display_name || "משתמש לא ידוע"}</p>
                        <p className="text-xs text-muted-foreground" title={new Date(note.created_at).toLocaleString("he-IL")}>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: he })}</p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{note.note}</p>
                      {user && (role === "admin" || note.user_id === user.id) && (
                        <div className="mt-3 flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => { setEditingTdNoteId(note.id); setNewNoteText(note.note); }}>
                            <Pencil className="h-3.5 w-3.5" />ערוך
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteTdNote(note)}>
                            <Trash2 className="h-3.5 w-3.5" />מחק
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-auto border-t pt-2">
              <div className="space-y-2">
                <Textarea value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} placeholder={editingTdNoteId !== null ? "ערוך את ההערה..." : "הוסף הערה חדשה..."} rows={3} maxLength={2000} />
                <div className="flex justify-end gap-2">
                  {editingTdNoteId !== null && <Button variant="ghost" onClick={() => { setEditingTdNoteId(null); setNewNoteText(""); }}><X className="h-4 w-4" />בטל עריכה</Button>}
                  <Button variant="outline" onClick={() => setNotesDialog({ open: false, record: null, notes: [] })}>סגור</Button>
                  <Button onClick={saveNewNote} disabled={!newNoteText.trim()}>{editingTdNoteId !== null && <Save className="h-4 w-4" />}{editingTdNoteId !== null ? "שמור שינויים" : "שלח הערה"}</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={communityNoteDialog.open} onOpenChange={(open) => !open && setCommunityNoteDialog({ open: false, mode: "note", notes: [], record: null })}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{communityNoteDialog.mode === "report" ? "דיווח לטיפול" : "הערות על תלמיד"} — {communityNoteDialog.record?.first_name} {communityNoteDialog.record?.last_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{communityNoteDialog.mode === "report" ? "כדי לדווח על תלמיד כדורש טיפול, חייבים להוסיף הערה ראשונה." : "אפשר לצפות, לערוך או למחוק הערות מורשות על התלמיד."}</p>
            <ScrollArea className="max-h-56 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-3">
                {communityNoteDialog.notes.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">אין עדיין הערות</p> : communityNoteDialog.notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-background p-3 shadow-sm">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold">{note.profiles?.display_name || "משתמש"}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: he })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{note.note}</p>
                    {user && (role === "admin" || note.user_id === user.id) && (
                      <div className="mt-3 flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => { setEditingCommunityNoteId(note.id); setCommunityNoteText(note.note); }}>
                          <Pencil className="h-3.5 w-3.5" />ערוך
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteCommunityNote(note)}>
                          <Trash2 className="h-3.5 w-3.5" />מחק
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Textarea value={communityNoteText} onChange={(e) => setCommunityNoteText(e.target.value)} placeholder={editingCommunityNoteId !== null ? "ערוך את ההערה..." : communityNoteDialog.mode === "report" ? "כתוב את ההערה הראשונה לפני הדיווח..." : "כתוב הערה..."} rows={5} maxLength={2000} />
            <div className="flex justify-end gap-2">
              {editingCommunityNoteId !== null && <Button variant="ghost" onClick={() => { setEditingCommunityNoteId(null); setCommunityNoteText(""); }}><X className="h-4 w-4" />בטל עריכה</Button>}
              <Button variant="outline" onClick={() => setCommunityNoteDialog({ open: false, mode: "note", notes: [], record: null })}>ביטול</Button>
              <Button onClick={saveCommunityNote} disabled={!communityNoteText.trim()}>{editingCommunityNoteId !== null ? "שמור שינויים" : communityNoteDialog.mode === "report" ? "שמור ודווח" : "שמור הערה"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
