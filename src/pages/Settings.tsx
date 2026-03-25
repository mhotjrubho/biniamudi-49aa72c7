import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Trash2 } from "lucide-react";

export default function Settings() {
  const [scriptUrl, setScriptUrl] = useState("");
  const [lastSync, setLastSync] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) {
      const config: Record<string, any> = {};
      data.forEach((s: any) => (config[s.key] = s.value));
      if (config.google_sheets) setScriptUrl(config.google_sheets.script_url || "");
      if (config.last_sync) setLastSync(config.last_sync);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: "google_sheets", value: { script_url: scriptUrl.trim() }, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    toast[error ? "error" : "success"](error ? "שגיאה בשמירת ההגדרות" : "ההגדרות נשמרו בהצלחה");
    setSaving(false);
  };

  const testConnection = async () => {
    if (!scriptUrl.trim()) return;
    setTesting(true);
    try {
      const res = await fetch(scriptUrl.trim());
      if (res.ok) {
        const data = await res.json();
        if (data.success) toast.success(`חיבור הצליח! נמצאו ${data.data?.length || 0} רשומות`);
        else toast.error("הסקריפט החזיר שגיאה");
      } else {
        toast.error(`שגיאת חיבור: ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    }
    setTesting(false);
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/sync-google-sheets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`סנכרון הושלם: ${data.synced} עודכנו, ${data.deleted || 0} נמחקו, ${data.newCommunities || 0} קהילות חדשות`);
        loadSettings();
      } else {
        toast.error(`שגיאת סנכרון: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    }
    setSyncing(false);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("יש להתחבר מחדש");
        setResetting(false);
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/reset-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("כל הנתונים אופסו בהצלחה");
        setResetDialogOpen(false);
      } else {
        toast.error(data.error || "שגיאה באיפוס");
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    }
    setResetting(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">הגדרות</h1>

      {/* Connection Settings */}
      <Card className="shadow-sm animate-slide-up">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-5 w-5 text-primary" />
            קישור Google Apps Script
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scriptUrl">כתובת הסקריפט (URL)</Label>
            <Input
              id="scriptUrl"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              dir="ltr"
              className="font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSettings} disabled={saving} size="sm">
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              שמור
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !scriptUrl.trim()} size="sm">
              {testing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              בדוק חיבור
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Control */}
      <Card className="shadow-sm animate-slide-up" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-5 w-5 text-primary" />
            סנכרון
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">קריאה חד-כיוונית מהגיליון. קהילות חדשות נוצרות אוטומטית.</p>
            <Button onClick={triggerSync} disabled={syncing || !scriptUrl.trim()} size="sm">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
              סנכרן עכשיו
            </Button>
          </div>

          {lastSync && (
            <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {lastSync.errors > 0 ? <AlertCircle className="h-4 w-4 text-warning" /> : <CheckCircle className="h-4 w-4 text-success" />}
                <span className="font-medium">סנכרון אחרון: {new Date(lastSync.timestamp).toLocaleString("he-IL")}</span>
              </div>
              <div className="flex gap-4 text-muted-foreground">
                <span>עודכנו: {lastSync.synced}</span>
                <span>שגיאות: {lastSync.errors}</span>
                <span>נמחקו: {lastSync.deleted || 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Data */}
      <Card className="shadow-sm border-destructive/30 animate-slide-up" style={{ animationDelay: "160ms", animationFillMode: "both" }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-5 w-5" />
            איפוס נתונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            מחיקת כל הרשומות, קהילות, היסטוריה ובקשות מחיקה. ההגדרות וחשבונות המשתמשים יישמרו.
          </p>
          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 ml-1" />
                אפס את כל הנתונים
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">אישור איפוס נתונים</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                פעולה זו תמחק את כל הרשומות, הקהילות, היסטוריית השינויים ובקשות המחיקה.
                <br />
                <strong>פעולה זו בלתי הפיכה!</strong>
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>ביטול</Button>
                <Button variant="destructive" onClick={handleReset} disabled={resetting}>
                  {resetting && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                  אפס הכל
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
