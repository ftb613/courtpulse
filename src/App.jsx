import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design Tokens ───
const C = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  text: "#1B2028",
  sub: "#5A6270",
  muted: "#8E95A2",
  border: "#E2E5EB",
  primary: "#2B6CB0",
  primaryLight: "#EBF2FA",
  primaryDark: "#1A4A7A",
  green: "#27AE60",
  greenLight: "#E8F8EF",
  yellow: "#E2A612",
  yellowLight: "#FFF8E1",
  orange: "#E67E22",
  orangeLight: "#FFF0E0",
  red: "#E74C3C",
  redLight: "#FDECEB",
  chatSelf: "#2B6CB0",
  chatOther: "#FFFFFF",
  banner: "#1A3A5C",
};

const ff = "'DM Sans', 'Avenir', -apple-system, sans-serif";

// ─── Park Info ───
const PARK = {
  name: "Marine Park",
  address: "1925 E 32nd St, Brooklyn, NY 11234",
  hours: "9:00 AM – 8:00 PM",
  mapsUrl: "https://maps.google.com/?q=Marine+Park+Pickleball+Courts+Brooklyn+NY",
};

const WEATHER = { temp: 68, icon: "sun", wind: "8 mph" };

// ─── Weekly Forecast ───
const WEEKLY_FORECAST = [
  { day: "Today", high: 68, low: 54, wind: 8, rain: 10, icon: "sun" },
  { day: "Wed", high: 72, low: 56, wind: 6, rain: 5, icon: "sun" },
  { day: "Thu", high: 65, low: 50, wind: 14, rain: 40, icon: "cloud" },
  { day: "Fri", high: 60, low: 48, wind: 18, rain: 70, icon: "rain" },
  { day: "Sat", high: 63, low: 49, wind: 10, rain: 30, icon: "partcloud" },
  { day: "Sun", high: 70, low: 55, wind: 7, rain: 10, icon: "sun" },
  { day: "Mon", high: 74, low: 58, wind: 5, rain: 5, icon: "sun" },
];

// ─── Court Data (FIXED: 1,5=beginner left, 4,8=challenge right, rest=regular) ───
const COURT_TYPES = {
  beginner: { label: "Beginner", sub: "4 on / 4 off", color: "#6C63FF" },
  regular: { label: "Regular", sub: "4 on / 4 off", color: C.primary },
  challenge: { label: "Challenge", sub: "2 on / 2 off · Winners stay", color: "#D4540E" },
};

const INIT_COURTS = [
  { id: 1, type: "beginner", stacks: 0, conditions: [], lastReport: null, reporter: null },
  { id: 2, type: "regular", stacks: 0, conditions: [], lastReport: null, reporter: null },
  { id: 3, type: "regular", stacks: 1, conditions: [], lastReport: "3m ago", reporter: "Sarah K." },
  { id: 4, type: "challenge", stacks: 2, conditions: [], lastReport: "1m ago", reporter: "Dave R." },
  { id: 5, type: "beginner", stacks: 0, conditions: [], lastReport: null, reporter: null },
  { id: 6, type: "regular", stacks: 1.5, conditions: ["windy"], lastReport: "8m ago", reporter: "Lisa M." },
  { id: 7, type: "regular", stacks: 0, conditions: [], lastReport: null, reporter: null },
  { id: 8, type: "challenge", stacks: 0.5, conditions: [], lastReport: "12m ago", reporter: "Mike T." },
];

// ─── Demo Data ───
const INIT_REPORTS = [
  { id: 1, court: 4, stacks: 2, conditions: [], user: "Dave R.", time: "10:41 AM", text: "" },
  { id: 2, court: 8, stacks: 0.5, conditions: [], user: "Mike T.", time: "10:39 AM", text: "" },
  { id: 3, court: 3, stacks: 1, conditions: [], user: "Sarah K.", time: "10:38 AM", text: "" },
  { id: 4, court: 6, stacks: 1.5, conditions: ["windy"], user: "Lisa M.", time: "10:33 AM", text: "Wind picking up on this side" },
];

const INIT_MAIN_CHAT = [
  { id: 1, name: "Mike T.", text: "Courts looking good this morning, just got here", time: "10:23 AM", self: false, flagged: false, deleted: false },
  { id: 2, name: "Sarah K.", text: "Heading over in 20, anyone want to play doubles?", time: "10:31 AM", self: false, flagged: false, deleted: false },
  { id: 3, name: "You", text: "I'm down! Be there in 15", time: "10:33 AM", self: true, flagged: false, deleted: false },
  { id: 4, name: "Dave R.", text: "Court 3 is running competitive games rn, heads up", time: "10:40 AM", self: false, flagged: false, deleted: false },
  { id: 5, name: "Lisa M.", text: "Court 6 area is getting windy", time: "10:45 AM", self: false, flagged: false, deleted: false },
];

const makeCourtChat = (id) => [
  { id: 1, name: "Player", text: `Anyone at court ${id}?`, time: "10:15 AM", self: false, flagged: false, deleted: false },
];

