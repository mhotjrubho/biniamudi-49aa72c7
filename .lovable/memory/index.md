Design system: Heebo font, warm gold primary (38 72% 50%), dark charcoal sidebar, RTL Hebrew
Risk level colors: classic=green, attention=amber, report=orange, treatment=red
Roles: admin, community_manager, tiferet_david (stored in user_roles table)
DB tables: communities, profiles, user_roles, records, deletion_queue, history_logs, app_settings
National ID (T.Z.) is the unique identifier for records
Managers cannot see national_id field, only admins can
Tiferet David reps see only needs_treatment records
Soft delete: managers request, admin approves via deletion_queue
Google Sheets sync: one-way (Script→DB), uses Google Apps Script URL (not API key)
Script URL stored in app_settings under google_sheets.script_url
JSON format: {success: true, data: [{national_id, last_name, first_name, phone, community, school, grade_class, last_updated}]}
Communities auto-created during sync if not existing
Deletion flow: approve → mark deleted_from_excel → auto-delete on next sync
Admin credentials: admin@community-system.com / Admin2026!
Edge functions: seed-admin, sync-google-sheets, manage-users, reset-data
Records table has: phone, last_updated, td_notes columns
Column labels: ישיבה (school), שיעור (grade_class) — NOT בית ספר/כיתה
td_notes: visible only to admin and tiferet_david roles
Reset-data: deletes records, communities, history_logs, deletion_queue (keeps settings + users)
