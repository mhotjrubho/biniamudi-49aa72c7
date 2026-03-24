import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings as SettingsIcon, RefreshCw, CheckCircle, AlertCircle, Loader2, Link as LinkIcon } from "lucide-react";

export default function Settings() {
  const [scriptUrl, setScriptUrl] = useState("");
  const [lastSync, setLastSync] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value");

    if (data) {
      const config: Record<string, any> = {};
      data.forEach((s: any) => (config[s.key] = s.value));

      if (config.google_sheets) {
        setScriptUrl(config.google_sheets.script_url || "");
      }
      if (config.last_sync) {
        setLastSync(config.last_sync);
      }
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "google_sheets",
        value: { script_url: scriptUrl },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      toast.error("שגיאה בשמירת ההגדרות");
    } else {
      toast.success("ההגדרות נשמרו בהצלחה");
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch(scriptUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(`חיבור הצליח! נמצאו ${data.data?.length || 0} רשומות`);
        } else {
          toast.error("הסקריפט החזיר שגיאה");
        }
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
        toast.success(`סנכרון הושלם: ${data.synced} רשומות עודכנו, ${data.deleted || 0} נמחקו, ${data.newCommunities || 0} קהילות חדשות`);
        loadSettings();
      } else {
        toast.error(`שגיאת סנכרון: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">הגדרות סנכרון Google Sheets</h1>

      {/* Connection Settings */}
      <Card className="shadow-md animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkIcon className="h-5 w-5 text-primary" />
            קישור לסקריפט Google Apps Script
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
            <p className="text-xs text-muted-foreground">
              הכנס את כתובת ה-URL של Google Apps Script שמחזיר JSON עם נתוני הרשומות.
              הסקריפט צריך להחזיר אובייקט עם שדה <code className="bg-muted px-1 rounded">success</code> ומערך <code className="bg-muted px-1 rounded">data</code>.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור הגדרות
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !scriptUrl}>
              {testing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              בדוק חיבור
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Control */}
      <Card className="shadow-md animate-slide-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            סנכרון
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">סנכרון אוטומטי כל 10 דקות</p>
              <p className="text-xs text-muted-foreground">הסנכרון קורא נתונים מהגיליון ומעדכן את המערכת (חד-כיווני). קהילות חדשות נוצרות אוטומטית.</p>
            </div>
            <Button onClick={triggerSync} disabled={syncing || !scriptUrl}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
              סנכרן עכשיו
            </Button>
          </div>

          {lastSync && (
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                {lastSync.errors > 0 ? (
                  <AlertCircle className="h-4 w-4 text-warning" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-success" />
                )}
                <span className="font-medium text-sm">סנכרון אחרון</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">תאריך: </span>
                  {new Date(lastSync.timestamp).toLocaleString("he-IL")}
                </div>
                <div>
                  <span className="text-muted-foreground">עודכנו: </span>
                  {lastSync.synced}
                </div>
                <div>
                  <span className="text-muted-foreground">שגיאות: </span>
                  {lastSync.errors}
                </div>
                <div>
                  <span className="text-muted-foreground">נמחקו: </span>
                  {lastSync.deleted}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JSON Format */}
      <Card className="shadow-md animate-slide-up border-primary/20" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle className="text-lg">פורמט JSON נדרש</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          <p>הסקריפט צריך להחזיר JSON בפורמט הבא:</p>
          <pre dir="ltr" className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">{`{
  "success": true,
  "data": [
    {
      "national_id": "021908669",
      "last_name": "ישראלי",
      "first_name": "ישראל",
      "phone": "0556779462",
      "community": "שם הקהילה",
      "school": "שם בית הספר",
      "grade_class": "שיעור א",
      "last_updated": ""
    }
  ]
}`}</pre>
          <p>
            <strong>שדות נתמכים:</strong> national_id, last_name, first_name, phone, community, school, grade_class, last_updated
          </p>
          <p>קהילות שלא קיימות במערכת ייווצרו אוטומטית בסנכרון.</p>
        </CardContent>
      </Card>
    </div>
  );
}
