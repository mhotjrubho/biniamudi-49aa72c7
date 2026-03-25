import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, AlertCircle } from "lucide-react";

interface UnresolvedRecord {
  id: string;
  created_at: string;
  raw_data: any;
  error_reason: string;
  is_resolved: boolean;
}

export default function UnresolvedRecords() {
  const [records, setRecords] = useState<UnresolvedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnresolved = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("unresolved_records")
      .select("*")
      .order("created_at", { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUnresolved();
  }, []);
  
  const markAsResolved = async (id: string) => {
    const { error } = await supabase
      .from('unresolved_records')
      .update({ is_resolved: true })
      .eq('id', id);
      
    if (error) {
        toast.error("שגיאה בסימון הרשומה");
    } else {
        toast.success("הרשומה סומנה כטופלה");
        fetchUnresolved();
    }
  }

  const getFieldValue = (field: any) => {
    return field?.toString().trim() || <span className="text-muted-foreground italic">ריקה</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">רשומות לטיפול</h1>
          <p className="text-muted-foreground">רשומות שלא ניתן היה לסנכרן מהגיליון עקב שגיאות.</p>
        </div>
      </div>
      <Card className="shadow-md animate-slide-up">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם פרטי</TableHead>
                <TableHead>שם משפחה</TableHead>
                <TableHead>קהילה</TableHead>
                <TableHead>סיבת השגיאה</TableHead>
                <TableHead>תאריך הופעה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>פעולה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={7} className="text-center py-12">טוען...</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    לא נמצאו רשומות לטיפול. כל הרשומות סונכרנו בהצלחה.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id} className={r.is_resolved ? "bg-muted/40" : ""}>
                    <TableCell>{getFieldValue(r.raw_data?.first_name)}</TableCell>
                    <TableCell>{getFieldValue(r.raw_data?.last_name)}</TableCell>
                    <TableCell>{getFieldValue(r.raw_data?.community)}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span>{r.error_reason}</span>
                        </div>
                    </TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("he-IL")}</TableCell>
                    <TableCell>
                        <Badge variant={r.is_resolved ? "outline" : "destructive"}>
                            {r.is_resolved ? "טופל" : "ממתין לטיפול"}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      {!r.is_resolved && (
                        <Button variant="ghost" size="sm" onClick={() => markAsResolved(r.id)}>
                          <Check className="h-4 w-4 mr-1" />
                          סמן כטופל
                        </Button>
                      )}
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
