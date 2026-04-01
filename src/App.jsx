import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { supabase, isConnected } from "./supabase";

// ─── Demo Data (used when Supabase isn't configured) ───────────────────────────
const DEMO_COURTS = [
  { id: "c1", label: "Court 1", court_number: 1, status: "in-use", paddles_waiting: 4, lastReport: "8m ago", reporter: "Mike R." },
  { id: "c2", label: "Court 2", court_number: 2, status: "in-use", paddles_waiting: 2, lastReport: "12m ago", reporter: "Sarah K." },
  { id: "c3", label: "Court 3", court_number: 3, status: "in-use", paddles_waiting: 0, lastReport: "5m ago", reporter: "Jay L." },
  { id: "c4", label: "Court 4", court_number: 4, status: "open", paddles_waiting: 0, lastReport: "22m ago", reporter: "Priya M." },
  { id: "c5", label: "Court 5", court_number: 5, status: "in-use", paddles_waiting: 6, lastReport: "3m ago", reporter: "Tom B." },
  { id: "c6", label: "Court 6", court_number: 6, status: "open", paddles_waiting: 0, lastReport: "30m ago", reporter: "Lisa W." },
];

const DEMO_FEED = [
  { id: "f1", user_name: "Mike R.", created_at: new Date(Date.now() - 8*60000).toISOString(), text: "Courts 1 & 2 have a solid group going. Court 4 is wide open.", verified: true },
  { id: "f2", user_name: "Sarah K.", created_at: new Date(Date.now() - 12*60000).toISOString(), text: "Wind is picking up from the south, heads up. Otherwise great conditions.", verified: true },
  { id: "f3", user_name: "Priya M.", created_at: new Date(Date.now() - 22*60000).toISOString(), text: "Just got here, courts 4 and 6 are open. Brought an extra paddle if anyone needs one!", verified: false },
  { id: "f4", user_name: "Tom B.", created_at: new Date(Date.now() - 38*60000).toISOString(), text: "Court 5 has a long wait — 6 paddles deep. I'd try the other side.", verified: true },
];

const DEMO_CHAT = [
  { id: "m1", user_name: "Mike R.", created_at: new Date(Date.now() - 30*60000).toISOString(), text: "Anyone want to run 4s on court 4? Need 2 more" },
  { id: "m2", user_name: "Sarah K.", created_at: new Date(Date.now() - 27*60000).toISOString(), text: "I'm in! Heading over in 10" },
  { id: "m3", user_name: "Jay L.", created_at: new Date(Date.now() - 24*60000).toISOString(), text: "Same, be there in 15. Who's got balls?" },
  { id: "m4", user_name: "Mike R.", created_at: new Date(Date.now() - 23*60000).toISOString(), text: "I've got a fresh can. Court 4 in 15 let's go 🏓" },
  { id: "m5", user_name: "Priya M.", created_at: new Date(Date.now() - 15*60000).toISOString(), text: "Courts 1-3 are starting to clear out if anyone needs a spot" },
  { id: "m6", user_name: "Tom B.", created_at: new Date(Date.now() - 5*60000).toISOString(), text: "Good games this morning. Court 5 finally freed up" },
];

const PARK = { name: "Marine Park", address: "Fillmore Ave & Marine Pkwy, Brooklyn", totalCourts: 6, hours: "6 AM – 9 PM", surface: "Asphalt", amenities: ["Restrooms","Water Fountain","Benches","Parking Lot"] };

const SCHEDULED = [
  { day: "Mon", time: "6–8 PM", name: "Open Play Night", type: "open" },
  { day: "Wed", time: "6–8 PM", name: "Intermediate Mixer", type: "open" },
  { day: "Thu", time: "9–11 AM", name: "Senior Morning Play", type: "open" },
  { day: "Sat", time: "8 AM–12 PM", name: "Weekend Open Play", type: "open" },
  { day: "Sat", time: "1–4 PM", name: "League Matches", type: "league" },
  { day: "Sun", time: "9 AM–1 PM", name: "Sunday Social", type: "open" },
];

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS_LABELS = ["6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p"];

