import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings as SettingsIcon, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const DEFAULT_MAPPING = {
  national_id: 0,
  last_name: 1,
  first_name: 2,
  community_name: 3,
  school: 4,
  grade_class: 5,
  risk_level: 6,
  notes: 7,
};

const COLUMN_LABELS: Record<string, string> = {
  national_id: "ת.ז.",
  last_name: "שם משפחה",
  first_name: "שם פרטי",
  community_name: "קהילה",
  school: "בית ספר",
  grade_class: "כיתה",
  risk_level: "רמת סיכון",
  notes: "הערות",
};

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [tabName, setTabName] = useState("Sheet1");
  const [columnMapping, setColumnMapping] = useState(DEFAULT_MAPPING);
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
        setApiKey(config.google_sheets.api_key || "");
        setSheetId(config.google_sheets.sheet_id || "");
        setTabName(config.google_sheets.tab_name || "Sheet1");
        setColumnMapping(config.google_sheets.column_mapping || DEFAULT_MAPPING);
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
        value: {
          api_key: apiKey,
          sheet_id: sheetId,
          tab_name: tabName,
          column_mapping: columnMapping,
        },
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
      const range = encodeURIComponent(tabName);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rowCount = (data.values?.length || 1) - 1;
        toast.success(`חיבור הצליח! נמצאו ${rowCount} שורות נתונים`);
      } else {
        const err = await res.json();
        toast.error(`שגיאת חיבור: ${err.error?.message || "Unknown error"}`);
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
        toast.success(`סנכרון הושלם: ${data.synced} רשומות עודכנו, ${data.deleted} נמחקו`);
        loadSettings();
      } else {
        toast.error(`שגיאת סנכרון: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    }
    setSyncing(false);
  };

  const updateMapping = (field: string, value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0) {
      setColumnMapping((prev) => ({ ...prev, [field]: num }));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">הגדרות סנכרון Google Sheets</h1>

      {/* Connection Settings */}
      <Card className="shadow-md animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SettingsIcon className="h-5 w-5 text-primary" />
            הגדרות חיבור
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Google API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              ניתן ליצור ב-{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google Cloud Console
              </a>
              {" "}→ Credentials → Create API Key. יש להפעיל Google Sheets API.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheetId">Sheet ID</Label>
            <Input
              id="sheetId"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              ה-ID נמצא בכתובת ה-URL של הגיליון: docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/edit
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tabName">שם הלשונית (Tab)</Label>
            <Input
              id="tabName"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Sheet1"
              dir="ltr"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור הגדרות
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !apiKey || !sheetId}>
              {testing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              בדוק חיבור
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      <Card className="shadow-md animate-slide-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle className="text-lg">מיפוי עמודות</CardTitle>
          <p className="text-sm text-muted-foreground">
            ציין את מספר העמודה (0 = A, 1 = B, 2 = C...) עבור כל שדה
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(COLUMN_LABELS).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={columnMapping[field as keyof typeof columnMapping]}
                  onChange={(e) => updateMapping(field, e.target.value)}
                  dir="ltr"
                  className="text-center"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Control */}
      <Card className="shadow-md animate-slide-up" style={{ animationDelay: "200ms" }}>
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
              <p className="text-xs text-muted-foreground">הסנכרון מעדכן רשומות מהגיליון למערכת (חד-כיווני)</p>
            </div>
            <Button onClick={triggerSync} disabled={syncing || !apiKey || !sheetId}>
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

      {/* Instructions */}
      <Card className="shadow-md animate-slide-up border-primary/20" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle className="text-lg">הוראות הגדרה</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              גשו ל-
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline mx-1">
                Google Cloud Console
              </a>
              וצרו פרויקט חדש
            </li>
            <li>הפעילו את Google Sheets API בעמוד APIs & Services → Library</li>
            <li>צרו API Key בעמוד Credentials → Create Credentials → API Key</li>
            <li>שתפו את הגיליון שלכם כ-"Anyone with the link" (צפייה בלבד)</li>
            <li>העתיקו את ה-Sheet ID מכתובת ה-URL והדביקו כאן</li>
            <li>הגדירו את מיפוי העמודות לפי המבנה של הגיליון שלכם</li>
            <li>בדקו את החיבור ושמרו</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
