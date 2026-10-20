import { supabase } from '@/lib/supabase';
import { onboardingDb } from '@/lib/onboarding-db';

export type EmailClassifiedType = 'interview' | 'rejection' | 'offer' | 'other';

export interface EmailIntakeRecord {
  id: string;
  user_id: string;
  message_id: string;
  raw_subject: string;
  raw_body: string;
  classified_type: EmailClassifiedType;
  extracted_json: Record<string, any>;
  processed_at: string;
}

export interface InterviewRecord {
  id: string;
  application_id: string | null;
  user_id: string;
  company: string;
  round_number: number;
  round_type: string;
  scheduled_at: string;
  interviewer_name: string;
  format: string;
  focus_areas: string[];
  created_at: string;
}

export interface DossierResource {
  type: 'podcast' | 'video' | 'article' | 'repo';
  title: string;
  url: string;
  why: string;
}

export interface InterviewerIntel {
  name: string;
  role: string;
  recent_talk: string;
  style_tip: string;
}

export interface DossierJson {
  past_questions: string[];
  topic_clusters: string[];
  resources: DossierResource[];
  interviewer_intel: InterviewerIntel;
  company_stack: string[];
  research_method?: 'tinyfish_live' | 'mock_fixture';
}

export interface StudyPlanRecord {
  id: string;
  interview_id: string;
  user_id: string;
  days_count: number;
  dossier_json: DossierJson;
  created_at: string;
}

export interface StudyTaskRecord {
  id: string;
  plan_id: string;
  day: number;
  title: string;
  resource_url?: string | null;
  type: string; // podcast | video | article | repo | mock | revision
  duration_min: number;
  done: boolean;
  created_at: string;
}

export interface OfferRecord {
  id: string;
  application_id: string | null;
  user_id: string;
  company: string;
  salary_text: string;
  status: 'open' | 'accepted' | 'declined' | 'negotiating';
  created_at: string;
}

export interface ClassifierAuditRecord {
  id: string;
  user_id?: string | null;
  message_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  model_used: string;
  raw_response_snippet: string;
  raw_llm_response_snippet?: string;
  method: 'llm' | 'fallback';
  created_at: string;
}

export interface ResearchAuditRecord {
  id: string;
  interview_id: string;
  tinyfish_run_id: string;
  prompt: string;
  raw_response_snippet: string;
  sources_queried: string[];
  duration_ms: number;
  research_method: 'tinyfish_live' | 'mock_fixture';
  created_at: string;
}

export interface EmailDispatchRecord {
  id: string;
  user_id: string;
  application_id: string;
  to_email: string;
  subject: string;
  body_preview: string;
  status: 'sent_to_console' | 'sent_to_provider';
  sent_at: string;
}

interface GlobalPostApplyStore {
  emails: Map<string, EmailIntakeRecord>;
  interviews: Map<string, InterviewRecord>;
  studyPlans: Map<string, StudyPlanRecord>;
  studyTasks: Map<string, StudyTaskRecord>;
  offers: Map<string, OfferRecord>;
  classifierAudits: ClassifierAuditRecord[];
  researchAudits: Map<string, ResearchAuditRecord>;
  emailDispatches: EmailDispatchRecord[];
  syncLocks: Map<string, number>;
}

const globalForPostApply = globalThis as unknown as {
  __postApplyStore__?: GlobalPostApplyStore;
};

const store: GlobalPostApplyStore = globalForPostApply.__postApplyStore__ ?? {
  emails: new Map(),
  interviews: new Map(),
  studyPlans: new Map(),
  studyTasks: new Map(),
  offers: new Map(),
  classifierAudits: [],
  researchAudits: new Map(),
  emailDispatches: [],
  syncLocks: new Map(),
};

// Ensure arrays and maps exist if previously initialized
if (!store.classifierAudits) store.classifierAudits = [];
if (!store.researchAudits) store.researchAudits = new Map();
if (!store.emailDispatches) store.emailDispatches = [];
if (!store.syncLocks) store.syncLocks = new Map();

globalForPostApply.__postApplyStore__ = store;

