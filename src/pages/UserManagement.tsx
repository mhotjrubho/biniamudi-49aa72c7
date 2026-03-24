import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";

interface UserWithRole {
  id: string;
  display_name: string;
  email: string | null;
  community_id: string | null;
  role: string | null;
  community_name: string | null;
}

interface Community {
  id: string;
  name: string;
}

const roleLabels: Record<string, string> = {
  admin: "מנהל ראשי",
  community_manager: "מנהל קהילה",
  tiferet_david: "נציג תפארת דוד",
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "community_manager", community_id: "" });
  const [editForm, setEditForm] = useState({ role: "", community_id: "" });

  const callManageUsers = async (body: any) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/manage-users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );
    return res.json();
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const { data: comms } = await supabase.from("communities").select("*");
    setCommunities(comms || []);

    const merged = (profiles || []).map((p: any) => {
      const userRole = (roles || []).find((r: any) => r.user_id === p.user_id);
      const comm = (comms || []).find((c: any) => c.id === p.community_id);
      return {
        id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        community_id: p.community_id,
        role: userRole?.role || null,
        community_name: comm?.name || null,
      };
    });
    setUsers(merged);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async () => {
    if (!form.email || !form.password || !form.display_name) {
      toast.error("נא למלא את כל השדות החובה");
      return;
    }
    setLoading(true);
    const result = await callManageUsers({
      action: "create",
      email: form.email,
      password: form.password,
      display_name: form.display_name,
      role: form.role,
      community_id: form.community_id || null,
    });

    if (result.error) {
      toast.error("שגיאה ביצירת משתמש: " + result.error);
    } else {
      toast.success("משתמש נוצר בהצלחה");
      setCreateDialogOpen(false);
      setForm({ email: "", password: "", display_name: "", role: "community_manager", community_id: "" });
      fetchUsers();
    }
    setLoading(false);
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setEditForm({ role: user.role || "", community_id: user.community_id || "" });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setLoading(true);

    await callManageUsers({
      action: "update_role",
      user_id: editingUser.id,
      role: editForm.role || null,
    });

    await callManageUsers({
      action: "update_community",
      user_id: editingUser.id,
      community_id: editForm.community_id || null,
    });

    toast.success("משתמש עודכן בהצלחה");
    setEditDialogOpen(false);
    fetchUsers();
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    setLoading(true);
    const result = await callManageUsers({ action: "delete", user_id: userId });
    if (result.error) {
      toast.error("שגיאה במחיקת משתמש: " + result.error);
    } else {
      toast.success("משתמש נמחק בהצלחה");
      fetchUsers();
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              הוסף משתמש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>יצירת משתמש חדש</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>שם תצוגה *</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>דוא״ל *</Label>
                <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>סיסמה *</Label>
                <Input dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>תפקיד</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל ראשי</SelectItem>
                    <SelectItem value="community_manager">מנהל קהילה</SelectItem>
                    <SelectItem value="tiferet_david">נציג תפארת דוד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "community_manager" && (
                <div className="space-y-2">
                  <Label>קהילה</Label>
                  <Select value={form.community_id} onValueChange={(v) => setForm({ ...form, community_id: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר קהילה" /></SelectTrigger>
                    <SelectContent>
                      {communities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreateUser} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                צור משתמש
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת משתמש: {editingUser?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>תפקיד</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue placeholder="ללא תפקיד" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל ראשי</SelectItem>
                  <SelectItem value="community_manager">מנהל קהילה</SelectItem>
                  <SelectItem value="tiferet_david">נציג תפארת דוד</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>קהילה</Label>
              <Select value={editForm.community_id} onValueChange={(v) => setEditForm({ ...editForm, community_id: v })}>
                <SelectTrigger><SelectValue placeholder="ללא קהילה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קהילה</SelectItem>
                  {communities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateUser} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>דוא״ל</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>קהילה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    אין משתמשים
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name}</TableCell>
                    <TableCell dir="ltr">{u.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-primary/10 text-primary' :
                        u.role === 'community_manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        u.role === 'tiferet_david' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {u.role ? roleLabels[u.role] || u.role : "ללא תפקיד"}
                      </span>
                    </TableCell>
                    <TableCell>{u.community_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת משתמש</AlertDialogTitle>
                              <AlertDialogDescription>
                                האם אתה בטוח שברצונך למחוק את {u.display_name}? פעולה זו אינה ניתנת לביטול.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                מחק
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
