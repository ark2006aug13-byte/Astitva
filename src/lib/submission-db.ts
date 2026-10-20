import { supabase } from '@/lib/supabase';

export type ApplicationStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'auto_approved'
  | 'submitting'
  | 'submitting_paused'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'manual_queue'
  | 'interview'
  | 'rejected';

export interface ResumeVersionRecord {
  id: string;
  job_id: string;
  user_id: string;
  pdf_url: string;
  tailored_markdown: string;
  change_log: Array<{
    section: string;
    before: string;
    after: string;
    why: string;
  }>;
  ats_keywords_mapped?: string[];
  cover_letter: string;
  ats_score: number;
  ats_breakdown?: {
    keyword_coverage: number;
    skill_coverage: number;
    final_score: number;
  };
  created_at: string;
}

export interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id: string;
  version_id?: string | null;
  status: ApplicationStatus;
  form_data_json: Record<string, any>;
  edits_json?: Record<string, any> | null;
  proof_url?: string | null;
  review_shot?: string | null;
  confirmation_id?: string | null;
  reapply_after?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequestRecord {
  id: string;
  application_id: string;
  user_id: string;
  decision: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  edits_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationEventRecord {
  id: string;
  application_id: string;
  event: string;
  event_type?: string;
  meta: Record<string, any>;
  ts: string;
}

export interface FollowUpRecord {
  id: string;
  application_id: string;
  user_id: string;
  scheduled_at: string; // ISO string, now + 14 days
  status: 'pending' | 'scheduled' | 'sent' | 'completed' | 'cancelled';
  notes?: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  channel: 'web' | 'telegram' | 'whatsapp';
  title: string;
  message: string;
  meta?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface DemoSubmissionRecord {
  id: string;
  confirmation_id: string;
  form_data: Record<string, any>;
  proof_url?: string | null;
  created_at: string;
}

// Global Memory Store for zero-failure resilience across Next.js bundles and offline dev
interface GlobalSubmissionStore {
  resumeVersions: Map<string, ResumeVersionRecord>;
  applications: Map<string, ApplicationRecord>;
  approvalRequests: Map<string, ApprovalRequestRecord>;
  applicationEvents: ApplicationEventRecord[];
  followUps: Map<string, FollowUpRecord>;
  notifications: NotificationRecord[];
  demoSubmissions: Map<string, DemoSubmissionRecord>;
  dailySubmissions: Map<string, number>; // key: "submit:<userId>:<date>"
}

const globalForSubmissions = globalThis as unknown as {
  __submissionStore__?: GlobalSubmissionStore;
};

const store: GlobalSubmissionStore = globalForSubmissions.__submissionStore__ ?? {
  resumeVersions: new Map(),
  applications: new Map(),
  approvalRequests: new Map(),
  applicationEvents: [],
  followUps: new Map(),
  notifications: [],
  demoSubmissions: new Map(),
  dailySubmissions: new Map(),
};

globalForSubmissions.__submissionStore__ = store;

export const submissionDb = {
  // ===================== RESUME VERSIONS =====================
  async saveResumeVersion(record: Omit<ResumeVersionRecord, 'id' | 'created_at'> & { id?: string }): Promise<ResumeVersionRecord> {
    const id = record.id || `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created_at = new Date().toISOString();
    const fullRecord: ResumeVersionRecord = {
      ...record,
      id,
      created_at,
      ats_keywords_mapped: record.ats_keywords_mapped || [],
    };

    store.resumeVersions.set(id, fullRecord);

    try {
      await supabase.from('resume_versions').upsert({
        id,
        job_id: record.job_id,
        user_id: record.user_id,
        pdf_url: record.pdf_url,
        tailored_markdown: record.tailored_markdown,
        change_log: record.change_log,
        cover_letter: record.cover_letter,
        ats_score: record.ats_score,
        ats_breakdown: record.ats_breakdown || null,
        created_at,
      });
    } catch {
      // In-memory fallback
    }

    return fullRecord;
  },

  async getResumeVersion(id: string): Promise<ResumeVersionRecord | null> {
    const inMem = store.resumeVersions.get(id);
    if (inMem) return inMem;

    try {
      const { data, error } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        store.resumeVersions.set(data.id, data as ResumeVersionRecord);
        return data as ResumeVersionRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async getLatestResumeVersionForJob(userId: string, jobId: string): Promise<ResumeVersionRecord | null> {
    // Search in memory first
    const memoryVersions = Array.from(store.resumeVersions.values())
      .filter((v) => v.user_id === userId && v.job_id === jobId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (memoryVersions.length > 0) return memoryVersions[0];

    try {
      const { data, error } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        store.resumeVersions.set(data.id, data as ResumeVersionRecord);
        return data as ResumeVersionRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  // ===================== APPLICATIONS =====================
  async getApplicationByJob(userId: string, jobId: string): Promise<ApplicationRecord | null> {
    for (const app of store.applications.values()) {
      if (app.user_id === userId && app.job_id === jobId) {
        return app;
      }
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .maybeSingle();

      if (!error && data) {
        store.applications.set(data.id, data as ApplicationRecord);
        return data as ApplicationRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async getApplicationById(id: string): Promise<ApplicationRecord | null> {
    const inMem = store.applications.get(id);
    if (inMem) return inMem;

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        store.applications.set(data.id, data as ApplicationRecord);
        return data as ApplicationRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async createApplication(record: {
    user_id: string;
    job_id: string;
    version_id?: string | null;
    status: ApplicationStatus;
    form_data_json: Record<string, any>;
    confirmation_id?: string | null;
    reapply_after?: string | null;
    created_at?: string;
    updated_at?: string;
  }): Promise<ApplicationRecord> {
    // Duplicate check: active applications
    const existing = await this.getApplicationByJob(record.user_id, record.job_id);
    if (existing) {
      if (existing.status === 'rejected') {
        const canReapply = existing.reapply_after && new Date(existing.reapply_after).getTime() <= Date.now();
        if (canReapply) {
          // Re-apply allowed after cool-off period has passed
          const reopened = await this.updateApplication(existing.id, {
            status: record.status,
            reapply_after: null,
            confirmation_id: null,
            proof_url: null,
            form_data_json: record.form_data_json,
          });
          return reopened || existing;
        }
      }
      return existing;
    }

    const id = `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = record.created_at || new Date().toISOString();
    const updated = record.updated_at || now;
    const newApp: ApplicationRecord = {
      id,
      user_id: record.user_id,
      job_id: record.job_id,
      version_id: record.version_id,
      status: record.status,
      form_data_json: record.form_data_json,
      confirmation_id: record.confirmation_id || null,
      reapply_after: record.reapply_after || null,
      created_at: now,
      updated_at: updated,
    };

    store.applications.set(id, newApp);

    try {
      await supabase.from('applications').insert({
        id,
        user_id: record.user_id,
        job_id: record.job_id,
        version_id: record.version_id,
        status: record.status,
        form_data_json: record.form_data_json,
        confirmation_id: record.confirmation_id || null,
        reapply_after: record.reapply_after || null,
        created_at: now,
        updated_at: updated,
      });
    } catch {
      // In-memory fallback
    }

    // Append initial state event
    await this.addApplicationEvent(id, `status_transition:${record.status}`, {
      initial_status: record.status,
    });

    return newApp;
  },

  async updateApplication(id: string, updates: Partial<ApplicationRecord>): Promise<ApplicationRecord | null> {
    const app = await this.getApplicationById(id);
    if (!app) return null;

    const previousStatus = app.status;
    const now = new Date().toISOString();
    const updated: ApplicationRecord = {
      ...app,
      ...updates,
      updated_at: now,
    };

    store.applications.set(id, updated);

    try {
      await supabase
        .from('applications')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', id);
    } catch {
      // Ignore
    }

    if (updates.status && updates.status !== previousStatus) {
      await this.addApplicationEvent(id, `status_transition:${updates.status}`, {
        from: previousStatus,
        to: updates.status,
      });
    }

    return updated;
  },

  async listApplications(userId: string): Promise<ApplicationRecord[]> {
    const memoryList = Array.from(store.applications.values())
      .filter((a) => a.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        for (const item of data) {
          store.applications.set(item.id, item as ApplicationRecord);
        }
        return data as ApplicationRecord[];
      }
    } catch {
      // Fallback to memory
    }

    return memoryList;
  },

  async createApprovalRequest(record: {
    application_id: string;
    user_id: string;
    edits_json?: Record<string, any>;
  }): Promise<ApprovalRequestRecord> {
    // Guard against duplicate pending approval request for the same application
    const existing = await this.getApprovalRequestByApplication(record.application_id);
    if (existing && existing.decision === 'pending') {
      return existing;
    }

    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newReq: ApprovalRequestRecord = {
      id,
      application_id: record.application_id,
      user_id: record.user_id,
      decision: 'pending',
      edits_json: record.edits_json || null,
      created_at: now,
      updated_at: now,
    };

    store.approvalRequests.set(id, newReq);

    try {
      await supabase.from('approval_requests').insert({
        id,
        application_id: record.application_id,
        user_id: record.user_id,
        decision: 'pending',
        edits_json: record.edits_json || null,
        created_at: now,
        updated_at: now,
      });
    } catch {
      // Ignore
    }

    await this.addApplicationEvent(record.application_id, 'approval_requested', {
      request_id: id,
    });

    return newReq;
  },

  async getApprovalRequestByApplication(applicationId: string): Promise<ApprovalRequestRecord | null> {
    for (const req of store.approvalRequests.values()) {
      if (req.application_id === applicationId) return req;
    }

    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle();

      if (!error && data) {
        store.approvalRequests.set(data.id, data as ApprovalRequestRecord);
        return data as ApprovalRequestRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async updateApprovalRequest(idOrAppId: string, updates: { decision: 'approved' | 'rejected'; rejection_reason?: string }): Promise<ApprovalRequestRecord | null> {
    const req = store.approvalRequests.get(idOrAppId);
    const appId = req ? req.application_id : idOrAppId;
    return this.updateApprovalDecision(appId, updates.decision, { rejection_reason: updates.rejection_reason });
  },

  async listApplicationEvents(applicationId: string): Promise<ApplicationEventRecord[]> {
    return this.getApplicationEvents(applicationId);
  },

  async updateApprovalDecision(
    applicationId: string,
    decision: 'approved' | 'rejected',
    options?: { edits_json?: Record<string, any>; rejection_reason?: string }
  ): Promise<ApprovalRequestRecord | null> {
    let req = await this.getApprovalRequestByApplication(applicationId);
    const now = new Date().toISOString();

    if (!req) {
      // In case approval request was implicit, create one
      req = {
        id: `req-${Date.now()}`,
        application_id: applicationId,
        user_id: 'default',
        decision,
        created_at: now,
        updated_at: now,
      };
    }

    const updated: ApprovalRequestRecord = {
      ...req,
      decision,
      rejection_reason: options?.rejection_reason || req.rejection_reason,
      edits_json: options?.edits_json || req.edits_json,
      updated_at: now,
    };

    store.approvalRequests.set(updated.id, updated);

    try {
      await supabase
        .from('approval_requests')
        .update({
          decision,
          rejection_reason: options?.rejection_reason,
          edits_json: options?.edits_json,
          updated_at: now,
        })
        .eq('application_id', applicationId);
    } catch {
      // Ignore
    }

    await this.addApplicationEvent(applicationId, `approval_decision:${decision}`, {
      decision,
      reason: options?.rejection_reason,
      has_edits: Boolean(options?.edits_json),
    });

    if (decision === 'rejected') {
      const reapplyAfter = new Date(Date.now() + 90 * 86400000).toISOString();
      await this.updateApplication(applicationId, {
        status: 'draft',
        reapply_after: reapplyAfter,
      });
    }

    return updated;
  },

  async listPendingApprovals(userId: string): Promise<ApprovalRequestRecord[]> {
    const memory = Array.from(store.approvalRequests.values())
      .filter((r) => r.user_id === userId && r.decision === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('decision', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        for (const r of data) {
          store.approvalRequests.set(r.id, r as ApprovalRequestRecord);
        }
        return data as ApprovalRequestRecord[];
      }
    } catch {
      // Ignore
    }

    return memory;
  },

  // ===================== APPLICATION EVENTS =====================
  async addApplicationEvent(applicationId: string, event: string, meta: Record<string, any> = {}): Promise<ApplicationEventRecord> {
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ts = new Date().toISOString();
    const eventRecord: ApplicationEventRecord = {
      id,
      application_id: applicationId,
      event,
      event_type: event,
      meta,
      ts,
    };

    store.applicationEvents.push(eventRecord);

    try {
      await supabase.from('application_events').insert({
        id,
        application_id: applicationId,
        event,
        meta,
        ts,
      });
    } catch {
      // Ignore
    }

    return eventRecord;
  },

  async getApplicationEvents(applicationId: string): Promise<ApplicationEventRecord[]> {
    const memory = store.applicationEvents
      .filter((e) => e.application_id === applicationId)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    try {
      const { data, error } = await supabase
        .from('application_events')
        .select('*')
        .eq('application_id', applicationId)
        .order('ts', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as ApplicationEventRecord[];
      }
    } catch {
      // Ignore
    }

    return memory;
  },

  // ===================== FOLLOW UPS =====================
  async createFollowUp(record: {
    application_id: string;
    user_id: string;
    scheduled_at?: string;
    notes?: string;
    status?: 'pending' | 'scheduled' | 'sent' | 'completed' | 'cancelled';
  }): Promise<FollowUpRecord> {
    const id = `fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Default +14 days
    const scheduled_at = record.scheduled_at || new Date(Date.now() + 14 * 86400000).toISOString();
    const now = new Date().toISOString();
    const status = record.status || 'scheduled';

    const fu: FollowUpRecord = {
      id,
      application_id: record.application_id,
      user_id: record.user_id,
      scheduled_at,
      status,
      notes: record.notes || 'Automated CareerPilot 14-day touchpoint check',
      created_at: now,
    };

    store.followUps.set(id, fu);

    try {
      await supabase.from('follow_ups').insert({
        id,
        application_id: record.application_id,
        user_id: record.user_id,
        scheduled_at,
        status,
        notes: fu.notes,
        created_at: now,
      });
    } catch {
      // Ignore
    }

    return fu;
  },

  async getFollowUpById(id: string): Promise<FollowUpRecord | null> {
    const mem = store.followUps.get(id);
    if (mem) return mem;

    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        store.followUps.set(data.id, data as FollowUpRecord);
        return data as FollowUpRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async getFollowUpForApplication(applicationId: string): Promise<FollowUpRecord | null> {
    for (const fu of store.followUps.values()) {
      if (fu.application_id === applicationId) return fu;
    }

    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle();

      if (!error && data) {
        store.followUps.set(data.id, data as FollowUpRecord);
        return data as FollowUpRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  async listDueFollowUps(): Promise<FollowUpRecord[]> {
    const now = new Date().toISOString();
    const memoryDue = Array.from(store.followUps.values()).filter(
      (f) => (f.status === 'pending' || f.status === 'scheduled') && f.scheduled_at <= now
    );

    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .or('status.eq.pending,status.eq.scheduled')
        .lte('scheduled_at', now);

      if (!error && data && data.length > 0) {
        return data as FollowUpRecord[];
      }
    } catch {
      // Fallback
    }

    return memoryDue;
  },

  async completeFollowUp(id: string, status: 'sent' | 'completed' = 'sent'): Promise<FollowUpRecord | null> {
    let f = store.followUps.get(id) || null;
    if (f) {
      f.status = status;
      store.followUps.set(id, f);
    }

    try {
      const { data } = await supabase
        .from('follow_ups')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (data) {
        f = data as FollowUpRecord;
        store.followUps.set(id, f);
      }
    } catch {
      // Ignore
    }

    if (f) {
      await this.addApplicationEvent(f.application_id, 'follow_up_completed', {
        follow_up_id: id,
        status,
      });
    }

    return f;
  },

  // ===================== NOTIFICATIONS =====================
  async createNotification(record: {
    user_id: string;
    channel?: 'web' | 'telegram' | 'whatsapp';
    title: string;
    message: string;
    meta?: Record<string, any>;
  }): Promise<NotificationRecord> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const notif: NotificationRecord = {
      id,
      user_id: record.user_id,
      channel: record.channel || 'web',
      title: record.title,
      message: record.message,
      meta: record.meta || {},
      read: false,
      created_at: new Date().toISOString(),
    };

    store.notifications.unshift(notif);

    try {
      await supabase.from('notifications').insert({
        id,
        user_id: record.user_id,
        channel: notif.channel,
        title: record.title,
        message: record.message,
        meta: notif.meta,
        read: false,
        created_at: notif.created_at,
      });
    } catch {
      // Ignore
    }

    return notif;
  },

  async listNotifications(userId: string): Promise<NotificationRecord[]> {
    const memory = store.notifications.filter((n) => n.user_id === userId);

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as NotificationRecord[];
      }
    } catch {
      // Ignore
    }

    return memory;
  },

  // ===================== DEMO SUBMISSIONS =====================
  async saveDemoSubmission(record: {
    confirmation_id: string;
    form_data: Record<string, any>;
    proof_url?: string;
  }): Promise<DemoSubmissionRecord> {
    const id = `sub-${Date.now()}`;
    const sub: DemoSubmissionRecord = {
      id,
      confirmation_id: record.confirmation_id,
      form_data: record.form_data,
      proof_url: record.proof_url || null,
      created_at: new Date().toISOString(),
    };

    store.demoSubmissions.set(record.confirmation_id, sub);

    try {
      await supabase.from('demo_submissions').insert({
        id,
        confirmation_id: record.confirmation_id,
        form_data: record.form_data,
        proof_url: sub.proof_url,
        created_at: sub.created_at,
      });
    } catch {
      // Ignore
    }

    return sub;
  },

  async getDemoSubmission(confirmationId: string): Promise<DemoSubmissionRecord | null> {
    const inMem = store.demoSubmissions.get(confirmationId);
    if (inMem) return inMem;

    try {
      const { data, error } = await supabase
        .from('demo_submissions')
        .select('*')
        .eq('confirmation_id', confirmationId)
        .maybeSingle();

      if (!error && data) {
        store.demoSubmissions.set(confirmationId, data as DemoSubmissionRecord);
        return data as DemoSubmissionRecord;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  // ===================== CADENCE LIMITER (Daily Cap) =====================
  checkAndIncrementDailyCadence(userId: string, dailyCap: number): { ok: boolean; used: number; cap: number } {
    const today = new Date().toISOString().slice(0, 10);
    const key = `submit:${userId}:${today}`;
    const currentUsed = store.dailySubmissions.get(key) || 0;

    if (currentUsed >= dailyCap) {
      return { ok: false, used: currentUsed, cap: dailyCap };
    }

    const nextCount = currentUsed + 1;
    store.dailySubmissions.set(key, nextCount);
    return { ok: true, used: nextCount, cap: dailyCap };
  },

  resetDailyCadence(userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const key = `submit:${userId}:${today}`;
    store.dailySubmissions.delete(key);
  },
};
