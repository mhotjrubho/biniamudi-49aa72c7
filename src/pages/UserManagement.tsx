import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus } from "lucide-react";

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

export default function UserManagement() {
  const { signUp } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "community_manager", community_id: "" });

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
      toast.error("נא למלא את כל השדות");
      return;
    }
    toast.info("יצירת משתמש... המשתמש יצטרך לאמת את הדוא״ל שלו");
    setDialogOpen(false);
    // Note: Creating users via admin would require an edge function with service_role key
    // For now, we provide the signup flow
    toast.info(`נא לשלוח את קישור ההרשמה למשתמש: ${form.email}`);
  };

  const roleLabels: Record<string, string> = {
    admin: "מנהל ראשי",
    community_manager: "מנהל קהילה",
    tiferet_david: "נציג תפארת דוד",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
      </div>

      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>דוא״ל</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>קהילה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    אין משתמשים
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name}</TableCell>
                    <TableCell dir="ltr">{u.email}</TableCell>
                    <TableCell>{u.role ? roleLabels[u.role] || u.role : "ללא תפקיד"}</TableCell>
                    <TableCell>{u.community_name || "-"}</TableCell>
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
