
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'community_manager', 'tiferet_david');
CREATE TYPE public.risk_level AS ENUM ('classic', 'needs_attention', 'report_received', 'needs_treatment');
CREATE TYPE public.treatment_status AS ENUM ('known', 'unknown');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Communities table
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  community_id UUID REFERENCES public.communities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Records table (main data)
CREATE TABLE public.records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  national_id TEXT NOT NULL UNIQUE,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  community_id UUID NOT NULL REFERENCES public.communities(id),
  school TEXT,
  grade_class TEXT,
  risk_level risk_level NOT NULL DEFAULT 'classic',
  treatment_status treatment_status DEFAULT 'unknown',
  notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- Deletion queue
CREATE TABLE public.deletion_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.records(id),
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);
ALTER TABLE public.deletion_queue ENABLE ROW LEVEL SECURITY;

-- History logs
CREATE TABLE public.history_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.records(id),
  changed_by UUID NOT NULL,
  old_risk_level risk_level,
  new_risk_level risk_level,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.history_logs ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_records_updated_at BEFORE UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Communities: all authenticated can read
CREATE POLICY "Authenticated can read communities" ON public.communities
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage communities" ON public.communities
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: users see own, admins see all
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can insert profiles" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User roles: admins manage, users read own
CREATE POLICY "Users can read own role" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Records: role-based access
CREATE POLICY "Admins can access all records" ON public.records
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can read own community records" ON public.records
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'community_manager')
  AND community_id = (SELECT community_id FROM public.profiles WHERE user_id = auth.uid())
  AND is_deleted = false
);

CREATE POLICY "Managers can insert own community records" ON public.records
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'community_manager')
  AND community_id = (SELECT community_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Managers can update own community records" ON public.records
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'community_manager')
  AND community_id = (SELECT community_id FROM public.profiles WHERE user_id = auth.uid())
  AND is_deleted = false
);

CREATE POLICY "Tiferet David can read needs_treatment records" ON public.records
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'tiferet_david')
  AND risk_level = 'needs_treatment'
  AND is_deleted = false
);

CREATE POLICY "Tiferet David can update treatment_status" ON public.records
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'tiferet_david')
  AND risk_level = 'needs_treatment'
  AND is_deleted = false
);

-- Deletion queue
CREATE POLICY "Admins can manage deletion queue" ON public.deletion_queue
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can insert deletion requests" ON public.deletion_queue
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'community_manager')
  AND requested_by = auth.uid()
);

CREATE POLICY "Managers can read own deletion requests" ON public.deletion_queue
FOR SELECT TO authenticated USING (
  requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- History logs
CREATE POLICY "Admins can read all history" ON public.history_logs
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can read own community history" ON public.history_logs
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'community_manager')
  AND record_id IN (
    SELECT id FROM public.records
    WHERE community_id = (SELECT community_id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Authenticated can insert history" ON public.history_logs
FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());