// ─── AI Prediction Data (placeholder) ───
const PREDICTED_TIMES = {
  Sun: [0,0,1,2,3,3,3,3,2,2,1],
  Mon: [0,0,1,1,2,2,3,2,1,1,0],
  Tue: [0,0,1,2,2,3,3,2,1,1,0],
  Wed: [0,1,1,2,3,3,3,2,2,1,0],
  Thu: [0,0,1,1,2,3,3,2,1,1,0],
  Fri: [0,1,1,2,2,2,2,1,1,0,0],
  Sat: [1,2,3,3,3,3,3,3,2,2,1],
};
const TIME_LABELS = ["9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p"];

const CONDITIONS = [
  { key: "windy", label: "Windy" },
  { key: "wet", label: "Wet Courts" },
  { key: "hot", label: "Hot" },
  { key: "great", label: "Great Conditions" },
];

// ─── Icons ───
const Icons = {
  Home: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1V10"/></svg>,
  Chat: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Report: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Plus: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Sun: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>,
  Cloud: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  Rain: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 13V4a2 2 0 00-4 0"/><path d="M8 13V7a2 2 0 014 0"/><path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="16" y1="19" x2="16" y2="21"/></svg>,
  PartCloud: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.9 4.2A5.5 5.5 0 0121 8.5 3.5 3.5 0 0119.5 15H6a4 4 0 01-.8-7.9"/><circle cx="7" cy="6" r="3" fill="currentColor" opacity="0.3"/></svg>,
  Pin: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Send: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  Back: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Mail: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>,
  Clock: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Dots: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>,
  Trash: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Flag: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  ChevronDown: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Wind: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>,
  Drop: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>,
};

const WeatherIcon = ({ type, size = 18 }) => {
  if (type === "sun") return Icons.Sun(size);
  if (type === "cloud") return Icons.Cloud(size);
  if (type === "rain") return Icons.Rain(size);
  if (type === "partcloud") return Icons.PartCloud(size);
  return Icons.Sun(size);
};