export const postApplyDb = {
  // ===================== EMAILS INTAKE =====================
  async saveEmailIntake(record: Omit<EmailIntakeRecord, 'id' | 'processed_at'> & { id?: string }): Promise<EmailIntakeRecord> {
    const existing = await this.getEmailByMessageId(record.message_id);
    if (existing) return existing;

    const id = record.id || `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const processed_at = new Date().toISOString();
    const fullRecord: EmailIntakeRecord = {
      ...record,
      id,
      processed_at,
    };

    store.emails.set(id, fullRecord);

    try {
      await supabase.from('emails_intake').insert({
        id,
        user_id: record.user_id,
        message_id: record.message_id,
        raw_subject: record.raw_subject,
        raw_body: record.raw_body,
        classified_type: record.classified_type,
        extracted_json: record.extracted_json,
        processed_at,
      });
    } catch {
      // In-memory fallback
    }

    return fullRecord;
  },

  async getEmailByMessageId(messageId: string): Promise<EmailIntakeRecord | null> {
    for (const email of store.emails.values()) {
      if (email.message_id === messageId) return email;
    }

    try {
      const { data, error } = await supabase
        .from('emails_intake')
        .select('*')
        .eq('message_id', messageId)
        .maybeSingle();

      if (!error && data) {
        store.emails.set(data.id, data as EmailIntakeRecord);
        return data as EmailIntakeRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  // ===================== INTERVIEWS =====================
  async saveInterview(record: Omit<InterviewRecord, 'id' | 'created_at'> & { id?: string }): Promise<InterviewRecord> {
    return this.createInterview(record);
  },

  async createInterview(record: Omit<InterviewRecord, 'id' | 'created_at'> & { id?: string }): Promise<InterviewRecord> {
    if (!record.company || !record.company.trim()) {
      throw new Error('Interview row cannot exist without company');
    }

    const id = record.id || `intv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();
    const fullRecord: InterviewRecord = {
      ...record,
      id,
      created_at,
      focus_areas: record.focus_areas || [],
    };

    store.interviews.set(id, fullRecord);

    try {
      await supabase.from('interviews').insert({
        id,
        application_id: record.application_id,
        user_id: record.user_id,
        company: record.company,
        round_number: record.round_number || 1,
        round_type: record.round_type,
        scheduled_at: record.scheduled_at,
        interviewer_name: record.interviewer_name,
        format: record.format,
        focus_areas: record.focus_areas || [],
        created_at,
      });
    } catch {
      // Ignore
    }

    return fullRecord;
  },

  async getInterviewById(id: string): Promise<InterviewRecord | null> {
    const inMem = store.interviews.get(id);
    if (inMem) return inMem;

    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        store.interviews.set(data.id, data as InterviewRecord);
        return data as InterviewRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async listInterviews(userId: string): Promise<InterviewRecord[]> {
    const memoryList = Array.from(store.interviews.values())
      .filter((i) => i.user_id === userId)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const item of data) {
          store.interviews.set(item.id, item as InterviewRecord);
        }
        return data as InterviewRecord[];
      }
    } catch {
      // Fallback
    }

    return memoryList;
  },

  // ===================== WAR ROOM / STUDY PLANS =====================
  async saveStudyPlan(record: Omit<StudyPlanRecord, 'id' | 'created_at'> & { id?: string }): Promise<StudyPlanRecord> {
    // If an existing plan exists for this interview, overwrite/update it
    let id = record.id;
    for (const p of store.studyPlans.values()) {
      if (p.interview_id === record.interview_id) {
        id = p.id;
        break;
      }
    }
    id = id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();

    const fullRecord: StudyPlanRecord = {
      ...record,
      id,
      created_at,
    };

    store.studyPlans.set(id, fullRecord);

    try {
      await supabase.from('study_plans').upsert({
        id,
        interview_id: record.interview_id,
        user_id: record.user_id,
        days_count: record.days_count,
        dossier_json: record.dossier_json,
        created_at,
      });
    } catch {
      // Ignore
    }

    return fullRecord;
  },

  async getStudyPlanByInterview(interviewId: string): Promise<StudyPlanRecord | null> {
    for (const p of store.studyPlans.values()) {
      if (p.interview_id === interviewId) return p;
    }

    try {
      const { data, error } = await supabase
        .from('study_plans')
        .select('*')
        .eq('interview_id', interviewId)
        .maybeSingle();

      if (!error && data) {
        store.studyPlans.set(data.id, data as StudyPlanRecord);
        return data as StudyPlanRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  // ===================== STUDY TASKS =====================
  async createStudyTasks(tasks: Array<Omit<StudyTaskRecord, 'id' | 'created_at'>>): Promise<StudyTaskRecord[]> {
    const created: StudyTaskRecord[] = [];
    const now = new Date().toISOString();

    for (const t of tasks) {
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const taskRecord: StudyTaskRecord = {
        ...t,
        id,
        created_at: now,
      };
      store.studyTasks.set(id, taskRecord);
      created.push(taskRecord);
    }

    try {
      await supabase.from('study_tasks').insert(created);
    } catch {
      // Ignore
    }

    return created;
  },

  async listTasksByPlan(planId: string): Promise<StudyTaskRecord[]> {
    const memory = Array.from(store.studyTasks.values())
      .filter((t) => t.plan_id === planId)
      .sort((a, b) => a.day - b.day || a.title.localeCompare(b.title));

    try {
      const { data, error } = await supabase
        .from('study_tasks')
        .select('*')
        .eq('plan_id', planId)
        .order('day', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const item of data) {
          store.studyTasks.set(item.id, item as StudyTaskRecord);
        }
        return data as StudyTaskRecord[];
      }
    } catch {
      // Ignore
    }

    return memory;
  },

  async toggleTaskDone(taskId: string, done?: boolean): Promise<StudyTaskRecord | null> {
    const task = store.studyTasks.get(taskId);
    if (!task) return null;

    task.done = done !== undefined ? done : !task.done;
    store.studyTasks.set(taskId, task);

    try {
      await supabase
        .from('study_tasks')
        .update({ done: task.done })
        .eq('id', taskId);
    } catch {
      // Ignore
    }

    return task;
  },

  async getInterviewReadiness(interviewId: string): Promise<{
    total: number;
    done: number;
    percent: number;
    total_tasks: number;
    completed_tasks: number;
    readiness_percentage: number;
  }> {
    const plan = await this.getStudyPlanByInterview(interviewId);
    if (!plan) {
      return { total: 0, done: 0, percent: 0, total_tasks: 0, completed_tasks: 0, readiness_percentage: 0 };
    }

    const tasks = await this.listTasksByPlan(plan.id);
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      total,
      done,
      percent,
      total_tasks: total,
      completed_tasks: done,
      readiness_percentage: percent,
    };
  },

  // ===================== OFFERS =====================
  async createOffer(record: Omit<OfferRecord, 'id' | 'created_at'> & { id?: string }): Promise<OfferRecord> {
    const id = record.id || `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();
    const fullRecord: OfferRecord = {
      ...record,
      id,
      created_at,
    };

    store.offers.set(id, fullRecord);

    try {
      await supabase.from('offers').insert({
        id,
        application_id: record.application_id,
        user_id: record.user_id,
        company: record.company,
        salary_text: record.salary_text,
        status: record.status || 'open',
        created_at,
      });
    } catch {
      // Ignore
    }

    return fullRecord;
  },

  async listOffers(userId: string): Promise<OfferRecord[]> {
    const memory = Array.from(store.offers.values())
      .filter((o) => o.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as OfferRecord[];
      }
    } catch {
      // Fallback
    }

    return memory;
  },

  // ===================== LEARNING SKILLS APPEND =====================
  async appendLearningSkill(userId: string, skill: string): Promise<string[]> {
    if (!skill || !skill.trim()) return [];
    const normalized = skill.trim();

    const profile = await onboardingDb.getProfile(userId);
    const existingSkills: string[] = (profile as any)?.learning_skills || [];

    if (!existingSkills.some((s) => s.toLowerCase() === normalized.toLowerCase())) {
      const updated = [...existingSkills, normalized];
      await onboardingDb.upsertProfile(userId, {
        ...(profile || {}),
        user_id: userId,
        learning_skills: updated,
      } as any);
      return updated;
    }

    return existingSkills;
  },

  // ===================== CONCURRENT SYNC LOCK =====================
  async acquireSyncLock(userId: string): Promise<boolean> {
    const now = Date.now();
    const existingLock = store.syncLocks.get(userId);
    if (existingLock && existingLock > now) {
      return false; // Still locked within 30s TTL
    }
    // Set 30s TTL lock
    store.syncLocks.set(userId, now + 30000);
    return true;
  },

  async releaseSyncLock(userId: string): Promise<void> {
    store.syncLocks.delete(userId);
  },

  // ===================== CLASSIFIER AUDIT LOGS =====================
  async saveClassifierAudit(record: Omit<ClassifierAuditRecord, 'id' | 'created_at'> & { id?: string }): Promise<ClassifierAuditRecord> {
    const id = record.id || `ca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();
    const raw_response_snippet = record.raw_response_snippet || record.raw_llm_response_snippet || '';
    const item: ClassifierAuditRecord = {
      ...record,
      id,
      created_at,
      raw_response_snippet,
      raw_llm_response_snippet: raw_response_snippet,
    };
    store.classifierAudits.unshift(item);

    try {
      await supabase.from('classifier_audit_logs').insert(item);
    } catch {
      // In-memory fallback
    }
    return item;
  },

  async listClassifierAudits(limit = 10): Promise<ClassifierAuditRecord[]> {
    try {
      const { data, error } = await supabase
        .from('classifier_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data as ClassifierAuditRecord[];
      }
    } catch {
      // Ignore
    }
    return store.classifierAudits.slice(0, limit);
  },

  // ===================== RESEARCH AUDIT LOGS =====================
  async saveResearchAudit(record: Omit<ResearchAuditRecord, 'id' | 'created_at'> & { id?: string }): Promise<ResearchAuditRecord> {
    const id = record.id || `ra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();
    const item: ResearchAuditRecord = { ...record, id, created_at };
    store.researchAudits.set(record.interview_id, item);

    try {
      await supabase.from('research_audit_logs').insert(item);
    } catch {
      // In-memory fallback
    }
    return item;
  },

  async getResearchAuditForInterview(interviewId: string): Promise<ResearchAuditRecord | null> {
    const mem = store.researchAudits.get(interviewId);
    if (mem) return mem;

    try {
      const { data, error } = await supabase
        .from('research_audit_logs')
        .select('*')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data as ResearchAuditRecord;
      }
    } catch {
      // Ignore
    }
    return null;
  },

  async getLastResearchMethod(): Promise<'tinyfish_live' | 'mock_fixture' | null> {
    const list = Array.from(store.researchAudits.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (list.length > 0) return list[0].research_method;

    try {
      const { data, error } = await supabase
        .from('research_audit_logs')
        .select('research_method')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.research_method) {
        return data.research_method as 'tinyfish_live' | 'mock_fixture';
      }
    } catch {
      // Ignore
    }
    return null;
  },

  // ===================== EMAIL DISPATCH LOGS =====================
  async saveEmailDispatch(record: Omit<EmailDispatchRecord, 'id' | 'sent_at'> & { id?: string }): Promise<EmailDispatchRecord> {
    const id = record.id || `ed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sent_at = new Date().toISOString();
    const item: EmailDispatchRecord = { ...record, id, sent_at };
    store.emailDispatches.unshift(item);

    try {
      await supabase.from('email_dispatch_logs').insert(item);
    } catch {
      // In-memory fallback
    }
    return item;
  },

  async listEmailDispatches(userId?: string): Promise<EmailDispatchRecord[]> {
    try {
      let query = supabase.from('email_dispatch_logs').select('*').order('sent_at', { ascending: false });
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as EmailDispatchRecord[];
      }
    } catch {
      // Ignore
    }
    if (userId) {
      return store.emailDispatches.filter((e) => e.user_id === userId);
    }
    return store.emailDispatches;
  },
};