function getPrediction(dayIdx, hourIdx) {
  const seed = (dayIdx * 17 + hourIdx * 11) % 100;
  const isWeekend = dayIdx === 0 || dayIdx === 6;
  const isMorning = hourIdx >= 2 && hourIdx <= 5;
  const isEvening = hourIdx >= 10 && hourIdx <= 13;
  let base = seed / 100;
  if (isWeekend) base = Math.min(1, base + 0.3);
  if (isMorning) base = Math.min(1, base + 0.25);
  if (isEvening) base = Math.min(1, base + 0.15);
  if (hourIdx <= 1 || hourIdx >= 13) base = Math.max(0, base - 0.25);
  return Math.max(0, Math.min(1, base));
}

function getOcc(v) {
  if (v < 0.3) return { label: "Low", color: "#22c55e", bg: "#f0fdf4", emoji: "🟢" };
  if (v < 0.6) return { label: "Moderate", color: "#ca8a04", bg: "#fefce8", emoji: "🟡" };
  if (v < 0.8) return { label: "Busy", color: "#ea580c", bg: "#fff7ed", emoji: "🟠" };
  return { label: "Packed", color: "#dc2626", bg: "#fef2f2", emoji: "🔴" };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ic = {
  back: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>,
  clock: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  check: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  send: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  home: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>,
  grid: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  feed: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  chat: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  report: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  shield: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  trend: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  cal: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#f5f3ef", card: "#ffffff", primary: "#16704c", primaryDark: "#0f5538", primaryLight: "#d1f2e0", primaryGhost: "#edf8f2",
  text: "#1a1a18", sub: "#5c5c57", muted: "#9c9c96", border: "#e2dfda", borderLight: "#f0ede8",
  green: "#22c55e", yellow: "#ca8a04", orange: "#ea580c", red: "#dc2626",
  blue: "#2563eb", blueBg: "#eff6ff", blueLight: "#dbeafe",
  purple: "#7c3aed", purpleBg: "#f5f3ff", purpleLight: "#ede9fe",
  warm: "#b45309", warmBg: "#fffbeb",
};
const ff = "'Nunito', 'Avenir', -apple-system, sans-serif";
const fd = "'Fraunces', 'Georgia', serif";

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // User identity
  const [userName, setUserName] = useState(() => localStorage.getItem("courtpulse_name") || "");
  const [nameInput, setNameInput] = useState("");

  // App state
  const [tab, setTab] = useState("home");
  const [courts, setCourts] = useState(DEMO_COURTS);
  const [feed, setFeed] = useState(DEMO_FEED);
  const [chatMsgs, setChatMsgs] = useState(DEMO_CHAT);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState(null);
  const [reportCourt, setReportCourt] = useState(null);
  const [reportPaddles, setReportPaddles] = useState(0);
  const [reportStatus, setReportStatus] = useState("in-use");
  const [reportComment, setReportComment] = useState("");
  const [predDay, setPredDay] = useState(new Date().getDay());
  const [feedInput, setFeedInput] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef(null);

  // ─── Supabase Data Loading ────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      if (!isConnected()) {
        setLoading(false);
        return;
      }

      try {
        // Fetch courts
        const { data: courtRows } = await supabase
          .from("courts")
          .select("*")
          .order("court_number");

        if (courtRows?.length) {
          // Fetch latest report for each court
          const courtData = await Promise.all(
            courtRows.map(async (c) => {
              const { data: reports } = await supabase
                .from("reports")
                .select("*")
                .eq("court_id", c.id)
                .order("created_at", { ascending: false })
                .limit(1);
              const latest = reports?.[0];
              return {
                id: c.id,
                label: c.label,
                court_number: c.court_number,
                status: latest?.status || "open",
                paddles_waiting: latest?.paddles_waiting || 0,
                lastReport: latest ? timeAgo(latest.created_at) : "No reports yet",
                reporter: latest?.reporter_name || "—",
              };
            })
          );
          setCourts(courtData);
        }

        // Fetch feed
        const { data: feedRows } = await supabase
          .from("feed_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);
        if (feedRows?.length) setFeed(feedRows);

        // Fetch chat
        const { data: chatRows } = await supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(100);
        if (chatRows?.length) setChatMsgs(chatRows);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // ─── Real-time Subscriptions ──────────────────────────────────────────
  useEffect(() => {
    if (!isConnected()) return;

    const channel = supabase
      .channel("courtpulse-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const r = payload.new;
        setCourts((prev) =>
          prev.map((c) =>
            c.id === r.court_id
              ? { ...c, status: r.status, paddles_waiting: r.paddles_waiting, lastReport: "just now", reporter: r.reporter_name }
              : c
          )
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_posts" }, (payload) => {
        setFeed((prev) => [payload.new, ...prev].slice(0, 30));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        setChatMsgs((prev) => [...prev, payload.new].slice(-100));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (tab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, tab]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(null), 2600); }, []);

  const saveName = useCallback(() => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    localStorage.setItem("courtpulse_name", name);
    setUserName(name);
  }, [nameInput]);

  const submitReport = useCallback(async () => {
    if (!reportCourt) return;
    if (isConnected()) {
      await supabase.from("reports").insert({
        court_id: reportCourt.id,
        park_id: reportCourt.park_id || null,
        status: reportStatus,
        paddles_waiting: reportPaddles,
        comment: reportComment || null,
        reporter_name: userName,
      });
      if (reportComment.trim()) {
        await supabase.from("feed_posts").insert({
          park_id: reportCourt.park_id || null,
          user_name: userName,
          text: reportComment.trim(),
        });
      }
    } else {
      // Local fallback
      setCourts((prev) =>
        prev.map((c) =>
          c.id === reportCourt.id
            ? { ...c, status: reportStatus, paddles_waiting: reportPaddles, lastReport: "just now", reporter: userName || "You" }
            : c
        )
      );
      if (reportComment.trim()) {
        setFeed((prev) => [{ id: Date.now().toString(), user_name: userName || "You", created_at: new Date().toISOString(), text: reportComment.trim() }, ...prev]);
      }
    }
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setReportCourt(null); setReportComment(""); }, 1800);
  }, [reportCourt, reportStatus, reportPaddles, reportComment, userName]);

  const openReport = useCallback((court) => {
    setReportCourt(court);
    setReportPaddles(court.paddles_waiting);
    setReportStatus(court.status);
    setReportComment("");
    setShowSuccess(false);
  }, []);

  const submitFeedComment = useCallback(async () => {
    if (!feedInput.trim()) return;
    if (isConnected()) {
      await supabase.from("feed_posts").insert({ user_name: userName, text: feedInput.trim() });
    } else {
      setFeed((prev) => [{ id: Date.now().toString(), user_name: userName || "You", created_at: new Date().toISOString(), text: feedInput.trim() }, ...prev]);
    }
    setFeedInput("");
    showToast("Comment posted!");
  }, [feedInput, userName, showToast]);

  const submitQuickStatus = useCallback(async (text) => {
    if (isConnected()) {
      await supabase.from("feed_posts").insert({ user_name: userName, text });
    } else {
      setFeed((prev) => [{ id: Date.now().toString(), user_name: userName || "You", created_at: new Date().toISOString(), text }, ...prev]);
    }
    showToast("Status posted!");
  }, [userName, showToast]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    if (isConnected()) {
      await supabase.from("chat_messages").insert({ user_name: userName, text: chatInput.trim() });
    } else {
      setChatMsgs((prev) => [...prev, { id: Date.now().toString(), user_name: userName || "You", created_at: new Date().toISOString(), text: chatInput.trim() }]);
    }
    setChatInput("");
  }, [chatInput, userName]);

  // ─── Computed ─────────────────────────────────────────────────────────
  const inUse = courts.filter((c) => c.status === "in-use").length;
  const totalPaddles = courts.reduce((s, c) => s + c.paddles_waiting, 0);
  const pred = getPrediction(new Date().getDay(), Math.max(0, Math.min(14, new Date().getHours() - 6)));
  const occ = getOcc(pred);
  const livePct = inUse / PARK.totalCourts;
  const liveOcc = getOcc(livePct);
  const agreement = 1 - Math.abs(pred - livePct);
  const agreeLabel = agreement > 0.8 ? "Strong match" : agreement > 0.6 ? "Close" : "Diverging";
  const agreeColor = agreement > 0.8 ? C.green : agreement > 0.6 ? C.yellow : C.orange;
  const heatData = HOURS_LABELS.map((_, hi) => getPrediction(predDay, hi));

  // ─── Styles ───────────────────────────────────────────────────────────
  const s = {
    wrap: { fontFamily: ff, background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", color: C.text, paddingBottom: 90 },
    card: { background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" },
    pill: (on) => ({ background: on ? C.primary : C.card, color: on ? "#fff" : C.sub, border: `1.5px solid ${on ? C.primary : C.border}`, borderRadius: 100, padding: "9px 18px", fontSize: 15, fontWeight: 600, fontFamily: ff, cursor: "pointer", whiteSpace: "nowrap" }),
    badge: (color, bg) => ({ background: bg, color, borderRadius: 100, padding: "5px 14px", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }),
    sec: { padding: "0 20px", marginBottom: 22 },
    h2: { fontSize: 19, fontWeight: 700, fontFamily: fd, marginBottom: 14 },
    btn: (bg, color, full) => ({ background: bg, color, border: "none", borderRadius: 16, padding: full ? "18px 24px" : "12px 20px", fontSize: full ? 17 : 15, fontWeight: 700, fontFamily: ff, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: full ? "100%" : "auto" }),
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 28px", zIndex: 40 },
    navBtn: (on) => ({ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: on ? C.primary : C.muted, cursor: "pointer", padding: "6px 10px", fontSize: 11, fontWeight: on ? 700 : 500, fontFamily: ff }),
  };

  const toastEl = toast ? <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "12px 28px", borderRadius: 16, fontSize: 15, fontWeight: 600, fontFamily: ff, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", animation: "fadeDown 0.3s ease", textAlign: "center" }}>{toast}</div> : null;

  // ═══════════════════════════════════════════════════════════════════════
  // NAME ENTRY SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  if (!userName) {
    return (
      <div style={{ ...s.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", minHeight: "100vh" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🏓</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: fd, marginBottom: 8, textAlign: "center" }}>CourtPulse</h1>
        <p style={{ fontSize: 16, color: C.sub, textAlign: "center", marginBottom: 40, lineHeight: 1.6 }}>Live court status, paddle queue, and community chat at Marine Park</p>
        <div style={{ width: "100%", maxWidth: 340 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 8, display: "block" }}>What should we call you?</label>
          <input
            type="text"
            placeholder="Your first name..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
            autoFocus
            style={{ width: "100%", padding: "16px 20px", borderRadius: 16, border: `1.5px solid ${C.border}`, fontSize: 18, fontFamily: ff, color: C.text, background: C.card, marginBottom: 16 }}
          />
          <button onClick={saveName} disabled={!nameInput.trim()} style={{ ...s.btn(nameInput.trim() ? C.primary : C.border, nameInput.trim() ? "#fff" : C.muted, true), borderRadius: 16, fontSize: 18, opacity: nameInput.trim() ? 1 : 0.5 }}>
            Let's Go
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 24, textAlign: "center" }}>Your name is shown on reports and chat messages</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ ...s.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "pop 1s ease infinite" }}>🏓</div>
        <div style={{ fontSize: 16, color: C.sub }}>Loading court status...</div>
      </div>
    );
  }

  // ─── Report Modal ─────────────────────────────────────────────────────
  const reportModal = reportCourt && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "28px 28px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 480, animation: "slideUp 0.3s ease" }}>
        {showSuccess ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ width: 72, height: 72, borderRadius: 99, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", animation: "pop 0.4s ease" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: fd, marginBottom: 8 }}>Report Submitted!</div>
            <div style={{ fontSize: 15, color: C.sub }}>Thanks for keeping Marine Park updated.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: fd, margin: 0 }}>Report {reportCourt.label}</h3>
              <button onClick={() => setReportCourt(null)} style={{ background: C.borderLight, border: "none", borderRadius: 99, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.sub }}>{Ic.x}</button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 10 }}>Court Status</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              <button onClick={() => setReportStatus("in-use")} style={{ ...s.pill(reportStatus === "in-use"), flex: 1, textAlign: "center", padding: "14px 0" }}>🏓 In Use</button>
              <button onClick={() => { setReportStatus("open"); setReportPaddles(0); }} style={{ ...s.pill(reportStatus === "open"), flex: 1, textAlign: "center", padding: "14px 0" }}>✅ Open</button>
            </div>
            {reportStatus === "in-use" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 10 }}>Paddles Waiting</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, marginBottom: 8 }}>
                  <button onClick={() => setReportPaddles(Math.max(0, reportPaddles - 1))} style={{ width: 56, height: 56, borderRadius: 99, border: `2px solid ${C.border}`, background: "#fff", fontSize: 26, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 52, fontWeight: 800, fontFamily: fd, color: C.primary, lineHeight: 1 }}>{reportPaddles}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>paddle{reportPaddles !== 1 ? "s" : ""}</div>
                  </div>
                  <button onClick={() => setReportPaddles(Math.min(20, reportPaddles + 1))} style={{ width: 56, height: 56, borderRadius: 99, border: `2px solid ${C.border}`, background: "#fff", fontSize: 26, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
                  {[0,2,4,6,8].map(n => <button key={n} onClick={() => setReportPaddles(n)} style={{ ...s.pill(reportPaddles === n), minWidth: 42, padding: "8px 12px", fontSize: 14, textAlign: "center" }}>{n}</button>)}
                </div>
                {reportPaddles > 0 && (
                  <div style={{ background: C.warmBg, borderRadius: 14, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.warm, fontWeight: 600 }}>
                    {Ic.clock} ~{reportPaddles * 12} min estimated wait
                  </div>
                )}
              </>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 10 }}>Add a Comment <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span></div>
            <textarea placeholder="What's it looking like? Wind, vibes, skill level..." value={reportComment} onChange={e => setReportComment(e.target.value)} rows={3}
              style={{ width: "100%", padding: 16, borderRadius: 16, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff, color: C.text, background: C.borderLight, marginBottom: 22 }} />
            <button onClick={submitReport} style={{ ...s.btn(C.primary, "#fff", true), fontSize: 18, borderRadius: 18, boxShadow: `0 4px 20px ${C.primary}44` }}>
              {Ic.check} Submit Report
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // HOME
  // ═══════════════════════════════════════════════════════════════════════
  const homeScreen = (
    <>
      <div style={{ padding: "22px 20px 0" }}>
        <div style={{ fontSize: 14, color: C.sub, marginBottom: 2 }}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, {userName}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, fontFamily: fd, letterSpacing: "-0.3px", margin: 0 }}>Marine Park 🏓</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 13, color: C.sub }}>{Ic.pin} {PARK.address}</div>
        {!isConnected() && <div style={{ marginTop: 10, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#92400e", fontWeight: 600 }}>Demo Mode — Connect Supabase to go live</div>}
      </div>

      <div style={{ ...s.sec, marginTop: 20 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 22, padding: "22px 22px 18px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Right Now</div>
              <div style={{ fontSize: 34, fontWeight: 800, fontFamily: fd, lineHeight: 1 }}>{inUse}/{PARK.totalCourts} <span style={{ fontSize: 16, fontWeight: 500, opacity: 0.8 }}>courts in use</span></div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: fd }}>{totalPaddles}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>paddles waiting</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {courts.map(c => (
              <div key={c.id} onClick={() => { setTab("courts"); }} style={{ flex: 1, background: c.status === "open" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 0", textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>C{c.court_number}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{c.status === "open" ? "✅" : c.paddles_waiting}</div>
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{c.status === "open" ? "Open" : c.paddles_waiting === 0 ? "No wait" : `${c.paddles_waiting} pad`}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.sec}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ background: C.blueBg, border: `1px solid ${C.blueLight}`, borderRadius: 18, padding: "16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><span style={{ fontSize: 15 }}>🤖</span><span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>AI Prediction</span></div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fd, color: occ.color }}>{occ.emoji} {occ.label}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>Based on historical patterns</div>
          </div>
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleLight}`, borderRadius: 18, padding: "16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><span style={{ fontSize: 15 }}>👥</span><span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>Player Reports</span></div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fd, color: liveOcc.color }}>{liveOcc.emoji} {liveOcc.label}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>{inUse}/{PARK.totalCourts} courts · {totalPaddles} paddles</div>
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          {Ic.shield}<span style={{ fontSize: 13, fontWeight: 700 }}>Trust</span>
          <div style={{ flex: 1, height: 8, background: C.borderLight, borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${agreement * 100}%`, background: agreeColor, borderRadius: 99 }} /></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: agreeColor }}>{agreeLabel}</span>
        </div>
      </div>

      <div style={s.sec}>
        <div style={{ ...s.card, padding: 20 }}>
          <div style={s.h2}>📊 Predicted Busyness</div>
          <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
            {DAYS.map((d, i) => (
              <button key={d} onClick={() => setPredDay(i)} style={{ flex: 1, background: predDay === i ? C.primary : "transparent", color: predDay === i ? "#fff" : i === new Date().getDay() ? C.primary : C.sub, border: i === new Date().getDay() && predDay !== i ? `2px solid ${C.primary}` : "2px solid transparent", borderRadius: 10, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff, textAlign: "center" }}>{d}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, marginBottom: 6 }}>
            {heatData.map((v, i) => {
              const o = getOcc(v); const nowH = new Date().getHours() - 6; const isNow = predDay === new Date().getDay() && i === Math.max(0, Math.min(14, nowH));
              return (<div key={i} style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                {isNow && <div style={{ position: "absolute", top: -12, fontSize: 8, fontWeight: 800, color: C.primary }}>NOW</div>}
                <div style={{ width: "100%", borderRadius: 5, height: Math.max(5, v * 90), background: isNow ? C.primary : o.color, opacity: isNow ? 1 : 0.6 }} />
              </div>);
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted }}><span>6 AM</span><span>12 PM</span><span>8 PM</span></div>
        </div>
      </div>

      <div style={s.sec}>
        <div style={{ ...s.card, padding: 20 }}>
          <div style={{ ...s.h2, display: "flex", alignItems: "center", gap: 8 }}>{Ic.cal} Weekly Schedule</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SCHEDULED.map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.primaryGhost, borderRadius: 14 }}>
                <div style={{ minWidth: 38, fontWeight: 800, fontSize: 13, color: C.primary, textAlign: "center" }}>{ev.day}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{ev.name}</div><div style={{ fontSize: 13, color: C.sub }}>{ev.time}</div></div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 8, background: ev.type === "league" ? C.purpleLight : C.primaryLight, color: ev.type === "league" ? C.purple : C.primaryDark }}>{ev.type === "league" ? "League" : "Open"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURTS TAB
  // ═══════════════════════════════════════════════════════════════════════
  const courtsScreen = (
    <>
      <div style={{ padding: "22px 20px 0" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: fd, margin: 0 }}>Court Status</h1>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>Tap a court to update its status</div>
      </div>
      <div style={{ ...s.sec, marginTop: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {courts.map((c, i) => {
            const isOpen = c.status === "open"; const waitMin = c.paddles_waiting * 12;
            return (
              <button key={c.id} onClick={() => openReport(c)} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, padding: "18px 18px", cursor: "pointer", textAlign: "left", width: "100%", animation: `fadeUp ${0.12 + i * 0.05}s ease both` }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: isOpen ? C.primaryLight : c.paddles_waiting > 4 ? "#fef2f2" : c.paddles_waiting > 0 ? "#fefce8" : C.primaryGhost, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>C{c.court_number}</div>
                  <div style={{ fontSize: 22 }}>{isOpen ? "✅" : "🏓"}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, fontFamily: fd, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 14, color: isOpen ? C.green : C.sub, fontWeight: 600, marginBottom: 3 }}>
                    {isOpen ? "Open — walk right on" : c.paddles_waiting === 0 ? "In use · no paddles waiting" : `In use · ${c.paddles_waiting} paddle${c.paddles_waiting !== 1 ? "s" : ""} waiting`}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.reporter} · {c.lastReport}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {isOpen ? <div style={s.badge(C.green, "#f0fdf4")}>🟢 Open</div>
                    : c.paddles_waiting === 0 ? <div style={s.badge("#ca8a04", "#fefce8")}>🟡 No wait</div>
                    : <div style={s.badge(c.paddles_waiting > 4 ? C.red : C.orange, c.paddles_waiting > 4 ? "#fef2f2" : "#fff7ed")}>{c.paddles_waiting > 4 ? "🔴" : "🟠"} ~{waitMin}m</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // FEED TAB
  // ═══════════════════════════════════════════════════════════════════════
  const feedScreen = (
    <>
      <div style={{ padding: "22px 20px 0" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: fd, margin: 0 }}>Live Feed</h1>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>What players are saying at Marine Park</div>
      </div>
      <div style={{ ...s.sec, marginTop: 18 }}>
        <div style={{ ...s.card, padding: 16 }}>
          <textarea placeholder="How are the courts looking? Share conditions, wait times, or tips..." value={feedInput} onChange={e => setFeedInput(e.target.value)} rows={3}
            style={{ width: "100%", padding: 14, borderRadius: 14, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff, color: C.text, background: C.borderLight, marginBottom: 12 }} />
          <button onClick={submitFeedComment} disabled={!feedInput.trim()} style={{ ...s.btn(feedInput.trim() ? C.primary : C.border, feedInput.trim() ? "#fff" : C.muted, true), borderRadius: 14, fontSize: 16, opacity: feedInput.trim() ? 1 : 0.5 }}>Post Update</button>
        </div>
      </div>
      <div style={s.sec}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 10 }}>Quick Status</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "🟢 Courts Open", bg: "#f0fdf4", br: "#bbf7d0", c: "#16a34a", t: "Courts are open, not much wait!" },
            { l: "🟡 Moderate", bg: "#fefce8", br: "#fef08a", c: "#ca8a04", t: "Moderate activity, some courts available." },
            { l: "🟠 Getting Busy", bg: "#fff7ed", br: "#fed7aa", c: "#ea580c", t: "Getting busy, paddles are stacking up." },
            { l: "🔴 Packed", bg: "#fef2f2", br: "#fecaca", c: "#dc2626", t: "Packed — long waits at most courts." },
          ].map(o => (
            <button key={o.l} onClick={() => submitQuickStatus(o.t)} style={{ background: o.bg, border: `2px solid ${o.br}`, borderRadius: 16, padding: "15px 12px", fontSize: 15, fontWeight: 700, color: o.c, cursor: "pointer", fontFamily: ff, textAlign: "center" }}>{o.l}</button>
          ))}
        </div>
      </div>
      <div style={s.sec}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {feed.map((r, i) => (
            <div key={r.id} style={{ ...s.card, padding: "16px 18px", animation: `fadeUp ${0.1 + i * 0.04}s ease both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 99, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: C.primary }}>{(r.user_name || "?")[0]}</div>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{r.user_name}</span>
                </div>
                <span style={{ fontSize: 12, color: C.muted }}>{timeAgo(r.created_at)}</span>
              </div>
              <div style={{ fontSize: 15, color: C.text, lineHeight: 1.55, paddingLeft: 46 }}>{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CHAT TAB
  // ═══════════════════════════════════════════════════════════════════════
  const chatScreen = (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <div style={{ padding: "22px 20px 12px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: fd, margin: 0 }}>Marine Park Chat 💬</h1>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{chatMsgs.length} messages</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {chatMsgs.map(m => {
          const isSelf = m.user_name === userName;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isSelf ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%" }}>
                {!isSelf && <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 4, paddingLeft: 4 }}>{m.user_name}</div>}
                <div style={{ background: isSelf ? C.primary : C.card, color: isSelf ? "#fff" : C.text, borderRadius: isSelf ? "20px 20px 6px 20px" : "20px 20px 20px 6px", padding: "12px 18px", fontSize: 15, lineHeight: 1.5, fontFamily: ff, border: isSelf ? "none" : `1px solid ${C.border}`, boxShadow: isSelf ? `0 2px 12px ${C.primary}33` : "none" }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: isSelf ? "right" : "left", padding: "0 4px" }}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 10 }}>
        <input type="text" placeholder="Message Marine Park..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
          style={{ flex: 1, padding: "14px 18px", borderRadius: 20, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff, color: C.text, background: C.card }} />
        <button onClick={sendChat} disabled={!chatInput.trim()}
          style={{ width: 50, height: 50, borderRadius: 99, background: chatInput.trim() ? C.primary : C.border, border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: chatInput.trim() ? "#fff" : C.muted, flexShrink: 0 }}>
          {Ic.send}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={s.wrap}>
      {toastEl}
      {reportModal}
      {tab === "home" && homeScreen}
      {tab === "courts" && courtsScreen}
      {tab === "feed" && feedScreen}
      {tab === "chat" && chatScreen}

      <div style={s.nav}>
        <button onClick={() => setTab("home")} style={s.navBtn(tab === "home")}>{Ic.home}<span>Home</span></button>
        <button onClick={() => setTab("courts")} style={s.navBtn(tab === "courts")}>{Ic.grid}<span>Courts</span></button>
        <button onClick={() => setTab("courts")} style={s.navBtn(false)}>
          <div style={{ background: C.primary, width: 52, height: 52, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginTop: -22, boxShadow: `0 4px 20px ${C.primary}55` }}>{Ic.report}</div>
          <span style={{ color: C.primary, fontWeight: 700 }}>Report</span>
        </button>
        <button onClick={() => setTab("feed")} style={s.navBtn(tab === "feed")}>{Ic.feed}<span>Feed</span></button>
        <button onClick={() => setTab("chat")} style={s.navBtn(tab === "chat")}>{Ic.chat}<span>Chat</span></button>
      </div>
    </div>
  );
}
