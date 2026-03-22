"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase, getLeads, addLead as dbAddLead, updateLead as dbUpdateLead, addFollowUp as dbAddFollowUp, importLeads as dbImportLeads, deleteLead as dbDeleteLead, getReminders, addReminder as dbAddReminder, deleteReminder as dbDeleteReminder, savePushSubscription } from "@/lib/supabase";
import { PROGRAMS, BUDGETS, BUDGET_MID, TIERS, YEARS, SPECS, TEAM, SOURCES, WA_TEMPLATES, STAGES, PIPELINE_COLS, FUNNEL_STAGES, GROUP_COLORS } from "@/lib/constants";
import { registerPushNotifications } from "@/lib/push";

const TODAY = new Date().toISOString().split("T")[0];
const daysDiff = (a: string, b: string) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

// ── Micro Components ──

function Score({ v }: { v: number }) {
  const color = v >= 75 ? "#7cb98a" : v >= 45 ? "#c9a96e" : "#c47a6c";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 40, height: 3, borderRadius: 2, background: "#2c2a28" }}>
        <div style={{ width: `${v}%`, height: "100%", borderRadius: 2, background: color, transition: "width .6s ease" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color, fontFamily: "'Cormorant Garamond',serif" }}>{v}</span>
    </div>
  );
}

function Tag({ children, c = "#c9a96e", style: sx = {} }: { children: React.ReactNode; c?: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex", padding: "2px 8px", borderRadius: 3, fontSize: 10,
      fontWeight: 600, letterSpacing: "0.06em", color: c,
      background: c + "12", border: `1px solid ${c}20`, textTransform: "uppercase", ...sx,
    }}>
      {children}
    </span>
  );
}

function UrgencyDot({ lead }: { lead: any }) {
  const dd = daysDiff(lead.last_activity?.split("T")[0] || lead.created_at?.split("T")[0] || TODAY, TODAY);
  const overdue = lead.follow_ups?.some((f: any) => f.date <= TODAY);
  const done = ["enrolled", "cashback", "lost", "not_interested"].includes(lead.stage);
  if (done) return null;
  if (overdue) return <div style={{ width: 7, height: 7, borderRadius: 4, background: "#e45858", boxShadow: "0 0 8px #e4585880", flexShrink: 0 }} />;
  if (dd >= 5) return <div style={{ width: 6, height: 6, borderRadius: 3, background: "#c9a96e", boxShadow: "0 0 6px rgba(201,169,110,0.6)", flexShrink: 0 }} />;
  if (dd >= 3) return <div style={{ width: 5, height: 5, borderRadius: 3, background: "rgba(201,169,110,0.5)", flexShrink: 0 }} />;
  return null;
}

function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string; wide?: boolean }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#191817", borderRadius: 16, border: "1px solid rgba(195,180,150,0.09)", width: wide ? 800 : 520, maxWidth: "96vw", maxHeight: "88vh", overflow: "auto", boxShadow: "0 50px 100px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(195,180,150,0.09)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#191817", zIndex: 2, borderRadius: "16px 16px 0 0" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#e8e4dd", fontFamily: "'Cormorant Garamond',serif" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8a8578", fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "18px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#8a8578", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#0f0f0e", color: "#e8e4dd", fontSize: 13, outline: "none", fontFamily: "'Outfit',sans-serif", boxSizing: "border-box", ...(props.style || {}) }} />
    </div>
  );
}

function Sel({ label, options, ...props }: { label?: string; options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#8a8578", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</label>}
      <select {...props} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#0f0f0e", color: "#e8e4dd", fontSize: 13, outline: "none", fontFamily: "'Outfit',sans-serif", cursor: "pointer", ...(props.style || {}) }}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, v = "primary", ...props }: { children: React.ReactNode; v?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "#c9a96e", color: "#0f0f0e", border: "none", fontWeight: 600 },
    ghost: { background: "transparent", color: "#8a8578", border: "1px solid rgba(195,180,150,0.09)" },
    danger: { background: "rgba(196,122,108,0.1)", color: "#c47a6c", border: "1px solid rgba(196,122,108,0.13)" },
  };
  return (
    <button {...props} style={{ padding: "8px 18px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", letterSpacing: "0.03em", transition: "all .2s", ...(styles[v] || styles.primary), ...(props.style || {}) }}>
      {children}
    </button>
  );
}

// ── Main App ──

