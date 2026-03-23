Design system: Heebo font, warm gold primary (38 72% 50%), dark charcoal sidebar, RTL Hebrew
Risk level colors: classic=green, attention=amber, report=orange, treatment=red
Roles: admin, community_manager, tiferet_david (stored in user_roles table)
DB tables: communities, profiles, user_roles, records, deletion_queue, history_logs, app_settings
National ID (T.Z.) is the unique identifier for records
Managers cannot see national_id field, only admins can
Tiferet David reps see only needs_treatment records
Soft delete: managers request, admin approves via deletion_queue
Google Sheets sync: one-way (Sheets→DB), every 10 min via pg_cron, config in app_settings
Deletion flow: approve → mark deleted_from_excel → auto-delete on next sync
Admin credentials: admin@community-system.com / Admin2026!
Edge functions: seed-admin, sync-google-sheets
