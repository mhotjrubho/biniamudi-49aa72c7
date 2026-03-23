import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value');

  const config: Record<string, any> = {};
  settings?.forEach((s: any) => config[s.key] = s.value);

  const sheetConfig = config['google_sheets'];
  if (!sheetConfig?.api_key || !sheetConfig?.sheet_id) {
    return new Response(JSON.stringify({ error: 'Google Sheets not configured' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { api_key, sheet_id, tab_name = 'Sheet1', column_mapping } = sheetConfig;

  // Default column mapping
  const mapping = column_mapping || {
    national_id: 0,
    last_name: 1,
    first_name: 2,
    community_name: 3,
    school: 4,
    grade_class: 5,
    risk_level: 6,
    notes: 7,
  };

  // Fetch from Google Sheets API
  const range = encodeURIComponent(tab_name);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}/values/${range}?key=${api_key}`;
  const sheetRes = await fetch(url);

  if (!sheetRes.ok) {
    const err = await sheetRes.text();
    return new Response(JSON.stringify({ error: 'Failed to fetch sheet', details: err }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const sheetData = await sheetRes.json();
  const rows = sheetData.values || [];

  if (rows.length < 2) {
    return new Response(JSON.stringify({ message: 'No data rows found', synced: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get communities for name → id mapping
  const { data: communities } = await supabaseAdmin.from('communities').select('id, name');
  const communityMap: Record<string, string> = {};
  communities?.forEach((c: any) => communityMap[c.name] = c.id);

  const riskLevelMap: Record<string, string> = {
    'רגיל': 'classic',
    'classic': 'classic',
    'דורש תשומת לב': 'needs_attention',
    'needs_attention': 'needs_attention',
    'התקבל דיווח': 'report_received',
    'report_received': 'report_received',
    'דורש טיפול': 'needs_treatment',
    'needs_treatment': 'needs_treatment',
  };

  let synced = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nationalId = row[mapping.national_id]?.toString().trim();
    if (!nationalId) continue;

    const communityName = row[mapping.community_name]?.toString().trim() || '';
    const communityId = communityMap[communityName];
    if (!communityId) {
      errors++;
      errorDetails.push(`Row ${i + 1}: community "${communityName}" not found`);
      continue;
    }

    const riskRaw = row[mapping.risk_level]?.toString().trim() || 'classic';
    const riskLevel = riskLevelMap[riskRaw] || riskLevelMap[riskRaw.toLowerCase()] || 'classic';

    const record = {
      national_id: nationalId,
      last_name: row[mapping.last_name]?.toString().trim() || '',
      first_name: row[mapping.first_name]?.toString().trim() || '',
      community_id: communityId,
      school: row[mapping.school]?.toString().trim() || null,
      grade_class: row[mapping.grade_class]?.toString().trim() || null,
      risk_level: riskLevel,
      notes: row[mapping.notes]?.toString().trim() || null,
    };

    // Upsert by national_id
    const { data: existing } = await supabaseAdmin
      .from('records')
      .select('id')
      .eq('national_id', nationalId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('records').update(record).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('records').insert(record);
    }
    synced++;
  }

  // Handle approved deletions marked as deleted from Excel
  const { data: approvedDeletions } = await supabaseAdmin
    .from('deletion_queue')
    .select('id, record_id')
    .eq('status', 'approved')
    .eq('deleted_from_excel', true);

  let deleted = 0;
  for (const del of approvedDeletions || []) {
    await supabaseAdmin.from('records').delete().eq('id', del.record_id);
    await supabaseAdmin.from('deletion_queue').update({ status: 'completed' }).eq('id', del.id);
    deleted++;
  }

  // Update last sync timestamp
  await supabaseAdmin.from('app_settings').upsert({
    key: 'last_sync',
    value: { timestamp: new Date().toISOString(), synced, errors, deleted },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return new Response(JSON.stringify({ synced, errors, deleted, errorDetails }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
