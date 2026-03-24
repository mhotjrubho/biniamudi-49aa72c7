import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Download, Trash2, AlertTriangle } from "lucide-react";

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
  phone: string | null;
  communities?: { name: string };
}

interface Community {
  id: string;
  name: string;
}

export default function Records() {
  const { role } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [search, setSearch] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const fetchData = async () => {
    setLoading(true);
    const [recordsRes, communitiesRes] = await Promise.all([
      supabase
        .from("records")
        .select("*, communities(name)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      supabase.from("communities").select("*"),
    ]);
    setRecords((recordsRes.data as any[]) || []);
    setCommunities(communitiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async () => {
    if (!form.national_id || !form.last_name || !form.first_name || !form.community_id) {
      toast.error("נא למלא את כל השדות החובה");
      return;
    }
    const { error } = await supabase.from("records").insert({
      national_id: form.national_id,
      last_name: form.last_name,
      first_name: form.first_name,
      community_id: form.community_id,
      school: form.school || null,
      grade_class: form.grade_class || null,
      risk_level: form.risk_level as any,
      notes: form.notes || null,
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
      await supabase.from("deletion_queue").insert({ record_id: recordId, requested_by: (await supabase.auth.getUser()).data.user!.id });
      toast.success("בקשת מחיקה נשלחה לאישור מנהל");
    }
    fetchData();
  };

  const handleExport = () => {
    const headers = ["שם פרטי", "שם משפחה", "קהילה", "בית ספר", "כיתה", "רמת סיכון"];
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold">רשומות</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 ml-2" />
            ייצוא CSV
          </Button>
          {role !== "tiferet_david" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 ml-2" />
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
                      <Label>בית ספר</Label>
                      <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>כיתה</Label>
                      <Input value={form.grade_class} onChange={(e) => setForm({ ...form, grade_class: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>רמת סיכון</Label>
                    <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
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

      {/* Filters */}
      <Card className="mb-6 animate-slide-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <CardContent className="pt-4">
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
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="כל הקהילות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקהילות</SelectItem>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="כל הרמות" /></SelectTrigger>
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

      {/* Table */}
      <Card className="animate-slide-up shadow-md" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {role === "admin" && <TableHead>ת.ז.</TableHead>}
                  <TableHead>שם פרטי</TableHead>
                  <TableHead>שם משפחה</TableHead>
                  <TableHead>קהילה</TableHead>
                  <TableHead>בית ספר</TableHead>
                   <TableHead>כיתה</TableHead>
                   <TableHead>טלפון</TableHead>
                   <TableHead>רמת סיכון</TableHead>
                  {role === "tiferet_david" && <TableHead>סטטוס טיפול</TableHead>}
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={role === "admin" ? 9 : 8} className="text-center py-12 text-muted-foreground">
                      טוען...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={role === "admin" ? 9 : 8} className="text-center py-12 text-muted-foreground">
                      לא נמצאו רשומות
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((record) => (
                    <TableRow key={record.id}>
                      {role === "admin" && <TableCell dir="ltr" className="font-mono text-sm">{record.national_id}</TableCell>}
                      <TableCell>{record.first_name}</TableCell>
                      <TableCell>{record.last_name}</TableCell>
                      <TableCell>{record.communities?.name}</TableCell>
                      <TableCell>{record.school || "-"}</TableCell>
                      <TableCell>{record.grade_class || "-"}</TableCell>
                      <TableCell dir="ltr">{record.phone || "-"}</TableCell>
                      <TableCell><RiskBadge level={record.risk_level} /></TableCell>
                      {role === "tiferet_david" && (
                        <TableCell>
                          <Select
                            value={record.treatment_status || "unknown"}
                            onValueChange={async (v) => {
                              await supabase.from("records").update({ treatment_status: v as any }).eq("id", record.id);
                              fetchData();
                              toast.success("סטטוס טיפול עודכן");
                            }}
                          >
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="known">מוכר</SelectItem>
                              <SelectItem value="unknown">לא מוכר</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        {role !== "tiferet_david" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleSoftDelete(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
