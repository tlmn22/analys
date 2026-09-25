-- Run in Supabase SQL Editor before saving the new attendance status.
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'sick';
NOTIFY pgrst, 'reload schema';
