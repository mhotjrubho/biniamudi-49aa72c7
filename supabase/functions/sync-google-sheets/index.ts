import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  if (!sheetConfig?.script_url) {
    return new Response(JSON.stringify({ error: 'Google Sheets script URL not configured' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { script_url } = sheetConfig;

  // Fetch from Google Apps Script
  const sheetRes = await fetch(script_url);

  if (!sheetRes.ok) {
    const err = await sheetRes.text();
    return new Response(JSON.stringify({ error: 'Failed to fetch script', details: err }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const sheetData = await sheetRes.json();
  
  if (!sheetData.success || !sheetData.data || sheetData.data.length === 0) {
    return new Response(JSON.stringify({ message: 'No data found', synced: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const rows = Array.isArray(sheetData.data) ? sheetData.data : [];
  const latestRowsByNationalId = new Map<string, any>();
  const duplicateRows: any[] = [];
  const missingNationalIdRows: any[] = [];

  for (const row of rows) {
    const nationalId = row.national_id?.toString().trim();

    if (!nationalId) {
      missingNationalIdRows.push(row);
      continue;
    }

    if (latestRowsByNationalId.has(nationalId)) {
      duplicateRows.push(row);
    }

    latestRowsByNationalId.set(nationalId, row);
  }

  const uniqueRows = Array.from(latestRowsByNationalId.values());

  // Get communities for name → id mapping
  const { data: communities } = await supabaseAdmin.from('communities').select('id, name');
  const communityMap: Record<string, string> = {};
  communities?.forEach((c: any) => communityMap[c.name] = c.id);

  let synced = 0;
  let errors = 0;
  let newCommunities = 0;
  let skipped = missingNationalIdRows.length;
  const duplicate_rows = duplicateRows.length;
  const errorDetails: string[] = [];

  for (const row of missingNationalIdRows) {
    await supabaseAdmin.from('unresolved_records').insert({
      raw_data: row,
      error_reason: 'Missing or empty national_id'
    });
  }

  for (const row of duplicateRows) {
    const nationalId = row.national_id?.toString().trim();
    errors++;
    errorDetails.push(`national_id ${nationalId}: duplicate row in source`);
    await supabaseAdmin.from('unresolved_records').insert({
      raw_data: row,
      error_reason: `Duplicate national_id in source: ${nationalId}`
    });
  }

  for (const row of uniqueRows) {
    const nationalId = row.national_id?.toString().trim();
    if (!nationalId) {
      continue;
    }

    const communityName = row.community?.toString().trim() || '';
    let communityId = communityMap[communityName];
    
    // Auto-create community if not exists
    if (!communityId && communityName) {
      const { data: newComm } = await supabaseAdmin
        .from('communities')
        .insert({ name: communityName })
        .select('id')
        .single();
      if (newComm) {
        communityId = newComm.id;
        communityMap[communityName] = communityId;
        newCommunities++;
      }
    }

    if (!communityId) {
      errors++;
      errorDetails.push(`national_id ${nationalId}: community "${communityName}" could not be created`);
      await supabaseAdmin.from('unresolved_records').insert({
        raw_data: row,
        error_reason: `Community "${communityName}" does not exist and could not be created.`
      });
      continue;
    }

    const record: any = {
      national_id: nationalId,
      last_name: row.last_name?.toString().trim() || '',
      first_name: row.first_name?.toString().trim() || '',
      community_id: communityId,
      school: row.school?.toString().trim() || null,
      grade_class: row.grade_class?.toString().trim() || null,
      phone: row.phone?.toString().trim() || null,
      last_updated: row.last_updated?.toString().trim() || null,
    };

    // Upsert by national_id
    const { data: existing } = await supabaseAdmin
      .from('records')
      .select('id, is_deleted')
      .eq('national_id', nationalId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('records').update({ ...record, is_deleted: false }).eq('id', existing.id);
    } else {
      record.is_deleted = false; // Explicitly set new records as not deleted
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
    value: {
      timestamp: new Date().toISOString(),
      source_rows: rows.length,
      unique_rows: uniqueRows.length,
      duplicate_rows,
      synced,
      errors,
      skipped,
      deleted,
      newCommunities,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return new Response(JSON.stringify({
    source_rows: rows.length,
    unique_rows: uniqueRows.length,
    duplicate_rows,
    synced,
    skipped,
    errors,
    deleted,
    newCommunities,
    errorDetails,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
