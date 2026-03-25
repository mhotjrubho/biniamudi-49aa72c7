-- Add a new column 'action_type' to the history_logs table
ALTER TABLE public.history_logs
ADD COLUMN action_type text;

-- Add a default value for existing rows for clarity, although it can be null
UPDATE public.history_logs
SET action_type = 'risk_level_changed'
WHERE action_type IS NULL;
