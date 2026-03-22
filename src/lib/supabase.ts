import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Types ──
export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  program: string;
  budget: string;
  tier: string;
  intake: string;
  spec: string;
  global_mba: boolean;
  stage: string;
  counsellor: string;
  pitched: string[];
  looked: string[];
  notes: string;
  score: number;
  source: string;
  created_at: string;
  last_activity: string;
};

export type FollowUp = {
  id: string;
  lead_id: string;
  date: string;
  note: string;
  created_at: string;
};

// ── Lead Operations ──
export async function getLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*, follow_ups(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addLead(lead: Omit<Lead, "id" | "created_at" | "last_activity">) {
  const { data, error } = await supabase
    .from("leads")
    .insert([{ ...lead, last_activity: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const { data, error } = await supabase
    .from("leads")
    .update({ ...updates, last_activity: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

// ── Follow-up Operations ──
export async function addFollowUp(leadId: string, date: string, note: string) {
  const { data, error } = await supabase
    .from("follow_ups")
    .insert([{ lead_id: leadId, date, note }])
    .select()
    .single();
  if (error) throw error;
  // Also update lead's last_activity
  await supabase
    .from("leads")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", leadId);
  return data;
}

export async function deleteFollowUp(id: string) {
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);
  if (error) throw error;
}

// ── Bulk Import ──
export async function importLeads(leads: Omit<Lead, "id" | "created_at" | "last_activity">[]) {
  const withTimestamps = leads.map((l) => ({
    ...l,
    last_activity: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from("leads")
    .insert(withTimestamps)
    .select();
  if (error) throw error;
  return data;
}

// ── Reminder Operations ──
export type Reminder = {
  id: string;
  lead_id: string;
  counsellor: string;
  remind_at: string;
  note: string;
  sent: boolean;
  created_at: string;
};

export async function getReminders(leadId: string) {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("lead_id", leadId)
    .order("remind_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addReminder(leadId: string, counsellor: string, remindAt: string, note: string) {
  const { data, error } = await supabase
    .from("reminders")
    .insert([{ lead_id: leadId, counsellor, remind_at: remindAt, note }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

// ── Push Subscription ──
export async function savePushSubscription(counsellor: string, sub: any) {
  const { error } = await supabase
    .from("push_subscriptions")
    .insert([{
      counsellor,
      subscription_json: JSON.stringify(sub),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    }]);
  if (error) throw error;
}
