import { supabase } from '@/lib/supabase';

export interface ProfileRecord {
  id?: string;
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  work_authorization?: string | null;
  notice_period?: string | null;
  employment_status?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  years_experience?: number | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  currency?: string | null;
  remote_policy?: string | null;
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  willing_to_relocate?: boolean | null;
  willing_to_travel?: boolean | null;
  resume_url?: string | null;
  resume_skills?: string[] | null;
  learning_skills?: string[] | null;
  onboarding_complete?: boolean;
  updated_at?: string;
}

export interface PreferencesRecord {
  user_id: string;
  mode?: string;
  auto_apply_threshold?: number;
  daily_cap?: number;
  min_salary?: number | null;
  blocked_companies?: string[] | null;
  notify_email?: boolean;
  notify_whatsapp?: boolean;
  notify_telegram?: boolean;
}

export interface ScreeningAnswersRecord {
  user_id: string;
  authorized_to_work?: boolean | null;
  requires_sponsorship?: boolean | null;
  about_yourself?: string | null;
  why_leaving?: string | null;
  why_this_role?: string | null;
  challenging_project?: string | null;
  salary_statement?: string | null;
  ai_drafted?: boolean;
}

export interface IntegrationRecord {
  id?: string;
  user_id: string;
  provider: string;
  status?: string;
  meta?: Record<string, unknown> | null;
}

// In-memory fallback stores to guarantee zero-crash execution before SQL migration is pasted
const memoryProfiles = new Map<string, ProfileRecord>();
const memoryPreferences = new Map<string, PreferencesRecord>();
const memoryScreening = new Map<string, ScreeningAnswersRecord>();
const memoryIntegrations = new Map<string, IntegrationRecord[]>();

export const onboardingDb = {
  async getProfile(userId: string): Promise<ProfileRecord | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        memoryProfiles.set(userId, data);
        return data;
      }
    } catch {
      // Fallback
    }
    return memoryProfiles.get(userId) || null;
  },

  async getPreferences(userId: string): Promise<PreferencesRecord | null> {
    try {
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        memoryPreferences.set(userId, data);
        return data;
      }
    } catch {
      // Fallback
    }
    return memoryPreferences.get(userId) || null;
  },

  async getScreeningAnswers(userId: string): Promise<ScreeningAnswersRecord | null> {
    try {
      const { data, error } = await supabase
        .from('screening_answers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        memoryScreening.set(userId, data);
        return data;
      }
    } catch {
      // Fallback
    }
    return memoryScreening.get(userId) || null;
  },

  async upsertProfile(userId: string, updates: Partial<ProfileRecord>): Promise<ProfileRecord> {
    const existing = (await this.getProfile(userId)) || {
      user_id: userId,
      currency: 'INR',
      onboarding_complete: false,
    };

    const merged: ProfileRecord = {
      ...existing,
      ...updates,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    memoryProfiles.set(userId, merged);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(merged, { onConflict: 'user_id' })
        .select()
        .single();

      if (!error && data) {
        memoryProfiles.set(userId, data);
        return data;
      }
    } catch {
      // Return memory state
    }
    return merged;
  },

  async upsertPreferences(
    userId: string,
    updates: Partial<PreferencesRecord>
  ): Promise<PreferencesRecord> {
    const existing = (await this.getPreferences(userId)) || {
      user_id: userId,
      mode: 'copilot',
      auto_apply_threshold: 80,
      daily_cap: 5,
      notify_email: true,
      notify_whatsapp: false,
      notify_telegram: false,
    };

    const merged: PreferencesRecord = {
      ...existing,
      ...updates,
      user_id: userId,
    };
    memoryPreferences.set(userId, merged);

    try {
      const { data, error } = await supabase
        .from('preferences')
        .upsert(merged, { onConflict: 'user_id' })
        .select()
        .single();

      if (!error && data) {
        memoryPreferences.set(userId, data);
        return data;
      }
    } catch {
      // Return memory state
    }
    return merged;
  },

  async upsertScreeningAnswers(
    userId: string,
    updates: Partial<ScreeningAnswersRecord>
  ): Promise<ScreeningAnswersRecord> {
    const existing = (await this.getScreeningAnswers(userId)) || {
      user_id: userId,
      ai_drafted: false,
    };

    const merged: ScreeningAnswersRecord = {
      ...existing,
      ...updates,
      user_id: userId,
    };
    memoryScreening.set(userId, merged);

    try {
      const { data, error } = await supabase
        .from('screening_answers')
        .upsert(merged, { onConflict: 'user_id' })
        .select()
        .single();

      if (!error && data) {
        memoryScreening.set(userId, data);
        return data;
      }
    } catch {
      // Return memory state
    }
    return merged;
  },

  async upsertIntegration(
    userId: string,
    provider: string,
    status: string,
    meta?: Record<string, unknown>
  ): Promise<IntegrationRecord> {
    const record: IntegrationRecord = {
      user_id: userId,
      provider,
      status,
      meta: meta || {},
    };

    const userList = memoryIntegrations.get(userId) || [];
    const filtered = userList.filter((i) => i.provider !== provider);
    filtered.push(record);
    memoryIntegrations.set(userId, filtered);

    try {
      await supabase
        .from('integrations')
        .upsert(record, { onConflict: 'user_id,provider' });
    } catch {
      // Keep memory fallback
    }
    return record;
  },
};
