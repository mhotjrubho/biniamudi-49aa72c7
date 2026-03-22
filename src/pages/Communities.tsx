import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Community {
  id: string;
  name: string;
  created_at: string;
}

export default function Communities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [newName, setNewName] = useState("");

  const fetchCommunities = async () => {
    const { data } = await supabase.from("communities").select("*").order("name");
    setCommunities(data || []);
  };

  useEffect(() => { fetchCommunities(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("communities").insert({ name: newName.trim() });
    if (error) {
      toast.error(error.code === "23505" ? "קהילה עם שם זה כבר קיימת" : error.message);
      return;
    }
    toast.success("קהילה נוספה");
    setNewName("");
    fetchCommunities();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 animate-fade-in">ניהול קהילות</h1>

      <div className="flex gap-2 mb-6 animate-slide-up">
        <Input placeholder="שם קהילה חדשה" value={newName} onChange={(e) => setNewName(e.target.value)} className="max-w-xs" />
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף
        </Button>
      </div>

      <Card className="shadow-md animate-slide-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם קהילה</TableHead>
                <TableHead>תאריך יצירה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {communities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                    אין קהילות עדיין
                  </TableCell>
                </TableRow>
              ) : (
                communities.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString("he-IL")}</TableCell>
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