const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap');
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes fadeDown { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }
  `}</style>
);

// ─── Helpers ───
const getStackColor = (stacks) => {
  if (stacks === 0) return { bg: C.greenLight, color: C.green, label: "Empty" };
  if (stacks <= 1) return { bg: C.yellowLight, color: C.yellow, label: stacks === 0.5 ? "½ Stack" : "1 Stack" };
  if (stacks <= 2) return { bg: C.orangeLight, color: C.orange, label: `${stacks % 1 === 0.5 ? stacks : stacks} Stacks` };
  return { bg: C.redLight, color: C.red, label: `${stacks % 1 === 0.5 ? stacks : stacks}+ Stacks` };
};

// v2-style court colors (fill + stroke)
const COURT_COLOR = (stacks) => {
  if (stacks === 0) return { fill: "#27AE6044", stroke: "#27AE60" };
  if (stacks <= 1) return { fill: "#E2A61244", stroke: "#E2A612" };
  if (stacks <= 2) return { fill: "#E67E2244", stroke: "#E67E22" };
  return { fill: "#E74C3C44", stroke: "#E74C3C" };
};

const formatStacks = (n) => {
  if (n === 0) return "0";
  return n.toString();
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function CourtPulse() {
  // ─── Auth State ───
  const [userName, setUserName] = useState(() => { try { return localStorage.getItem("courtpulse_name") || ""; } catch { return ""; } });
  const [nameInput, setNameInput] = useState("");
  const [contactInput, setContactInput] = useState("");

  // ─── App State ───
  const [tab, setTab] = useState("home");
  const [courts, setCourts] = useState(INIT_COURTS);
  const [reports, setReports] = useState(INIT_REPORTS);
  const [mainChat, setMainChat] = useState(INIT_MAIN_CHAT);
  const [courtChats, setCourtChats] = useState(() => {
    const obj = {};
    INIT_COURTS.forEach(c => { obj[c.id] = makeCourtChat(c.id); });
    return obj;
  });
  const [chatInput, setChatInput] = useState("");
  const [courtChatInput, setCourtChatInput] = useState("");

  // ─── UI State ───
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [showCourtReport, setShowCourtReport] = useState(false);
  const [reportStacks, setReportStacks] = useState(0);
  const [reportConditions, setReportConditions] = useState([]);
  const [reportText, setReportText] = useState("");
  const [parkReportLevel, setParkReportLevel] = useState(null);
  const [parkReportConditions, setParkReportConditions] = useState([]);
  const [parkReportText, setParkReportText] = useState("");
  const [toast, setToast] = useState(null);
  const [flagConfirm, setFlagConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // { msgId, chatType }
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Typing indicator simulation
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const chatEndRef = useRef(null);
  const courtChatEndRef = useRef(null);
  const chatScrollRef = useRef(null);

  // ─── Effects ───
  useEffect(() => {
    if (tab === "chat" && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [tab, mainChat]);

  useEffect(() => {
    if (selectedCourt && courtChatEndRef.current) courtChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [selectedCourt, courtChats]);

  // Simulate typing indicator when user sends a message (demo: someone types back after 2s)
  useEffect(() => {
    if (mainChat.length > 5 && mainChat[mainChat.length - 1]?.self) {
      const t1 = setTimeout(() => setSomeoneTyping(true), 2000);
      const t2 = setTimeout(() => {
        setSomeoneTyping(false);
        // Simulate a response
        const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        setMainChat(p => [...p, { id: Date.now(), name: "Mike T.", text: "Nice, see you there!", time, self: false, flagged: false, deleted: false }]);
      }, 4500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [mainChat.length]);

  // Scroll detection for scroll-to-bottom button
  const handleChatScroll = useCallback((e) => {
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ─── Auth ───
  const handleJoin = () => {
    if (!nameInput.trim()) return;
    try { localStorage.setItem("courtpulse_name", nameInput.trim()); } catch {}
    try { if (contactInput.trim()) localStorage.setItem("courtpulse_contact", contactInput.trim()); } catch {}
    setUserName(nameInput.trim());
  };

  // ─── Chat ───
  const sendMainChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMainChat(p => [...p, { id: Date.now(), name: "You", text: chatInput.trim(), time, self: true, flagged: false, deleted: false }]);
    setChatInput("");
  }, [chatInput]);

  const sendCourtChat = useCallback(() => {
    if (!courtChatInput.trim() || !selectedCourt) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setCourtChats(p => ({
      ...p,
      [selectedCourt]: [...(p[selectedCourt] || []), { id: Date.now(), name: "You", text: courtChatInput.trim(), time, self: true, flagged: false, deleted: false }]
    }));
    setCourtChatInput("");
  }, [courtChatInput, selectedCourt]);

  // ─── Flag Message ───
  const handleFlag = (msgId, chatType) => {
    setFlagConfirm({ msgId, chatType });
    setOpenMenu(null);
  };

  const confirmFlag = () => {
    if (!flagConfirm) return;
    const { msgId, chatType } = flagConfirm;
    if (chatType === "main") {
      setMainChat(p => p.map(m => m.id === msgId ? { ...m, flagged: true } : m));
    } else {
      setCourtChats(p => ({
        ...p,
        [chatType]: (p[chatType] || []).map(m => m.id === msgId ? { ...m, flagged: true } : m)
      }));
    }
    setFlagConfirm(null);
    showToast("Message reported. Thank you.");
  };

  // ─── Delete Message (for everyone) ───
  const handleDelete = (msgId, chatType) => {
    setDeleteConfirm({ msgId, chatType });
    setOpenMenu(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { msgId, chatType } = deleteConfirm;
    if (chatType === "main") {
      setMainChat(p => p.map(m => m.id === msgId ? { ...m, deleted: true, text: "" } : m));
    } else {
      setCourtChats(p => ({
        ...p,
        [chatType]: (p[chatType] || []).map(m => m.id === msgId ? { ...m, deleted: true, text: "" } : m)
      }));
    }
    setDeleteConfirm(null);
    showToast("Message deleted.");
  };

  // ─── Court Report ───
  const submitCourtReport = useCallback(() => {
    if (reportStacks === null || !selectedCourt) return;
    setCourts(p => p.map(c => c.id === selectedCourt
      ? { ...c, stacks: reportStacks, conditions: reportConditions, lastReport: "Just now", reporter: "You" }
      : c
    ));
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setReports(p => [{ id: Date.now(), court: selectedCourt, stacks: reportStacks, conditions: reportConditions, user: "You", time, text: reportText }, ...p]);
    setShowCourtReport(false);
    setReportStacks(0);
    setReportConditions([]);
    setReportText("");
    showToast("Report submitted!");
  }, [reportStacks, reportConditions, reportText, selectedCourt]);

  // ─── Park-Level Report ───
  const submitParkReport = useCallback(() => {
    if (parkReportLevel === null) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setReports(p => [{ id: Date.now(), court: null, stacks: null, conditions: parkReportConditions, user: "You", time, text: parkReportText || `Overall: ${["Empty","Half Playing","All Playing","1 Stack / Half","1 Stack / All","2+ Stacks"][parkReportLevel]}`, level: parkReportLevel }, ...p]);
    setParkReportLevel(null);
    setParkReportConditions([]);
    setParkReportText("");
    showToast("Report submitted!");
  }, [parkReportLevel, parkReportConditions, parkReportText]);

  // Close menu on outside tap
  useEffect(() => {
    if (openMenu) {
      const handler = () => setOpenMenu(null);
      const t = setTimeout(() => document.addEventListener("click", handler, { once: true }), 10);
      return () => { clearTimeout(t); document.removeEventListener("click", handler); };
    }
  }, [openMenu]);

  // ─── Last Report Time ───
  const lastReportTime = reports.length > 0 ? reports[0].time : null;
  const lastReportUser = reports.length > 0 ? reports[0].user : null;

  // ─── Styles ───
  const s = {
    wrap: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: ff, position: "relative", overflow: "hidden" },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 100 },
    navBtn: (active) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 12px", color: active ? C.primary : C.muted, position: "relative", fontFamily: ff }),
    section: { padding: "0 16px", marginBottom: 16 },
    card: { background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12 },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SIGN-UP SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  if (!userName) {
    return (
      <div style={{ ...s.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: `linear-gradient(180deg, ${C.banner} 0%, #264D73 40%, ${C.bg} 100%)`, minHeight: "100vh" }}>
        <FontLoader />
        <style>{`input::placeholder { color: rgba(255,255,255,0.4) !important; }`}</style>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "1px solid rgba(255,255,255,0.2)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" fill="#27AE60" opacity="0.9"/>
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeDasharray="3,3"/>
            <circle cx="12" cy="12" r="2" fill="white"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>CourtPulse</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4, marginBottom: 40, fontWeight: 500 }}>Real-time court status for Marine Park</p>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name" onKeyDown={e => e.key === "Enter" && handleJoin()}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, fontFamily: ff, marginBottom: 10, boxSizing: "border-box" }} />
          <input value={contactInput} onChange={e => setContactInput(e.target.value)} placeholder="Phone or email (optional)"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, fontFamily: ff, marginBottom: 20, boxSizing: "border-box" }} />
          <button onClick={handleJoin} style={{ width: "100%", padding: "15px", borderRadius: 12, background: C.green, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: ff, cursor: "pointer" }}>
            Join Marine Park
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BANNER
  // ═══════════════════════════════════════════════════════════════════════
  const banner = (
    <div style={{ background: `linear-gradient(135deg, ${C.banner} 0%, #264D73 100%)`, padding: "14px 18px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="6" fill="#27AE60" opacity="0.9"/>
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeDasharray="3,3"/>
              <circle cx="12" cy="12" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.1 }}>CourtPulse</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, fontFamily: ff, letterSpacing: "0.5px", marginTop: 1 }}>MARINE PARK</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", padding: "5px 10px", borderRadius: 8 }}>
            <span style={{ color: "#F0C040" }}>{Icons.Sun(14)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{WEATHER.temp}°</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.1)", padding: "5px 10px", borderRadius: 8 }}>
            {Icons.Clock(12)}
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{PARK.hours}</span>
          </div>
        </div>
      </div>
      <a href={PARK.mapsUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, textDecoration: "none" }}>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{Icons.Pin(12)}</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", textDecoration: "underline", textUnderlineOffset: 2, fontFamily: ff, fontWeight: 500 }}>
          {PARK.address}
        </span>
      </a>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURT MAP (v2 style — filled color rects with stroke)
  // ═══════════════════════════════════════════════════════════════════════
  const courtMap = (() => {
    const w = 380, h = 250, cW = 76, cH = 82, gap = 10;
    const startX = (w - (cW * 4 + gap * 3)) / 2;
    const topY = 22;
    const botY = topY + cH + 30;

    const positions = [
      { id: 1, row: 0, col: 0 }, { id: 2, row: 0, col: 1 }, { id: 3, row: 0, col: 2 }, { id: 4, row: 0, col: 3 },
      { id: 5, row: 1, col: 0 }, { id: 6, row: 1, col: 1 }, { id: 7, row: 1, col: 2 }, { id: 8, row: 1, col: 3 },
    ];

    return (
      <div style={{ ...s.section, marginTop: 16 }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          <rect x="0" y="0" width={w} height={h} rx="14" fill="#2D5A27" opacity="0.08"/>
          <rect x="4" y="4" width={w-8} height={h-8} rx="12" fill="#3A7233" opacity="0.04"/>

          {/* Net dividers */}
          <line x1={startX-6} y1={topY+cH+15} x2={startX+cW*4+gap*3+6} y2={topY+cH+15} stroke="#5A6270" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.18"/>
          <text x={w/2} y={topY+cH+12} textAnchor="middle" fontSize="7.5" fill="#5A6270" fontFamily={ff} opacity="0.45" fontWeight="600">NET DIVIDERS</text>

          {/* Entrance */}
          <text x={w/2} y={h-5} textAnchor="middle" fontSize="8" fill="#5A6270" fontFamily={ff} opacity="0.45" fontWeight="600">ENTRANCE</text>
          <path d={`M${w/2-18} ${h-13} L${w/2} ${h-9} L${w/2+18} ${h-13}`} stroke="#5A6270" strokeWidth="1" fill="none" opacity="0.2"/>

          {positions.map(pos => {
            const court = courts.find(c => c.id === pos.id);
            const x = startX + pos.col * (cW + gap);
            const y = pos.row === 0 ? topY : botY;
            const cc = COURT_COLOR(court.stacks);
            const hasCond = court.conditions.length > 0;
            const typeLabel = court.type === "beginner" ? "BEGINNER" : court.type === "challenge" ? "CHALLENGE" : null;
            const typeColor = court.type === "beginner" ? "#6C63FF" : court.type === "challenge" ? "#D4540E" : null;

            return (
              <g key={court.id} onClick={() => setSelectedCourt(court.id)} style={{ cursor: "pointer" }}>
                <rect x={x} y={y} width={cW} height={cH} rx="7" fill={cc.fill} stroke={cc.stroke} strokeWidth="2.5"/>
                {/* Inner court lines */}
                <line x1={x+5} y1={y+cH/2} x2={x+cW-5} y2={y+cH/2} stroke={cc.stroke} strokeWidth="0.7" opacity="0.3"/>
                <rect x={x+cW*0.18} y={y+cH*0.18} width={cW*0.64} height={cH*0.64} rx="3" fill="none" stroke={cc.stroke} strokeWidth="0.5" opacity="0.2"/>

                {/* Court number */}
                <text x={x+cW/2} y={y+cH/2+(typeLabel ? 0 : 5)} textAnchor="middle" fontSize="16" fontWeight="800" fill={cc.stroke} fontFamily={ff}>{court.id}</text>

                {/* Court type label for beginner/challenge */}
                {typeLabel && (
                  <g>
                    <rect x={x+8} y={y+cH/2+7} width={cW-16} height={15} rx="4" fill={typeColor} opacity="0.15"/>
                    <text x={x+cW/2} y={y+cH/2+18} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={typeColor} fontFamily={ff} opacity="0.9">{typeLabel}</text>
                  </g>
                )}

                {/* Condition dot */}
                {hasCond && <circle cx={x+cW-9} cy={y+9} r="4.5" fill={C.yellow} stroke="#fff" strokeWidth="1.5"/>}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { color: "#27AE60", label: "Empty" },
            { color: "#E2A612", label: "≤1 Stack" },
            { color: "#E67E22", label: "2 Stacks" },
            { color: "#E74C3C", label: "3+ Stacks" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, opacity: 0.7 }}/>
              <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Last report timestamp */}
        {lastReportTime && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10, opacity: 0.7 }}>
            <span style={{ color: C.muted }}>{Icons.Clock(11)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>Last report at {lastReportTime} by {lastReportUser}</span>
          </div>
        )}
      </div>
    );
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // WEATHER WIDGET (full week)
  // ═══════════════════════════════════════════════════════════════════════
  const weatherWidget = (
    <div style={{ ...s.section }}>
      <div style={{ ...s.card, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <span style={{ color: "#F0C040" }}>{Icons.Sun(16)}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>7-Day Forecast</span>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {WEEKLY_FORECAST.map((d, i) => (
            <div key={d.day} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "8px 2px", borderRadius: 10,
              background: i === 0 ? C.primaryLight : "transparent",
              border: i === 0 ? `1.5px solid ${C.primary}33` : "1px solid transparent",
            }}>
              <span style={{ fontSize: 10, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? C.primary : C.sub }}>{d.day}</span>
              <span style={{ color: d.icon === "rain" ? C.primary : d.icon === "cloud" ? C.muted : "#F0C040" }}>
                <WeatherIcon type={d.icon} size={18} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{d.high}°</span>
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{d.low}°</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span style={{ color: C.muted }}>{Icons.Wind(8)}</span>
                <span style={{ fontSize: 8, color: C.muted, fontWeight: 500 }}>{d.wind}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span style={{ color: d.rain >= 50 ? C.primary : C.muted }}>{Icons.Drop(8)}</span>
                <span style={{ fontSize: 8, color: d.rain >= 50 ? C.primary : C.muted, fontWeight: d.rain >= 50 ? 700 : 500 }}>{d.rain}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // AI PREDICTION — COMING SOON
  // ═══════════════════════════════════════════════════════════════════════
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today = dayNames[new Date().getDay()];

  const aiPrediction = (
    <div style={{ ...s.section }}>
      <div style={{ ...s.card, position: "relative", overflow: "hidden", padding: 0 }}>
        <div style={{ padding: 16, filter: "blur(3px)", opacity: 0.4, pointerEvents: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>AI Predicted Busyness</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
            {PREDICTED_TIMES[today].map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: Math.max(8, v * 18), borderRadius: 4, background: [C.green, C.yellow, C.orange, C.red][v] }}/>
                <span style={{ fontSize: 8, color: C.muted }}>{TIME_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.7)", borderRadius: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif" }}>Coming Soon</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, textAlign: "center", padding: "0 24px", lineHeight: 1.4 }}>
            AI predictions activate once enough reports come in. Keep reporting to unlock this feature!
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ACTIVE CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════
  const activeConds = courts.filter(c => c.conditions.length > 0);
  const conditionsBar = activeConds.length > 0 ? (
    <div style={{ ...s.section }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {activeConds.map(c => c.conditions.map(cond => (
          <div key={`${c.id}-${cond}`} style={{ display: "flex", alignItems: "center", gap: 6, background: C.yellowLight, border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>Court {c.id}</span>
            <span style={{ fontSize: 12, color: C.sub }}>·</span>
            <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{cond.charAt(0).toUpperCase() + cond.slice(1)}</span>
          </div>
        )))}
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // LATEST REPORTS
  // ═══════════════════════════════════════════════════════════════════════
  const latestReports = (
    <div style={{ ...s.section }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Latest Reports</div>
      {reports.slice(0, 5).map(r => {
        const sc = r.stacks !== null ? getStackColor(r.stacks) : null;
        return (
          <div key={r.id} style={{ ...s.card, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            {sc && (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: sc.color, flexShrink: 0 }}>
                {formatStacks(r.stacks)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {r.court ? `Court ${r.court}` : "Overall"}{r.user && ` · ${r.user}`}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>{r.time}</span>
              </div>
              {r.text && <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{r.text}</div>}
              {r.conditions?.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {r.conditions.map(c => (
                    <span key={c} style={{ fontSize: 10, background: C.yellowLight, color: C.yellow, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // FEEDBACK / CONTACT
  // ═══════════════════════════════════════════════════════════════════════
  const feedbackSection = (
    <div style={{ ...s.section, marginBottom: 100 }}>
      <a href="mailto:courtpulsenyc@gmail.com?subject=CourtPulse%20Feedback" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, textDecoration: "none", cursor: "pointer" }}>
        <span style={{ color: C.muted }}>{Icons.Mail(16)}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Feedback or issue? Contact us</span>
      </a>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // HOME SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  const homeScreen = (
    <div style={{ paddingBottom: 90 }}>
      {banner}
      {courtMap}
      {weatherWidget}
      {aiPrediction}
      {latestReports}
      {feedbackSection}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT TAB (park-level)
  // ═══════════════════════════════════════════════════════════════════════
  const OVERALL_LEVELS = [
    { key: "empty", label: "Empty", desc: "No one playing", color: C.green },
    { key: "half-play", label: "Half Playing", desc: "About half the courts in use", color: C.yellow },
    { key: "all-play", label: "All Playing", desc: "Every court in use, no wait", color: C.orange },
    { key: "1-stack-half", label: "1 Stack / Half", desc: "1 stack waiting at half the courts", color: C.orange },
    { key: "1-stack-all", label: "1 Stack / All", desc: "1 stack waiting at every court", color: C.red },
    { key: "2-stack", label: "2+ Stacks", desc: "2 or more stacks deep", color: C.red },
  ];

  const reportScreen = (
    <div style={{ paddingBottom: 90 }}>
      {banner}
      <div style={{ ...s.section, marginTop: 16 }}>
        <div style={{ ...s.card }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Report Overall Status</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>How busy is the park right now?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {OVERALL_LEVELS.map((lvl, i) => {
              const selected = parkReportLevel === i;
              return (
                <button key={lvl.key} onClick={() => setParkReportLevel(i)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10,
                  background: selected ? lvl.color : `${lvl.color}12`,
                  border: selected ? `2px solid ${lvl.color}` : `1px solid ${lvl.color}40`,
                  borderLeft: `4px solid ${lvl.color}`,
                  color: selected ? "#fff" : C.text,
                  cursor: "pointer", fontFamily: ff, textAlign: "left",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: selected ? "#fff" : C.text }}>{lvl.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 1, color: selected ? "rgba(255,255,255,0.85)" : C.sub }}>{lvl.desc}</div>
                  </div>
                  {selected && <div style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>✓</div>}
                  {!selected && <div style={{ width: 10, height: 10, borderRadius: 5, background: lvl.color, opacity: 0.5 }}/>}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Conditions</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {CONDITIONS.map(c => {
              const active = parkReportConditions.includes(c.key);
              return (
                <button key={c.key} onClick={() => setParkReportConditions(p => active ? p.filter(x => x !== c.key) : [...p, c.key])} style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: active ? C.primaryLight : C.bg,
                  border: active ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                  color: active ? C.primary : C.sub,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff,
                }}>{c.label}</button>
              );
            })}
          </div>
          <textarea value={parkReportText} onChange={e => setParkReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, marginBottom: 12, boxSizing: "border-box", resize: "none" }}/>
          <button onClick={submitParkReport} disabled={parkReportLevel === null} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: parkReportLevel !== null ? C.primary : C.border,
            border: "none", color: parkReportLevel !== null ? "#fff" : C.muted,
            fontSize: 15, fontWeight: 700, cursor: parkReportLevel !== null ? "pointer" : "default", fontFamily: ff,
          }}>Submit Report</button>
        </div>
      </div>
      {/* Past reports */}
      <div style={{ ...s.section }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recent Reports</div>
        {reports.slice(0, 8).map(r => {
          const sc = r.stacks !== null ? getStackColor(r.stacks) : null;
          return (
            <div key={r.id} style={{ ...s.card, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              {sc && <div style={{ width: 32, height: 32, borderRadius: 8, background: sc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: sc.color, flexShrink: 0 }}>{formatStacks(r.stacks)}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.court ? `Court ${r.court}` : "Overall"} · {r.user}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{r.time}</span>
                </div>
                {r.text && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{r.text}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CHAT BUBBLE (with 3-dot menu)
  // ═══════════════════════════════════════════════════════════════════════
  const chatBubble = (msg, chatType) => {
    const isMenuOpen = openMenu?.msgId === msg.id && openMenu?.chatType === chatType;

    // Deleted message placeholder (WhatsApp-style)
    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
          <div style={{ maxWidth: "78%" }}>
            {!msg.self && <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>{msg.name}</div>}
            <div style={{ padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.self ? "rgba(43,108,176,0.15)" : "#f0f0f0", border: `1px solid ${C.border}` }}>
              <span style={{ fontStyle: "italic", fontSize: 13, color: C.muted }}>
                🚫 This message was deleted
              </span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: msg.self ? "right" : "left", paddingLeft: 4, paddingRight: 4 }}>{msg.time}</div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
        <div style={{ maxWidth: "78%", position: "relative" }}>
          {!msg.self && <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>{msg.name}</div>}
          <div style={{ display: "flex", alignItems: msg.self ? "flex-start" : "flex-start", flexDirection: msg.self ? "row-reverse" : "row", gap: 2 }}>
            <div style={{
              padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.self ? C.chatSelf : C.chatOther,
              color: msg.self ? "#fff" : C.text,
              fontSize: 14, lineHeight: 1.4,
              border: msg.self ? "none" : `1px solid ${C.border}`,
            }}>
              {msg.flagged ? <span style={{ fontStyle: "italic", opacity: 0.5 }}>This message has been reported</span> : msg.text}
            </div>

            {/* 3-dot menu button */}
            {!msg.flagged && (
              <div style={{ position: "relative", flexShrink: 0, alignSelf: "center" }}>
                <button onClick={(e) => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : { msgId: msg.id, chatType }); }}
                  style={{ width: 24, height: 24, borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, opacity: 0.4 }}>
                  {Icons.Dots(14)}
                </button>

                {/* Dropdown menu */}
                {isMenuOpen && (
                  <div style={{
                    position: "absolute", top: 28, [msg.self ? "right" : "left"]: 0,
                    background: C.card, borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    border: `1px solid ${C.border}`, overflow: "hidden", zIndex: 50,
                    minWidth: 160, animation: "fadeIn 0.15s ease",
                  }}>
                    {msg.self ? (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id, chatType); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: ff, fontSize: 13, fontWeight: 600, color: C.red }}>
                        <span>{Icons.Trash(14)}</span>
                        Delete for everyone
                      </button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); handleFlag(msg.id, chatType); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: ff, fontSize: 13, fontWeight: 600, color: C.red }}>
                        <span>{Icons.Flag(14)}</span>
                        Report message
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: msg.self ? "right" : "left", paddingLeft: 4, paddingRight: 4 }}>{msg.time}</div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TYPING INDICATOR
  // ═══════════════════════════════════════════════════════════════════════
  const typingIndicator = someoneTyping ? (
    <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>Mike T.</div>
        <div style={{
          padding: "12px 18px", borderRadius: "16px 16px 16px 4px",
          background: C.chatOther, border: `1px solid ${C.border}`,
          display: "flex", gap: 4, alignItems: "center",
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: "50%", background: C.muted,
              animation: `typingBounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}/>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // CHAT SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  const chatScreen = (
    <div style={{ paddingBottom: 90, display: "flex", flexDirection: "column", height: "100vh" }}>
      {banner}
      <div style={{ padding: "10px 16px 6px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif" }}>Marine Park Chat</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Keep it about pickleball. Be respectful.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", position: "relative" }} onScroll={handleChatScroll} ref={chatScrollRef}>
        {mainChat.map(msg => chatBubble(msg, "main"))}
        {typingIndicator}
        <div ref={chatEndRef}/>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button onClick={scrollToBottom} style={{
            position: "sticky", bottom: 8, left: "50%", transform: "translateX(-50%)",
            width: 36, height: 36, borderRadius: 18,
            background: C.card, border: `1px solid ${C.border}`,
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: C.primary, zIndex: 10,
          }}>
            {Icons.ChevronDown(18)}
          </button>
        )}
      </div>
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "center" }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMainChat()} placeholder="Message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, outline: "none" }}/>
        <button onClick={sendMainChat} style={{ width: 38, height: 38, borderRadius: 19, background: chatInput.trim() ? C.primary : C.border, border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: chatInput.trim() ? "#fff" : C.muted, flexShrink: 0 }}>
          {Icons.Send(18)}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURT DETAIL (tap from map)
  // ═══════════════════════════════════════════════════════════════════════
  const courtDetail = (() => {
    if (!selectedCourt) return null;
    const court = courts.find(c => c.id === selectedCourt);
    const type = COURT_TYPES[court.type];
    const sc = getStackColor(court.stacks);
    const courtMessages = courtChats[selectedCourt] || [];

    const courtReportModal = showCourtReport ? (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: C.card, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", animation: "slideUp 0.25s ease" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Report Court {selectedCourt}</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>{type.label} · {type.sub}</div>

          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Stacks Waiting</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 }}>
            <button onClick={() => setReportStacks(Math.max(0, reportStacks - 1))} style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
              {Icons.Minus(20)}
            </button>
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: sc.color, fontFamily: "'Fraunces', serif" }}>{formatStacks(reportStacks)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: sc.color, marginTop: -2 }}>{getStackColor(reportStacks).label}</div>
            </div>
            <button onClick={() => setReportStacks(reportStacks + 1)} style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
              {Icons.Plus(20)}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => setReportStacks(prev => {
              const hasHalf = prev % 1 === 0.5;
              return hasHalf ? Math.floor(prev) : prev + 0.5;
            })} style={{
              padding: "6px 18px", borderRadius: 8,
              background: reportStacks % 1 === 0.5 ? C.primaryLight : C.bg,
              border: reportStacks % 1 === 0.5 ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
              color: reportStacks % 1 === 0.5 ? C.primary : C.sub,
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff,
            }}>
              {reportStacks % 1 === 0.5 ? "Remove ½" : "+ ½ Stack"}
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Conditions</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {CONDITIONS.map(c => {
              const active = reportConditions.includes(c.key);
              return (
                <button key={c.key} onClick={() => setReportConditions(p => active ? p.filter(x => x !== c.key) : [...p, c.key])} style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: active ? C.primaryLight : C.bg,
                  border: active ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                  color: active ? C.primary : C.sub,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff,
                }}>{c.label}</button>
              );
            })}
          </div>

          <textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, marginBottom: 12, boxSizing: "border-box", resize: "none" }}/>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportText(""); }} style={{ flex: 1, padding: 14, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
            <button onClick={submitCourtReport} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.primary, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Submit</button>
          </div>
        </div>
      </div>
    ) : null;

    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 150, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
        {courtReportModal}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, background: C.card, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setSelectedCourt(null); setShowCourtReport(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
            {Icons.Back(22)}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif" }}>Court {selectedCourt}</div>
            <div style={{ fontSize: 12, color: type.color, fontWeight: 600 }}>{type.label} · {type.sub}</div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 6, background: sc.bg }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        <div style={{ padding: "12px 16px" }}>
          <div style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: sc.color, fontFamily: "'Fraunces', serif" }}>{formatStacks(court.stacks)} {court.stacks === 1 ? "Stack" : "Stacks"}</div>
              {court.lastReport && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Reported {court.lastReport} by {court.reporter}</div>}
            </div>
            <button onClick={() => setShowCourtReport(true)} style={{ padding: "10px 18px", borderRadius: 10, background: C.primary, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>
              Report
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>Court {selectedCourt} Chat</div>
          {courtMessages.map(msg => chatBubble(msg, selectedCourt))}
          <div ref={courtChatEndRef}/>
        </div>

        <div style={{ padding: "8px 16px env(safe-area-inset-bottom, 8px)", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "center" }}>
          <input value={courtChatInput} onChange={e => setCourtChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCourtChat()} placeholder={`Message Court ${selectedCourt}...`} style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, outline: "none" }}/>
          <button onClick={sendCourtChat} style={{ width: 38, height: 38, borderRadius: 19, background: courtChatInput.trim() ? C.primary : C.border, border: "none", cursor: courtChatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: courtChatInput.trim() ? "#fff" : C.muted, flexShrink: 0 }}>
            {Icons.Send(18)}
          </button>
        </div>
      </div>
    );
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // FLAG CONFIRMATION MODAL
  // ═══════════════════════════════════════════════════════════════════════
  const flagModal = flagConfirm ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Report this message?</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 20 }}>
          This message will be flagged for review. Repeated violations may result in a user being muted.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setFlagConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={confirmFlag} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.red, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Report</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE CONFIRMATION MODAL
  // ═══════════════════════════════════════════════════════════════════════
  const deleteModal = deleteConfirm ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Delete this message?</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 20 }}>
          This message will be deleted for everyone in the chat. This can't be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={confirmDelete} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.red, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Delete</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════
  const toastEl = toast ? (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, zIndex: 500, fontFamily: ff, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "fadeDown 0.25s ease" }}>
      {toast}
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={s.wrap}>
      <FontLoader />
      {toastEl}
      {flagModal}
      {deleteModal}
      {courtDetail}

      {tab === "home" && homeScreen}
      {tab === "report" && reportScreen}
      {tab === "chat" && chatScreen}

      {!selectedCourt && (
        <div style={s.nav}>
          {[
            { key: "home", label: "Home", icon: Icons.Home },
            { key: "report", label: "Report", icon: Icons.Report, accent: true },
            { key: "chat", label: "Chat", icon: Icons.Chat },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={s.navBtn(tab === t.key)}>
              {t.accent ? (
                <div style={{ background: tab === t.key ? C.primary : C.muted, width: 46, height: 46, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginTop: -18, boxShadow: tab === t.key ? `0 4px 16px ${C.primary}44` : "none" }}>
                  {t.icon(22)}
                </div>
              ) : (
                <span style={{ color: tab === t.key ? C.primary : C.muted }}>{t.icon()}</span>
              )}
              <span style={{ fontSize: 11, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.primary : C.muted }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
