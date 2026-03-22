export const PROGRAMS = [
  "BBA", "B.Com", "BCA", "BA", "LLB", "MBA", "B.Tech",
  "BBA+MBA", "B.Com+MBA", "PGDM", "MCA", "MA", "M.Com", "Ph.D", "Diploma",
];

export const BUDGETS = ["₹3-5L", "₹5-8L", "₹8-12L", "₹12-16L", "₹16-20L", "₹20L+"];

export const BUDGET_MID: Record<string, number> = {
  "₹3-5L": 4, "₹5-8L": 6.5, "₹8-12L": 10,
  "₹12-16L": 14, "₹16-20L": 18, "₹20L+": 25,
};

export const TIERS = ["Tier 1", "Tier 2", "Tier 3"];
export const YEARS = ["2026", "2027", "2028"];

export const SPECS = [
  "Finance", "Marketing", "HR", "Operations", "IT", "Data Science",
  "Intl Business", "Healthcare", "Supply Chain", "Entrepreneurship",
  "General Mgmt", "Other",
];

export const TEAM = [
  "Kunal", "Shabhnoor", "Priya", "Manisha", "Prajakta", "Simran",
];

export const SOURCES = [
  "Website", "Referral", "Walk-in", "Instagram Ad", "Facebook Ad",
  "Google Ad", "Event/Seminar", "Partner", "Cold Call", "Other",
];

export const WA_TEMPLATES = [
  { id: "intro", label: "Introduction", msg: "Hi {name}, this is {counsellor} from our education consultancy. I'd love to help you explore the best {program} programs. When's a good time to chat?" },
  { id: "followup", label: "Follow-up", msg: "Hi {name}, just checking in! Have you had a chance to think about the colleges we discussed? Happy to answer any questions." },
  { id: "deadline", label: "Deadline Reminder", msg: "Hi {name}, quick reminder — the application deadline for the colleges we discussed is approaching. Let's make sure we don't miss it!" },
  { id: "docs", label: "Document Request", msg: "Hi {name}, to move forward with your application, we'll need a few documents. Could you share your marksheets, ID proof, and passport-size photos?" },
  { id: "visit", label: "Campus Visit", msg: "Hi {name}, we've arranged a campus visit for you. I'll share the details shortly. Excited for you to see the campus firsthand!" },
  { id: "congrats", label: "Congratulations", msg: "Hi {name}, congratulations on your admission! We're thrilled for you. Let's connect to complete the remaining formalities." },
];

export const STAGES = [
  { id: "ringing", label: "Ringing", g: "new" },
  { id: "contacted", label: "Contacted", g: "active" },
  { id: "connected_wa", label: "On WhatsApp", g: "active" },
  { id: "looking", label: "Exploring", g: "active" },
  { id: "counselled", label: "Counselled", g: "warm" },
  { id: "closed", label: "Closed", g: "won" },
  { id: "form_filled", label: "Form Filled", g: "won" },
  { id: "enrolled", label: "Enrolled", g: "won" },
  { id: "cashback", label: "Cashback Done", g: "won" },
  { id: "on_hold", label: "On Hold", g: "stalled" },
  { id: "reassigned", label: "Reassigned", g: "stalled" },
  { id: "not_interested", label: "Not Interested", g: "lost" },
  { id: "lost", label: "Lost", g: "lost" },
];

export const PIPELINE_COLS = [
  { id: "new", label: "New Enquiry", sub: "Ringing / first attempt" },
  { id: "active", label: "In Touch", sub: "Connected & following up" },
  { id: "warm", label: "Counselled", sub: "Session done, pitching colleges" },
  { id: "won", label: "Admission Stage", sub: "Form filled / enrolled" },
  { id: "stalled", label: "Ghosted / On Hold", sub: "Not replying / paused" },
  { id: "lost", label: "Dropped", sub: "Not interested / lost" },
];

export const FUNNEL_STAGES = [
  { id: "new", label: "New Enquiries", stages: ["ringing"] },
  { id: "contacted", label: "In Touch", stages: ["contacted", "connected_wa"] },
  { id: "exploring", label: "Exploring Options", stages: ["looking"] },
  { id: "counselled", label: "Counselled", stages: ["counselled"] },
  { id: "closing", label: "Admission Stage", stages: ["closed", "form_filled"] },
  { id: "enrolled", label: "Enrolled", stages: ["enrolled", "cashback"] },
];

export const GROUP_COLORS: Record<string, string> = {
  new: "#c9a96e",
  active: "#7ba4c4",
  warm: "#7bbfb4",
  won: "#7cb98a",
  stalled: "#8a8578",
  lost: "#c47a6c",
};