export default function Home() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("pipeline");
  const [q, setQ] = useState("");
  const [fStage, setFS] = useState("");
  const [fTeam, setFT] = useState("");
  const [fProg, setFP] = useState("");
  const [fBudget, setFB] = useState("");
  const [fTier, setFTier] = useState("");
  const [fSource, setFSrc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [showFilter, setShowFilter] = useState(false);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [newFU, setNewFU] = useState({ date: "", note: "" });
  const [showWA, setShowWA] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminder, setNewReminder] = useState({ date: "", time: "", note: "" });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [nf, setNF] = useState({ name: "", phone: "", email: "", program: "", budget: "", tier: "", intake: "2026", spec: "", global_mba: false, stage: "ringing", counsellor: "", pitched: "", looked: "", notes: "", source: "" });

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // ── Load leads from Supabase ──
  const fetchLeads = useCallback(async () => {
    try {
      const data = await getLeads();
      setLeads(data || []);
    } catch (e) {
      console.error("Failed to fetch leads:", e);
      notify("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();

    // Realtime subscription — live updates
    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, () => fetchLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  // Register push notifications on mount
  useEffect(() => {
    async function initPush() {
      try {
        const sub = await registerPushNotifications();
        if (sub) setPushEnabled(true);
      } catch (e) {
        console.log("Push not available");
      }
    }
    initPush();
  }, []);

  // Fetch reminders when a lead is selected
  const fetchReminders = useCallback(async (leadId: string) => {
    try {
      const data = await getReminders(leadId);
      setReminders(data || []);
    } catch (e) {
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    if (sel?.id) fetchReminders(sel.id);
  }, [sel?.id, fetchReminders]);

  const handleAddReminder = async (leadId: string, counsellor: string) => {
    if (!newReminder.date || !newReminder.time) { notify("Pick a date and time"); return; }
    const remindAt = new Date(`${newReminder.date}T${newReminder.time}:00`).toISOString();
    try {
      await dbAddReminder(leadId, counsellor, remindAt, newReminder.note);
      setNewReminder({ date: "", time: "", note: "" });
      notify("Reminder set");
      fetchReminders(leadId);
    } catch (e) { notify("Failed to set reminder"); }
  };

  const handleDeleteReminder = async (id: string, leadId: string) => {
    try {
      await dbDeleteReminder(id);
      fetchReminders(leadId);
      notify("Reminder deleted");
    } catch (e) { notify("Failed to delete"); }
  };

  const enablePush = async (counsellor: string) => {
    try {
      const sub = await registerPushNotifications();
      if (sub) {
        await savePushSubscription(counsellor, sub);
        setPushEnabled(true);
        notify("Push notifications enabled");
      } else {
        notify("Push notifications blocked — check browser settings");
      }
    } catch (e) { notify("Failed to enable push"); }
  };

  const filtered = useMemo(() => leads.filter((l) => {
    if (q && !l.name.toLowerCase().includes(q.toLowerCase()) && !l.phone.includes(q)) return false;
    if (fStage && l.stage !== fStage) return false;
    if (fTeam && l.counsellor !== fTeam) return false;
    if (fProg && l.program !== fProg) return false;
    if (fBudget && l.budget !== fBudget) return false;
    if (fTier && l.tier !== fTier) return false;
    if (fSource && l.source !== fSource) return false;
    return true;
  }), [leads, q, fStage, fTeam, fProg, fBudget, fTier, fSource]);

  const stats = useMemo(() => {
    const t = leads.length;
    const hot = leads.filter((l) => l.score >= 75).length;
    const en = leads.filter((l) => l.stage === "enrolled").length;
    const ff = leads.filter((l) => l.stage === "form_filled").length;
    const lo = leads.filter((l) => ["lost", "not_interested"].includes(l.stage)).length;
    const overdue = leads.filter((l) => l.follow_ups?.some((f: any) => f.date <= TODAY) && !["enrolled", "cashback", "lost", "not_interested"].includes(l.stage)).length;
    // Response rate: leads that moved past "ringing" / total leads
    const responded = leads.filter((l) => l.stage !== "ringing").length;
    const responseRate = t ? (responded / t * 100).toFixed(0) : "0";
    // This week's activity: leads touched in last 7 days
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const activeThisWeek = leads.filter((l) => (l.last_activity?.split("T")[0] || "") >= weekAgoStr).length;
    // Untouched 3+ days
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysStr = threeDaysAgo.toISOString().split("T")[0];
    const untouched = leads.filter((l) => (l.last_activity?.split("T")[0] || "") < threeDaysStr && !["enrolled", "cashback", "lost", "not_interested"].includes(l.stage)).length;
    // Most popular program
    const progCounts: Record<string, number> = {};
    leads.forEach((l) => { if (l.program) progCounts[l.program] = (progCounts[l.program] || 0) + 1; });
    const topProgram = Object.entries(progCounts).sort((a, b) => b[1] - a[1])[0];
    return { t, hot, en, ff, lo, overdue, responseRate, activeThisWeek, untouched, topProgram: topProgram ? topProgram[0] : "—", topProgramCount: topProgram ? topProgram[1] : 0 };
  }, [leads]);

  const stageOf = (id: string) => STAGES.find((s) => s.id === id);

  // ── CRUD Operations ──
  const handleAdd = async () => {
    if (!nf.name || !nf.phone) { notify("Name and phone are required"); return; }
    try {
      await dbAddLead({
        name: nf.name, phone: nf.phone, email: nf.email || "", program: nf.program || "",
        budget: nf.budget || "", tier: nf.tier || "", intake: nf.intake || "2026", spec: nf.spec || "",
        global_mba: nf.global_mba || false, stage: nf.stage || "ringing", counsellor: nf.counsellor || "",
        pitched: nf.pitched ? nf.pitched.split(",").map((s) => s.trim()).filter(Boolean) : [],
        looked: nf.looked ? nf.looked.split(",").map((s) => s.trim()).filter(Boolean) : [],
        notes: nf.notes || "", score: 40, source: nf.source || "",
      });
      setShowAdd(false);
      notify("Lead added");
      setNF({ name: "", phone: "", email: "", program: "", budget: "", tier: "", intake: "2026", spec: "", global_mba: false, stage: "ringing", counsellor: "", pitched: "", looked: "", notes: "", source: "" });
      fetchLeads();
    } catch (e: any) {
      console.error("Add lead error:", e);
      notify("Failed: " + (e?.message || String(e)));
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      await dbUpdateLead(id, updates);
      if (sel?.id === id) setSel((p: any) => ({ ...p, ...updates }));
      fetchLeads();
    } catch (e: any) {
      console.error("Update error:", e);
      notify("Failed: " + (e?.message || String(e)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead? This cannot be undone.")) return;
    try {
      await dbDeleteLead(id);
      setSel(null);
      notify("Lead deleted");
      fetchLeads();
    } catch (e: any) {
      console.error("Delete error:", e);
      notify("Failed: " + (e?.message || String(e)));
    }
  };

  const handleAddFollowUp = async (leadId: string) => {
    if (!newFU.date || !newFU.note) return;
    try {
      await dbAddFollowUp(leadId, newFU.date, newFU.note);
      setNewFU({ date: "", note: "" });
      notify("Follow-up added");
    } catch (e) { notify("Failed to add follow-up"); }
  };

  const handleImport = async (text: string) => {
    try {
      const lines = text.trim().split("\n");
      if (lines.length < 2) { notify("No data rows"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const idx = (h: string) => headers.indexOf(h);
      const newLeads: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((s) => s.trim());
        const name = cols[idx("name")] || cols[0] || "";
        if (!name) continue;
        newLeads.push({
          name, phone: cols[idx("phone")] || cols[1] || "", email: cols[idx("email")] || cols[2] || "",
          program: cols[idx("program")] || "", budget: cols[idx("budget")] || "", tier: cols[idx("tier")] || "",
          intake: cols[idx("intake")] || "2026", spec: cols[idx("spec")] || "", global_mba: false,
          stage: "ringing", counsellor: cols[idx("counsellor")] || "", pitched: [], looked: [],
          notes: "", score: 40, source: cols[idx("source")] || "Other",
        });
      }
      await dbImportLeads(newLeads);
      notify(`${newLeads.length} leads imported`);
      setShowImport(false);
      setImportText("");
    } catch (e) { notify("Import failed"); }
  };

  const exportCSV = () => {
    const h = ["Name", "Phone", "Email", "Program", "Budget", "Tier", "Intake", "Stage", "Counsellor", "Score", "Global MBA", "Specialization", "Source", "Colleges Pitched", "Colleges Looked At", "Notes"];
    const esc = (v: any) => {
      const s = String(v || "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const r = leads.map((l) => [
      esc(l.name), esc(l.phone), esc(l.email), esc(l.program), esc(l.budget),
      esc(l.tier), esc(l.intake), esc(l.stage), esc(l.counsellor), l.score,
      l.global_mba ? "Yes" : "No", esc(l.spec), esc(l.source),
      esc((l.pitched || []).join("; ")), esc((l.looked || []).join("; ")), esc(l.notes),
    ]);
    const csv = [h, ...r].map((x) => x.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "shiksha-nerd-leads.csv";
    a.click();
    notify("CSV exported");
  };

  const sendWA = (lead: any, template: any) => {
    const msg = template.msg.replace(/{name}/g, lead.name).replace(/{counsellor}/g, lead.counsellor).replace(/{program}/g, lead.program);
    window.open(`https://wa.me/91${lead.phone}?text=${encodeURIComponent(msg)}`, "_blank");
    notify(`WhatsApp opened for ${lead.name}`);
    setShowWA(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target?.result as string);
    reader.readAsText(file);
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0e" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, color: "#c9a96e", fontFamily: "'Cormorant Garamond',serif", marginBottom: 8 }}>Shiksha Nerd</div>
          <div style={{ fontSize: 12, color: "#5c584f" }}>Loading your leads...</div>
          <div style={{ fontSize: 9, color: "#5c584f", marginTop: 16, letterSpacing: "0.1em" }}>Made by Hampton</div>
        </div>
      </div>
    );
  }

  const viewTabs = [{ id: "pipeline", l: "Pipeline" }, { id: "table", l: "Table" }, { id: "analytics", l: "Analytics" }];

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0e", color: "#e8e4dd", fontFamily: "'Outfit',sans-serif" }}>

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 2000, padding: "10px 20px", borderRadius: 8, background: "#222120", border: "1px solid rgba(201,169,110,0.2)", color: "#c9a96e", fontSize: 12, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}

      {/* HEADER */}
      <header style={{ padding: "12px 16px", borderBottom: "1px solid rgba(195,180,150,0.09)", background: "#191817", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, border: "1.5px solid rgba(201,169,110,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#c9a96e" }}>{"◆"}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "'Cormorant Garamond',serif", color: "#e8e4dd" }}>Shiksha Nerd</div>
              <div style={{ fontSize: 7, color: "#5c584f", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>Made by Hampton</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 140px", minWidth: 100 }}>
              <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", padding: "7px 10px 7px 26px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#0f0f0e", color: "#e8e4dd", fontSize: 12, outline: "none", fontFamily: "'Outfit',sans-serif" }} />
            </div>
            <Btn v="ghost" onClick={() => setShowFilter(!showFilter)} style={{ padding: "7px 10px", fontSize: 11 }}>Filters</Btn>
            <Btn v="ghost" onClick={() => setShowImport(true)} style={{ padding: "7px 10px", fontSize: 11 }}>Import</Btn>
            <Btn v="ghost" onClick={exportCSV} style={{ padding: "7px 10px", fontSize: 11 }}>Export</Btn>
            <Btn onClick={() => setShowAdd(true)} style={{ padding: "7px 14px", fontSize: 11 }}>+ Lead</Btn>
          </div>
        </div>
      </header>

      {/* FILTERS */}
      {showFilter && (
        <div style={{ padding: "10px 16px", background: "#191817", borderBottom: "1px solid rgba(195,180,150,0.09)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <Sel label="Stage" options={STAGES.map((s) => s.id)} value={fStage} onChange={(e) => setFS(e.target.value)} style={{ minWidth: 100 }} />
          <Sel label="Counsellor" options={TEAM} value={fTeam} onChange={(e) => setFT(e.target.value)} style={{ minWidth: 100 }} />
          <Sel label="Program" options={PROGRAMS} value={fProg} onChange={(e) => setFP(e.target.value)} style={{ minWidth: 80 }} />
          <Sel label="Budget" options={BUDGETS} value={fBudget} onChange={(e) => setFB(e.target.value)} style={{ minWidth: 80 }} />
          <Sel label="Tier" options={TIERS} value={fTier} onChange={(e) => setFTier(e.target.value)} style={{ minWidth: 70 }} />
          <Sel label="Source" options={SOURCES} value={fSource} onChange={(e) => setFSrc(e.target.value)} style={{ minWidth: 90 }} />
          <Btn v="danger" onClick={() => { setFS(""); setFT(""); setFP(""); setFB(""); setFTier(""); setFSrc(""); }} style={{ marginBottom: 14, fontSize: 11 }}>Clear</Btn>
        </div>
      )}

      {/* STATS */}
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
        {[
          { l: "Total Leads", v: stats.t, c: "#e8e4dd" },
          { l: "Hot Leads", v: stats.hot, c: "#c9a96e" },
          { l: "Enrolled", v: stats.en, c: "#7cb98a" },
          { l: "Response Rate", v: stats.responseRate + "%", c: "#7ba4c4" },
          { l: "Active This Week", v: stats.activeThisWeek, c: "#c9a96e" },
          { l: "Follow-ups Due", v: stats.overdue, c: "#c47a6c" },
          { l: "Untouched 3d+", v: stats.untouched, c: "#c47a6c" },
          { l: "Top Program", v: stats.topProgram, c: "#7bbfb4", sub: stats.topProgramCount + " leads" },
        ].map((s: any) => (
          <div key={s.l} style={{ background: "#1c1b19", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(195,180,150,0.09)" }}>
            <div style={{ fontSize: 8, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 300, color: s.c, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1 }}>{s.v}</div>
            {s.sub && <div style={{ fontSize: 9, color: "#5c584f", marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* VIEW TABS */}
      <div style={{ padding: "0 16px 10px", display: "flex", gap: 2 }}>
        {viewTabs.map((vt) => (
          <button key={vt.id} onClick={() => setView(vt.id)} style={{ padding: "6px 14px", borderRadius: 4, border: "none", background: view === vt.id ? "rgba(201,169,110,0.07)" : "transparent", color: view === vt.id ? "#c9a96e" : "#5c584f", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", transition: "all .2s" }}>{vt.l}</button>
        ))}
      </div>

      {/* PIPELINE */}
      {view === "pipeline" && (
        <div style={{ padding: "0 16px 24px", display: "flex", gap: 10, overflowX: "auto", minHeight: 400 }}>
          {PIPELINE_COLS.map((col) => {
            const colLeads = filtered.filter((l) => stageOf(l.stage)?.g === col.id);
            return (
              <div key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragCol(col.id); }}
                onDragLeave={() => setDragCol(null)}
                onDrop={(e) => { e.preventDefault(); const lid = e.dataTransfer.getData("lid"); const fs = STAGES.find((s) => s.g === col.id); if (fs) handleUpdate(lid, { stage: fs.id }); setDragCol(null); }}
                style={{ minWidth: 220, flex: "1 1 220px", background: dragCol === col.id ? "rgba(201,169,110,0.07)" : "#1c1b19", borderRadius: 10, border: `1px solid ${dragCol === col.id ? "rgba(201,169,110,0.2)" : "rgba(195,180,150,0.09)"}`, transition: "all .25s", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#e8e4dd" }}>{col.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#a08350", fontFamily: "'Cormorant Garamond',serif", background: "rgba(201,169,110,0.07)", padding: "1px 7px", borderRadius: 3 }}>{colLeads.length}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#5c584f", marginTop: 1 }}>{col.sub}</div>
                </div>
                <div style={{ padding: 8, flex: 1, overflowY: "auto", maxHeight: 480 }}>
                  {colLeads.map((lead) => {
                    const si = stageOf(lead.stage);
                    const fuOverdue = lead.follow_ups?.some((f: any) => f.date <= TODAY);
                    return (
                      <div key={lead.id} draggable
                        onDragStart={(e) => e.dataTransfer.setData("lid", lead.id)}
                        onClick={() => { setSel(lead); setTab("overview"); }}
                        style={{ background: "#191817", borderRadius: 7, padding: "10px 12px", marginBottom: 7, cursor: "pointer", border: "1px solid rgba(195,180,150,0.09)", transition: "all .2s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,169,110,0.2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(195,180,150,0.09)"; }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <UrgencyDot lead={lead} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e4dd", marginBottom: 1 }}>{lead.name}</div>
                              <div style={{ fontSize: 10, color: "#5c584f" }}>{lead.phone}</div>
                            </div>
                          </div>
                          <Score v={lead.score} />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                          <Tag>{lead.program}</Tag>
                          <Tag c="#7ba4c4">{lead.budget}</Tag>
                          {lead.global_mba && <Tag c="#7bbfb4">Global</Tag>}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "#5c584f" }}>{lead.counsellor}</span>
                          <Tag c="#8a8578" style={{ fontSize: 8 }}>{si?.label}</Tag>
                        </div>
                        {lead.follow_ups?.length > 0 && (
                          <div style={{ marginTop: 6, padding: "4px 7px", borderRadius: 4, background: fuOverdue ? "rgba(196,122,108,0.08)" : "rgba(201,169,110,0.05)", fontSize: 9, color: fuOverdue ? "#c47a6c" : "#c9a96e" }}>
                            {"↻"} {lead.follow_ups[0].note} — {lead.follow_ups[0].date}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {colLeads.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#5c584f", fontSize: 11 }}>Drop leads here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE */}
      {view === "table" && (
        <div style={{ padding: "0 16px 24px", overflowX: "auto" }}>
          <div style={{ background: "#1c1b19", borderRadius: 10, border: "1px solid rgba(195,180,150,0.09)", overflow: "hidden", minWidth: 900 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["", "Name", "Phone", "Program", "Budget", "Status", "Counsellor", "Score", "Source"].map((h) => (
                    <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, color: "#5c584f", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid rgba(195,180,150,0.09)", background: "#191817" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const si = stageOf(l.stage);
                  return (
                    <tr key={l.id} onClick={() => { setSel(l); setTab("overview"); }} style={{ cursor: "pointer", transition: "background .15s" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#242321"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)", width: 16 }}><UrgencyDot lead={l} /></td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)", fontWeight: 600, color: "#e8e4dd" }}>{l.name}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)", color: "#8a8578", fontSize: 11 }}>{l.phone}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}><Tag>{l.program}</Tag></td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}><Tag c="#7ba4c4">{l.budget}</Tag></td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}><Tag c={GROUP_COLORS[si?.g || ""] || "#8a8578"}>{si?.label}</Tag></td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)", color: "#8a8578", fontSize: 11 }}>{l.counsellor}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}><Score v={l.score} /></td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(195,180,150,0.09)" }}><Tag c="#8a8578" style={{ fontSize: 8 }}>{l.source}</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {view === "analytics" && (
        <div style={{ padding: "0 16px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          {/* Funnel */}
          <div style={{ background: "#1c1b19", borderRadius: 10, padding: 18, border: "1px solid rgba(195,180,150,0.09)", gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 14, fontFamily: "'Cormorant Garamond',serif", color: "#e8e4dd", marginBottom: 16 }}>Conversion Funnel</div>
            {(() => {
              const fd = FUNNEL_STAGES.map((fs) => ({ ...fs, count: leads.filter((l) => fs.stages.includes(l.stage)).length }));
              const mx = Math.max(...fd.map((f) => f.count), 1);
              const colors = ["#c9a96e", "#7ba4c4", "#7bbfb4", "#c9a96e", "#7cb98a", "#7cb98a"];
              return fd.map((f, i) => (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#8a8578" }}>{f.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: colors[i], fontFamily: "'Cormorant Garamond',serif" }}>{f.count}</span>
                  </div>
                  <div style={{ height: 18, borderRadius: 4, background: "#2c2a28" }}>
                    <div style={{ width: `${mx > 0 ? (f.count / mx) * 100 : 0}%`, height: "100%", borderRadius: 4, background: colors[i], transition: "width 1s ease", opacity: 0.8 }} />
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Team Activity */}
          <div style={{ background: "#1c1b19", borderRadius: 10, padding: 18, border: "1px solid rgba(195,180,150,0.09)" }}>
            <div style={{ fontSize: 14, fontFamily: "'Cormorant Garamond',serif", color: "#e8e4dd", marginBottom: 14 }}>Quick Insights</div>
            {[
              { l: "Response Rate", v: stats.responseRate + "%", c: "#7ba4c4", desc: "Leads that moved past ringing" },
              { l: "Active This Week", v: String(stats.activeThisWeek), c: "#c9a96e", desc: "Leads touched in last 7 days" },
              { l: "Untouched 3+ Days", v: String(stats.untouched), c: stats.untouched > 0 ? "#c47a6c" : "#7cb98a", desc: stats.untouched > 0 ? "These need attention" : "All leads are active" },
              { l: "Follow-ups Overdue", v: String(stats.overdue), c: stats.overdue > 0 ? "#c47a6c" : "#7cb98a", desc: stats.overdue > 0 ? "Counsellors need to act" : "All caught up" },
              { l: "Top Program", v: stats.topProgram, c: "#7bbfb4", desc: stats.topProgramCount + " leads interested" },
            ].map((r) => (
              <div key={r.l} style={{ padding: "12px 14px", borderRadius: 8, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 9, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 300, color: r.c, fontFamily: "'Cormorant Garamond',serif" }}>{r.v}</div>
                </div>
                <div style={{ fontSize: 10, color: "#5c584f", marginTop: 3 }}>{r.desc}</div>
              </div>
            ))}
          </div>

          {/* Counsellors */}
          <div style={{ background: "#1c1b19", borderRadius: 10, padding: 18, border: "1px solid rgba(195,180,150,0.09)" }}>
            <div style={{ fontSize: 14, fontFamily: "'Cormorant Garamond',serif", color: "#e8e4dd", marginBottom: 14 }}>Counsellor Performance</div>
            {TEAM.map((c) => {
              const cl = leads.filter((l) => l.counsellor === c);
              const en = cl.filter((l) => l.stage === "enrolled").length;
              const avg = cl.length ? Math.round(cl.reduce((a, l) => a + l.score, 0) / cl.length) : 0;
              return (
                <div key={c} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 7, background: "#191817", border: "1px solid rgba(195,180,150,0.09)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontWeight: 500, fontSize: 12, color: "#e8e4dd" }}>{c}</span>
                    <Tag>{cl.length} leads</Tag>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8a8578" }}>
                    <span>Enrolled: <strong style={{ color: "#7cb98a" }}>{en}</strong></span>
                    <span>Avg: <strong style={{ color: "#c9a96e" }}>{avg}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Lead" wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <Field label="Full Name" placeholder="Name" value={nf.name} onChange={(e) => setNF((p) => ({ ...p, name: e.target.value }))} />
          <Field label="Phone" placeholder="+91..." value={nf.phone} onChange={(e) => setNF((p) => ({ ...p, phone: e.target.value }))} />
          <Field label="Email" placeholder="email" value={nf.email} onChange={(e) => setNF((p) => ({ ...p, email: e.target.value }))} />
          <Sel label="Program" options={PROGRAMS} value={nf.program} onChange={(e) => setNF((p) => ({ ...p, program: e.target.value }))} />
          <Sel label="Budget" options={BUDGETS} value={nf.budget} onChange={(e) => setNF((p) => ({ ...p, budget: e.target.value }))} />
          <Sel label="Tier" options={TIERS} value={nf.tier} onChange={(e) => setNF((p) => ({ ...p, tier: e.target.value }))} />
          <Sel label="Intake" options={YEARS} value={nf.intake} onChange={(e) => setNF((p) => ({ ...p, intake: e.target.value }))} />
          <Sel label="Specialization" options={SPECS} value={nf.spec} onChange={(e) => setNF((p) => ({ ...p, spec: e.target.value }))} />
          <Sel label="Counsellor" options={TEAM} value={nf.counsellor} onChange={(e) => setNF((p) => ({ ...p, counsellor: e.target.value }))} />
          <Sel label="Source" options={SOURCES} value={nf.source} onChange={(e) => setNF((p) => ({ ...p, source: e.target.value }))} />
          <Field label="Colleges Pitched" placeholder="IIM-A, XLRI..." value={nf.pitched} onChange={(e) => setNF((p) => ({ ...p, pitched: e.target.value }))} />
          <Field label="Already Looked At" placeholder="ISB..." value={nf.looked} onChange={(e) => setNF((p) => ({ ...p, looked: e.target.value }))} />
          <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#8a8578" }}>
              <input type="checkbox" checked={nf.global_mba} onChange={(e) => setNF((p) => ({ ...p, global_mba: e.target.checked }))} style={{ accentColor: "#c9a96e" }} />
              Global MBA Interest
            </label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Notes" placeholder="Notes..." value={nf.notes} onChange={(e) => setNF((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Btn v="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={handleAdd}>Add Lead</Btn>
        </div>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Leads from CSV">
        <div style={{ fontSize: 11, color: "#8a8578", marginBottom: 12, lineHeight: 1.5 }}>
          Upload a CSV or paste data. Required: <strong style={{ color: "#c9a96e" }}>Name, Phone</strong>. Optional: Email, Program, Budget, Tier, Intake, Spec, Counsellor, Source.
        </div>
        <div style={{ marginBottom: 12 }}>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
          <Btn v="ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 11 }}>Choose CSV File</Btn>
        </div>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"Name,Phone,Email,Program,Budget\nJohn,9876543210,john@email.com,MBA,₹12-16L"} rows={8} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(195,180,150,0.09)", background: "#0f0f0e", color: "#e8e4dd", fontSize: 12, fontFamily: "'Outfit',sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <Btn v="ghost" onClick={() => setShowImport(false)}>Cancel</Btn>
          <Btn onClick={() => handleImport(importText)}>Import</Btn>
        </div>
      </Modal>

      {/* WHATSAPP MODAL */}
      <Modal open={!!showWA} onClose={() => setShowWA(null)} title="Send WhatsApp Message">
        {showWA && (
          <div>
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)" }}>
              <span style={{ fontSize: 12, color: "#8a8578" }}>To: </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e8e4dd" }}>{showWA.name}</span>
              <span style={{ fontSize: 11, color: "#5c584f", marginLeft: 8 }}>{showWA.phone}</span>
            </div>
            {WA_TEMPLATES.map((t) => {
              const preview = t.msg.replace(/{name}/g, showWA.name).replace(/{counsellor}/g, showWA.counsellor).replace(/{program}/g, showWA.program);
              return (
                <div key={t.id} onClick={() => sendWA(showWA, t)} style={{ padding: "12px 14px", borderRadius: 8, background: "#191817", border: "1px solid rgba(195,180,150,0.09)", marginBottom: 8, cursor: "pointer", transition: "all .2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e8e4dd" }}>{t.label}</span>
                    <Tag c="#7cb98a" style={{ fontSize: 8 }}>Open in WA</Tag>
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8578", lineHeight: 1.5 }}>{preview}</div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* LEAD DETAIL MODAL */}
      <Modal open={!!sel} onClose={() => { setSel(null); setTab("overview"); }} title={sel?.name || ""} wide>
        {sel && (() => {
          const lead = leads.find((l) => l.id === sel.id) || sel;
          const si = stageOf(lead.stage);
          return (
            <div>
              <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "1px solid rgba(195,180,150,0.09)", paddingBottom: 1, flexWrap: "wrap" }}>
                {["overview", "edit", "timeline", "colleges", "follow-ups", "reminders"].map((t) => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: "5px 12px", borderRadius: "4px 4px 0 0", border: "none", background: tab === t ? "rgba(201,169,110,0.07)" : "transparent", color: tab === t ? "#c9a96e" : "#5c584f", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", borderBottom: tab === t ? "2px solid #c9a96e" : "2px solid transparent", textTransform: "capitalize" }}>{t}</button>
                ))}
                <button onClick={() => { setShowWA(lead); setSel(null); }} style={{ padding: "5px 12px", borderRadius: "4px 4px 0 0", border: "none", background: "transparent", color: "#7cb98a", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", borderBottom: "2px solid transparent" }}>
                  {"◉"} WhatsApp
                </button>
              </div>

              {tab === "overview" && (
                <div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "10px 14px", borderRadius: 7, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)", marginBottom: 14, alignItems: "center" }}>
                    <UrgencyDot lead={lead} />
                    <Tag c={GROUP_COLORS[si?.g || ""] || "#8a8578"} style={{ fontSize: 11, padding: "3px 10px" }}>{si?.label}</Tag>
                    <Tag>{lead.program}</Tag>
                    <Tag c="#7ba4c4">{lead.budget}</Tag>
                    <Tag c="#7bbfb4">{lead.tier}</Tag>
                    {lead.global_mba && <Tag c="#7cb98a">Global MBA</Tag>}
                    {lead.source && <Tag c="#8a8578">{lead.source}</Tag>}
                    <div style={{ marginLeft: "auto" }}><Score v={lead.score} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px 18px" }}>
                    {[["Phone", lead.phone], ["Email", lead.email], ["Counsellor", lead.counsellor], ["Intake", lead.intake], ["Specialization", lead.spec], ["Source", lead.source]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 9, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                        <div style={{ fontSize: 12, color: "#e8e4dd" }}>{v || "—"}</div>
                      </div>
                    ))}
                  </div>
                  {lead.notes && (
                    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 7, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)" }}>
                      <div style={{ fontSize: 9, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Notes</div>
                      <div style={{ fontSize: 12, color: "#8a8578", lineHeight: 1.5 }}>{lead.notes}</div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                    <Sel label="Update Status" options={STAGES.map((s) => s.id)} value={lead.stage} onChange={(e) => handleUpdate(lead.id, { stage: e.target.value })} />
                    <Sel label="Reassign" options={TEAM} value={lead.counsellor} onChange={(e) => handleUpdate(lead.id, { counsellor: e.target.value })} />
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid rgba(195,180,150,0.06)" }}>
                    <Btn v="ghost" onClick={() => setTab("edit")} style={{ fontSize: 11, padding: "7px 16px" }}>
                      Edit Lead
                    </Btn>
                    <Btn v="danger" onClick={() => handleDelete(lead.id)} style={{ fontSize: 11, padding: "7px 16px" }}>
                      Delete Lead
                    </Btn>
                  </div>
                </div>
              )}

              {tab === "edit" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                    <Field label="Name" value={lead.name} onChange={(e) => setSel((p: any) => ({ ...p, name: e.target.value }))} />
                    <Field label="Phone" value={lead.phone} onChange={(e) => setSel((p: any) => ({ ...p, phone: e.target.value }))} />
                    <Field label="Email" value={lead.email || ""} onChange={(e) => setSel((p: any) => ({ ...p, email: e.target.value }))} />
                    <Sel label="Program" options={PROGRAMS} value={lead.program} onChange={(e) => setSel((p: any) => ({ ...p, program: e.target.value }))} />
                    <Sel label="Budget" options={BUDGETS} value={lead.budget} onChange={(e) => setSel((p: any) => ({ ...p, budget: e.target.value }))} />
                    <Sel label="Tier" options={TIERS} value={lead.tier} onChange={(e) => setSel((p: any) => ({ ...p, tier: e.target.value }))} />
                    <Sel label="Intake" options={YEARS} value={lead.intake} onChange={(e) => setSel((p: any) => ({ ...p, intake: e.target.value }))} />
                    <Sel label="Specialization" options={SPECS} value={lead.spec} onChange={(e) => setSel((p: any) => ({ ...p, spec: e.target.value }))} />
                    <Sel label="Counsellor" options={TEAM} value={lead.counsellor} onChange={(e) => setSel((p: any) => ({ ...p, counsellor: e.target.value }))} />
                    <Sel label="Source" options={SOURCES} value={lead.source} onChange={(e) => setSel((p: any) => ({ ...p, source: e.target.value }))} />
                    <Sel label="Status" options={STAGES.map((s) => s.id)} value={lead.stage} onChange={(e) => setSel((p: any) => ({ ...p, stage: e.target.value }))} />
                    <Field label="Score" type="number" value={lead.score} onChange={(e) => setSel((p: any) => ({ ...p, score: parseInt(e.target.value) || 0 }))} />
                    <Field label="Colleges Pitched" value={(lead.pitched || []).join(", ")} onChange={(e) => setSel((p: any) => ({ ...p, pitched: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }))} />
                    <Field label="Already Looked At" value={(lead.looked || []).join(", ")} onChange={(e) => setSel((p: any) => ({ ...p, looked: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }))} />
                    <div style={{ gridColumn: "1 / -1", marginBottom: 14 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#8a8578" }}>
                        <input type="checkbox" checked={lead.global_mba || false} onChange={(e) => setSel((p: any) => ({ ...p, global_mba: e.target.checked }))} style={{ accentColor: "#c9a96e" }} />
                        Global MBA Interest
                      </label>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#8a8578", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.12em" }}>Notes</label>
                        <textarea value={lead.notes || ""} onChange={(e) => setSel((p: any) => ({ ...p, notes: e.target.value }))}
                          rows={3} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#0f0f0e", color: "#e8e4dd", fontSize: 13, outline: "none", fontFamily: "'Outfit',sans-serif", boxSizing: "border-box", resize: "vertical" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                    <Btn v="ghost" onClick={() => setTab("overview")}>Cancel</Btn>
                    <Btn onClick={async () => {
                      try {
                        await handleUpdate(lead.id, {
                          name: lead.name, phone: lead.phone, email: lead.email,
                          program: lead.program, budget: lead.budget, tier: lead.tier,
                          intake: lead.intake, spec: lead.spec, global_mba: lead.global_mba,
                          stage: lead.stage, counsellor: lead.counsellor, score: lead.score,
                          pitched: lead.pitched || [], looked: lead.looked || [],
                          notes: lead.notes, source: lead.source,
                        });
                        notify("Lead updated");
                        setTab("overview");
                      } catch (e) { notify("Failed to save"); }
                    }}>Save Changes</Btn>
                  </div>
                </div>
              )}
                  </div>
                </div>
              )}

              {tab === "timeline" && (
                <div style={{ paddingLeft: 18, position: "relative" }}>
                  <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, width: 1, background: "rgba(201,169,110,0.13)" }} />
                  {[
                    { d: lead.created_at?.split("T")[0], t: "Lead created" },
                    { d: lead.created_at?.split("T")[0], t: `Source: ${lead.source || "Unknown"}` },
                    ...(lead.follow_ups || []).map((f: any) => ({ d: f.date, t: f.note })),
                    { d: lead.last_activity?.split("T")[0], t: `Current: ${si?.label}` },
                  ].map((x, i) => (
                    <div key={i} style={{ marginBottom: 16, position: "relative" }}>
                      <div style={{ position: "absolute", left: -15, top: 2, width: 10, height: 10, borderRadius: "50%", background: "#191817", border: "1.5px solid rgba(201,169,110,0.3)" }} />
                      <div style={{ fontSize: 10, color: "#5c584f", marginBottom: 1 }}>{x.d}</div>
                      <div style={{ fontSize: 12, color: "#8a8578" }}>{x.t}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "colleges" && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Pitched</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {lead.pitched?.length > 0 ? lead.pitched.map((c: string) => <Tag key={c}>{c}</Tag>) : <span style={{ color: "#5c584f", fontSize: 12 }}>None yet</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#5c584f", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Already Explored</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {lead.looked?.length > 0 ? lead.looked.map((c: string) => <Tag key={c} c="#7ba4c4">{c}</Tag>) : <span style={{ color: "#5c584f", fontSize: 12 }}>None</span>}
                    </div>
                  </div>
                </div>
              )}

              {tab === "follow-ups" && (
                <div>
                  {(lead.follow_ups || []).map((f: any) => (
                    <div key={f.id} style={{ padding: "9px 12px", borderRadius: 7, background: f.date <= TODAY ? "rgba(196,122,108,0.06)" : "rgba(201,169,110,0.04)", border: `1px solid ${f.date <= TODAY ? "rgba(196,122,108,0.13)" : "rgba(201,169,110,0.1)"}`, marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, color: "#e8e4dd", fontWeight: 500 }}>{f.note}</div>
                        {f.date <= TODAY && <Tag c="#c47a6c" style={{ fontSize: 8 }}>Overdue</Tag>}
                      </div>
                      <div style={{ fontSize: 10, color: f.date <= TODAY ? "#c47a6c" : "#a08350", marginTop: 2 }}>{"↻"} {f.date}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 7, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#5c584f", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>Add Follow-up</div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <input type="date" value={newFU.date} onChange={(e) => setNewFU((p) => ({ ...p, date: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#191817", color: "#e8e4dd", fontSize: 12, fontFamily: "'Outfit',sans-serif" }} />
                      <input placeholder="Note..." value={newFU.note} onChange={(e) => setNewFU((p) => ({ ...p, note: e.target.value }))} style={{ flex: 1, minWidth: 100, padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#191817", color: "#e8e4dd", fontSize: 12, outline: "none", fontFamily: "'Outfit',sans-serif" }} />
                      <Btn onClick={() => handleAddFollowUp(lead.id)} style={{ padding: "7px 14px", fontSize: 11 }}>+ Add</Btn>
                    </div>
                  </div>
                </div>
              )}

              {tab === "reminders" && (
                <div>
                  {reminders.length === 0 && (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#5c584f", fontSize: 12 }}>
                      No reminders set for this lead yet.
                    </div>
                  )}

                  {reminders.map((r: any) => {
                    const isPast = new Date(r.remind_at) < new Date();
                    const time = new Date(r.remind_at).toLocaleString("en-IN", {
                      weekday: "short", day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit", hour12: true,
                    });
                    return (
                      <div key={r.id} style={{
                        padding: "10px 12px", borderRadius: 7, marginBottom: 7,
                        background: r.sent ? "rgba(124,185,138,0.06)" : isPast ? "rgba(196,122,108,0.06)" : "rgba(201,169,110,0.04)",
                        border: `1px solid ${r.sent ? "rgba(124,185,138,0.13)" : isPast ? "rgba(196,122,108,0.13)" : "rgba(201,169,110,0.1)"}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "#e8e4dd", fontWeight: 500 }}>{r.note || "Reminder"}</div>
                            <div style={{ fontSize: 10, color: r.sent ? "#7cb98a" : isPast ? "#c47a6c" : "#a08350", marginTop: 3 }}>
                              {"⏰"} {time}
                            </div>
                            <div style={{ fontSize: 9, color: "#5c584f", marginTop: 2 }}>
                              For: {r.counsellor}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            {r.sent && <Tag c="#7cb98a" style={{ fontSize: 8 }}>Sent</Tag>}
                            {isPast && !r.sent && <Tag c="#c47a6c" style={{ fontSize: 8 }}>Missed</Tag>}
                            {!isPast && !r.sent && <Tag c="#c9a96e" style={{ fontSize: 8 }}>Pending</Tag>}
                            {!r.sent && (
                              <button onClick={() => handleDeleteReminder(r.id, lead.id)}
                                style={{ background: "none", border: "none", color: "#c47a6c", fontSize: 14, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add new reminder */}
                  <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 8, background: "#0f0f0e", border: "1px solid rgba(195,180,150,0.09)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#5c584f", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                      Set a Reminder
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={{ fontSize: 9, color: "#5c584f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Date</label>
                        <input type="date" value={newReminder.date} onChange={(e) => setNewReminder((p) => ({ ...p, date: e.target.value }))}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#191817", color: "#e8e4dd", fontSize: 12, fontFamily: "'Outfit',sans-serif" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={{ fontSize: 9, color: "#5c584f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Time</label>
                        <input type="time" value={newReminder.time} onChange={(e) => setNewReminder((p) => ({ ...p, time: e.target.value }))}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#191817", color: "#e8e4dd", fontSize: 12, fontFamily: "'Outfit',sans-serif" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 120 }}>
                        <label style={{ fontSize: 9, color: "#5c584f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Note</label>
                        <input placeholder="Call about scholarship..." value={newReminder.note} onChange={(e) => setNewReminder((p) => ({ ...p, note: e.target.value }))}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(195,180,150,0.09)", background: "#191817", color: "#e8e4dd", fontSize: 12, outline: "none", fontFamily: "'Outfit',sans-serif" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <Btn onClick={() => handleAddReminder(lead.id, lead.counsellor)} style={{ padding: "8px 16px", fontSize: 11 }}>
                        {"⏰"} Set Reminder
                      </Btn>
                      <div style={{ fontSize: 10, color: "#5c584f" }}>
                        Will notify <strong style={{ color: "#c9a96e" }}>{lead.counsellor}</strong> via email{pushEnabled ? " + push" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Push notification opt-in */}
                  {!pushEnabled && (
                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 7, background: "rgba(201,169,110,0.03)", border: "1px solid rgba(201,169,110,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#e8e4dd", fontWeight: 500, marginBottom: 2 }}>Browser Push Notifications</div>
                          <div style={{ fontSize: 11, color: "#5c584f" }}>Get notified even when this tab is closed</div>
                        </div>
                        <Btn v="ghost" onClick={() => enablePush(lead.counsellor)} style={{ fontSize: 11, padding: "6px 14px" }}>
                          Enable
                        </Btn>
                      </div>
                    </div>
                  )}

                  {pushEnabled && (
                    <div style={{ marginTop: 10, fontSize: 10, color: "#7cb98a", display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: "#7cb98a" }} />
                      Push notifications active on this browser
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
