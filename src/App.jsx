import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Design Tokens (Brand: dark green + warm cream) ───
const C = {
  bg: "#F4F1EB",
  card: "#FFFFFF",
  text: "#2D3B34",
  sub: "#6B6459",
  muted: "#9A9285",
  border: "#DDD8D0",
  primary: "#2D3B34",
  primaryLight: "#E8ECEA",
  green: "#2EA866",
  greenLight: "#E6F5ED",
  amber: "#D4A832",
  amberLight: "#FBF4E0",
  red: "#C4412A",
  redLight: "#FBEAE7",
  darkRed: "#8B1A1A",
  cream: "#F4F1EB",
  chatSelf: "#2D3B34",
  chatOther: "#FFFFFF",
  banner: "#2D3B34",
  emptyFill: "rgba(212,206,195,0.25)",
  emptyStroke: "#B5AFA6",
};

const ff = "'Figtree', -apple-system, sans-serif";

// ─── Park Info ───
const PARK = {
  name: "Marine Park",
  address: "1925 E 32nd St, Brooklyn, NY 11234",
  hours: "9:00 AM – 8:00 PM",
  mapsUrl: "https://maps.google.com/?q=Marine+Park+Pickleball+Courts+Brooklyn+NY",
};

// ─── Hourly Forecast fallback ───
const HOURLY_FALLBACK = [{ hour: "Now", temp: "--", icon: "sun" }];

// ─── Court Data ───
const COURT_TYPES = {
  beginner: { label: "Beginner", sub: "4 on / 4 off" },
  regular: { label: "Regular", sub: "4 on / 4 off" },
  challenge: { label: "Challenge", sub: "2 on / 2 off · Winners stay" },
};

const INIT_COURTS = [
  { id: 1, type: "beginner", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 2, type: "regular", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 3, type: "regular", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 4, type: "challenge", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 5, type: "beginner", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 6, type: "regular", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 7, type: "regular", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
  { id: 8, type: "challenge", stacks: 0, playing: false, conditions: [], lastReport: null, lastReportAt: null, reporter: null },
];

// ─── Park-level report → court mapping ───
const PARK_LEVEL_MAP = [
  { stacks: 0, playing: false },   // 0 = Empty
  { stacks: 0, playing: true },    // 1 = Half Playing
  { stacks: 0, playing: true },    // 2 = All Playing
  { stacks: 0.5, playing: true },  // 3 = 1 Stack / Half
  { stacks: 1, playing: true },    // 4 = 1 Stack / All
  { stacks: 2, playing: true },    // 5 = 2+ Stacks
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

// ─── Level labels/colors for park-level reports ───
const LEVEL_LABELS = ["Empty","Half Playing","All Playing","1 Stack / Half","1 Stack / All","2+ Stacks"];
const LEVEL_COLORS = [C.muted, C.green, C.green, C.amber, C.amber, C.red];

// ─── Spam protection ───
const SEND_COOLDOWN = 3000;
const MAX_MSG_LENGTH = 1000;
const MAX_STACKS = 15;
const FLAG_THRESHOLD = 3;

// ─── Freshness windows (ms) — tighter windows, trust decays fast ───
const getFreshnessMs = (stacks) => {
  if (stacks <= 0) return 10 * 60 * 1000;    // 10 min
  if (stacks <= 1) return 20 * 60 * 1000;    // 20 min
  if (stacks <= 2) return 30 * 60 * 1000;    // 30 min
  if (stacks <= 3) return 40 * 60 * 1000;    // 40 min
  if (stacks <= 4) return 45 * 60 * 1000;    // 45 min
  return 50 * 60 * 1000;                      // 50 min for 5+
};

// ─── 8am reset helper ───
const getToday8am = () => {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d.getTime();
};

// ─── Icons (all stroke-width 2) ───
const Icons = {
  Home: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1V10"/></svg>,
  Chat: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Update: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Plus: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Sun: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>,
  Cloud: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  Rain: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 13V4a2 2 0 00-4 0"/><path d="M8 13V7a2 2 0 014 0"/><path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="16" y1="19" x2="16" y2="21"/></svg>,
  PartCloud: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.9 4.2A5.5 5.5 0 0121 8.5 3.5 3.5 0 0119.5 15H6a4 4 0 01-.8-7.9"/><circle cx="7" cy="6" r="3" fill="currentColor" opacity="0.3"/></svg>,
  Pin: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Send: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  Back: (s=22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Mail: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>,
  Clock: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Dots: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>,
  Trash: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Flag: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  ChevronDown: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Wind: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>,
  Drop: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>,
};

// ─── 2x3 Logo Mark ───
const LogoMark = ({ size = 32, color = C.cream }) => (
  <svg width={size} height={size} viewBox="0 0 24 28">
    {[0,1,2].map(row => [0,1].map(col => (
      <rect key={`${row}-${col}`} x={col * 13} y={row * 10} width={11} height={8} rx="2" fill={color}/>
    )))}
  </svg>
);

const WeatherIcon = ({ type, size = 18 }) => {
  if (type === "sun") return Icons.Sun(size);
  if (type === "cloud") return Icons.Cloud(size);
  if (type === "rain") return Icons.Rain(size);
  if (type === "partcloud") return Icons.PartCloud(size);
  return Icons.Sun(size);
};

const FontLoader = () => {
  useEffect(() => {
    if (!document.getElementById("courtpulse-fonts")) {
      const link = document.createElement("link");
      link.id = "courtpulse-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  return (
    <style>{`
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes fadeDown { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }
    @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 0.7; } 100% { opacity: 0.4; } }
    @keyframes courtPulse { 0% { filter: brightness(1); } 50% { filter: brightness(1.3); } 100% { filter: brightness(1); } }
    textarea { font-family: inherit; }
    * { -webkit-tap-highlight-color: transparent; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `}</style>
  );
};

// ─── Linkify: auto-detect URLs and make them tappable ───
const Linkify = ({ text, color = C.primary }) => {
  const urlPattern = /(https?:\/\/[^\s]+|(?:www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.(?:com|org|net|io|co|app|dev|me|info|edu|gov)(?:\/[^\s]*)?))/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), isLink: false });
    parts.push({ text: match[0], isLink: true });
    last = urlPattern.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isLink: false });
  if (parts.length === 0) return <span>{text}</span>;
  return parts.map((p, i) => {
    if (p.isLink) {
      const href = /^https?:\/\//.test(p.text) ? p.text : `https://${p.text}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          style={{ color, textDecoration: "underline", wordBreak: "break-all" }}
          onClick={e => e.stopPropagation()}>{p.text}</a>
      );
    }
    return <span key={i}>{p.text}</span>;
  });
};

// ─── Status display helpers (3-color system) ───
const getStackColor = (stacks, playing = false) => {
  if (!playing && stacks === 0) return { bg: C.cream, color: C.muted, label: "No Reports" };
  if (stacks === 0) return { bg: C.greenLight, color: C.green, label: "Playing" };
  if (stacks <= 1) return { bg: C.amberLight, color: C.amber, label: stacks === 0.5 ? "½ Stack" : "1 Stack" };
  return { bg: C.redLight, color: C.red, label: `${stacks % 1 === 0.5 ? stacks : Math.floor(stacks)} Stacks` };
};

const COURT_COLOR = (stacks, playing = false) => {
  if (!playing && stacks === 0) return { fill: C.emptyFill, stroke: C.emptyStroke };
  if (stacks === 0) return { fill: "#2EA86622", stroke: "#2EA866" };
  if (stacks <= 1) return { fill: "#D4A83222", stroke: "#D4A832" };
  return { fill: "#C4412A22", stroke: "#C4412A" };
};

const formatStacks = (n) => {
  if (n === 0) return "0";
  return n.toString();
};

const weatherCodeToIcon = (code) => {
  if (code <= 1) return "sun";
  if (code === 2) return "partcloud";
  if (code === 3 || code === 45 || code === 48) return "cloud";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (code >= 71 && code <= 77) return "cloud";
  return "sun";
};

const weatherCodeToText = (code) => {
  if (code === 0) return "Clear skies";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rainy";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Clear";
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
  const [reports, setReports] = useState([]);
  const [mainChat, setMainChat] = useState([]);
  const [courtChats, setCourtChats] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [courtChatInput, setCourtChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);

  // ─── Park Report Tracking (for derived display) ───
  const [parkReportAt, setParkReportAt] = useState(null);
  const [parkReportUser, setParkReportUser] = useState(null);
  const [latestParkLevel, setLatestParkLevel] = useState(null);

  // ─── Decay tick (forces re-render every 5 min for freshness re-evaluation) ───
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Weather State ───
  const [hourlyWeather, setHourlyWeather] = useState(HOURLY_FALLBACK);
  const [currentTemp, setCurrentTemp] = useState(null);
  const [currentWeatherIcon, setCurrentWeatherIcon] = useState("sun");
  const [currentWind, setCurrentWind] = useState(null);
  const [currentConditionText, setCurrentConditionText] = useState("");
  const [dailyHigh, setDailyHigh] = useState(null);
  const [dailyLow, setDailyLow] = useState(null);

  // ─── Fetch live weather ───
  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=40.6128&longitude=-73.9244&hourly=temperature_2m,weather_code,windspeed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/New_York&forecast_days=1")
      .then(r => r.json())
      .then(data => {
        const now = new Date();
        const currentHour = now.getHours();
        const hourly = data.hourly;
        if (!hourly?.time) return;
        const mapped = [];
        for (let i = 0; i < hourly.time.length; i++) {
          const h = new Date(hourly.time[i]).getHours();
          if (h < 9 || h > 20) continue;
          const icon = weatherCodeToIcon(hourly.weather_code[i]);
          let label;
          if (h === currentHour) label = "Now";
          else if (h < 12) label = `${h}a`;
          else if (h === 12) label = "12p";
          else label = `${h - 12}p`;
          mapped.push({ hour: label, temp: Math.round(hourly.temperature_2m[i]), icon });
        }
        if (mapped.length > 0) {
          setHourlyWeather(mapped);
          const nowEntry = mapped.find(m => m.hour === "Now");
          if (nowEntry) { setCurrentTemp(nowEntry.temp); setCurrentWeatherIcon(nowEntry.icon); }
          else { setCurrentTemp(mapped[0].temp); setCurrentWeatherIcon(mapped[0].icon); }
        }
        const currentHourIndex = hourly.time.findIndex(t => new Date(t).getHours() === currentHour);
        if (currentHourIndex >= 0 && hourly.windspeed_10m) setCurrentWind(Math.round(hourly.windspeed_10m[currentHourIndex]));
        if (currentHourIndex >= 0 && hourly.weather_code) setCurrentConditionText(weatherCodeToText(hourly.weather_code[currentHourIndex]));
        if (data.daily) {
          if (data.daily.temperature_2m_max?.[0] != null) setDailyHigh(Math.round(data.daily.temperature_2m_max[0]));
          if (data.daily.temperature_2m_min?.[0] != null) setDailyLow(Math.round(data.daily.temperature_2m_min[0]));
        }
      })
      .catch(() => {});
  }, []);

  // ─── Court UUID Map ───
  const courtUuidMap = useRef({});

  // ─── Load data from Supabase ───
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const { data: dbCourts } = await supabase
        .from("courts")
        .select("id, court_number, court_type")
        .eq("park_id", "marine-park")
        .order("court_number");

      if (dbCourts && !cancelled) {
        const map = {};
        dbCourts.forEach(c => { map[c.court_number] = c.id; });
        courtUuidMap.current = map;
        setCourts(prev => prev.map(c => {
          const db = dbCourts.find(d => d.court_number === c.id);
          return db ? { ...c, type: db.court_type } : c;
        }));
      }

      // Fetch recent reports
      const { data: dbReports } = await supabase
        .from("reports")
        .select("*, courts!reports_court_id_fkey(court_number)")
        .eq("park_id", "marine-park")
        .order("created_at", { ascending: false })
        .limit(20);

      if (dbReports && !cancelled) {
        const mapped = dbReports.map(r => ({
          id: r.id,
          court: r.courts?.court_number || null,
          stacks: r.stacks !== null ? Number(r.stacks) : null,
          conditions: r.conditions || [],
          user: r.reporter_name || "Anonymous",
          time: new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          text: r.comment || "",
          level: r.overall_level,
        }));
        setReports(mapped);

        // Track latest park report
        const latestParkReport = dbReports.find(r => !r.courts?.court_number && r.overall_level !== null && r.overall_level !== undefined);
        if (latestParkReport) {
          setParkReportAt(new Date(latestParkReport.created_at).getTime());
          setParkReportUser(latestParkReport.reporter_name || "Anonymous");
          setLatestParkLevel(latestParkReport.overall_level);
        }

        // Update court stacks from latest direct court reports (raw data only — no park override)
        setCourts(prev => {
          const latest = {};
          dbReports.forEach(r => {
            if (r.courts?.court_number && !latest[r.courts.court_number]) {
              latest[r.courts.court_number] = r;
            }
          });
          return prev.map(c => {
            const lr = latest[c.id];
            if (lr) {
              const mins = Math.round((Date.now() - new Date(lr.created_at).getTime()) / 60000);
              return {
                ...c,
                stacks: Number(lr.stacks) || 0,
                playing: true, // Any court report = playing
                conditions: lr.conditions || [],
                lastReport: mins < 1 ? "Just now" : `${mins}m ago`,
                lastReportAt: new Date(lr.created_at).getTime(),
                reporter: lr.reporter_name || "Anonymous",
              };
            }
            return c;
          });
        });
      }

      // Fetch main chat messages
      const { data: dbMainChat } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("park_id", "marine-park")
        .is("court_id", null)
        .order("created_at", { ascending: true })
        .limit(50);

      if (dbMainChat && !cancelled) {
        setMainChat(dbMainChat.map(m => ({
          id: m.id,
          name: m.user_name || "Anonymous",
          text: m.text,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          self: m.user_name === userName,
          flagged: m.flagged || false,
          flag_count: m.flag_count || 0,
          deleted: m.deleted || false,
          isSystem: m.is_system || false,
        })));
        try {
          const lastSeen = parseInt(localStorage.getItem("courtpulse_lastChatSeen") || "0");
          if (dbMainChat.length > 0) {
            const newestMsg = dbMainChat[dbMainChat.length - 1];
            const newestTime = new Date(newestMsg.created_at).getTime();
            if (newestTime > lastSeen && newestMsg.user_name !== userName) setUnreadChat(true);
          }
        } catch {}
      }

      // Fetch court-specific chats
      const { data: dbCourtChats } = await supabase
        .from("chat_messages")
        .select("*, courts!chat_messages_court_id_fkey(court_number)")
        .eq("park_id", "marine-park")
        .not("court_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(100);

      if (dbCourtChats && !cancelled) {
        const grouped = {};
        INIT_COURTS.forEach(c => { grouped[c.id] = []; });
        dbCourtChats.forEach(m => {
          const num = m.courts?.court_number;
          if (num) {
            grouped[num] = grouped[num] || [];
            grouped[num].push({
              id: m.id,
              name: m.user_name || "Anonymous",
              text: m.text,
              time: new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              self: m.user_name === userName,
              flagged: m.flagged || false,
              flag_count: m.flag_count || 0,
              deleted: m.deleted || false,
              isSystem: m.is_system || false,
            });
          }
        });
        setCourtChats(grouped);
      }

      if (!cancelled) setLoading(false);
    };

    if (userName) loadData();

    // ─── Real-time subscriptions ───
    const channel = supabase.channel("courtpulse-realtime");

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: "park_id=eq.marine-park" }, (payload) => {
      const m = payload.new;
      const msg = {
        id: m.id,
        name: m.user_name || "Anonymous",
        text: m.text,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        self: m.user_name === userName,
        flagged: m.flagged || false,
        flag_count: m.flag_count || 0,
        deleted: m.deleted || false,
        isSystem: m.is_system || false,
      };
      if (!m.court_id) {
        setMainChat(prev => {
          if (prev.some(p => p.id === m.id)) return prev;
          return [...prev, msg];
        });
        if (m.user_name !== userName) setUnreadChat(true);
      } else {
        const courtNum = Object.entries(courtUuidMap.current).find(([, uuid]) => uuid === m.court_id)?.[0];
        if (courtNum) {
          setCourtChats(prev => {
            const existing = prev[courtNum] || [];
            if (existing.some(p => p.id === m.id)) return prev;
            return { ...prev, [courtNum]: [...existing, msg] };
          });
        }
      }
    });

    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: "park_id=eq.marine-park" }, (payload) => {
      const m = payload.new;
      const autoHidden = (m.flag_count || 0) >= FLAG_THRESHOLD;
      const updater = (prev) => prev.map(p => p.id === m.id ? { ...p, flagged: m.flagged || false, flag_count: m.flag_count || 0, deleted: m.deleted || autoHidden || false, text: (m.deleted || autoHidden) ? "" : p.text } : p);
      if (!m.court_id) {
        setMainChat(updater);
      } else {
        const courtNum = Object.entries(courtUuidMap.current).find(([, uuid]) => uuid === m.court_id)?.[0];
        if (courtNum) setCourtChats(prev => ({ ...prev, [courtNum]: updater(prev[courtNum] || []) }));
      }
    });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "reports", filter: "park_id=eq.marine-park" }, (payload) => {
      const r = payload.new;
      let courtNum = null;
      if (r.court_id) {
        courtNum = Number(Object.entries(courtUuidMap.current).find(([, uuid]) => uuid === r.court_id)?.[0]) || null;
      }
      const report = {
        id: r.id,
        court: courtNum,
        stacks: r.stacks !== null ? Number(r.stacks) : null,
        conditions: r.conditions || [],
        user: r.reporter_name || "Anonymous",
        time: new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text: r.comment || "",
        level: r.overall_level,
      };
      setReports(prev => {
        if (prev.some(p => p.id === r.id)) return prev;
        return [report, ...prev];
      });

      // Court-specific report → update raw court data
      if (courtNum && r.stacks !== null) {
        setCourts(prev => prev.map(c => c.id === courtNum
          ? { ...c, stacks: Number(r.stacks), playing: true, conditions: r.conditions || [], lastReport: "Just now", lastReportAt: Date.now(), reporter: r.reporter_name || "Anonymous" }
          : c
        ));
      }

      // Park-level report → just track it (display derivation handles the rest)
      if (!r.court_id && r.overall_level !== null && r.overall_level !== undefined) {
        setParkReportAt(Date.now());
        setParkReportUser(r.reporter_name || "Anonymous");
        setLatestParkLevel(r.overall_level);
      }
    });

    channel.subscribe();

    // ─── Typing Presence ───
    const typingChannel = supabase.channel('typing-marine-park', {
      config: { presence: { key: userName } },
    });
    typingChannelRef.current = typingChannel;

    typingChannel.on('presence', { event: 'sync' }, () => {
      const state = typingChannel.presenceState();
      const anyoneElseTyping = Object.entries(state).some(([key, presences]) =>
        key !== userName && presences.some(p => p.typing === true)
      );
      setSomeoneTyping(anyoneElseTyping);
      if (anyoneElseTyping) {
        if (typingReceiveTimerRef.current) clearTimeout(typingReceiveTimerRef.current);
        typingReceiveTimerRef.current = setTimeout(() => setSomeoneTyping(false), 5000);
      } else {
        if (typingReceiveTimerRef.current) clearTimeout(typingReceiveTimerRef.current);
      }
    });

    typingChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await typingChannel.track({ typing: false, t: Date.now() });
      }
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      typingChannelRef.current = null;
    };
  }, [userName]);

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
  const [openMenu, setOpenMenu] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showReportExtras, setShowReportExtras] = useState(false);
  const [showCourtReportExtras, setShowCourtReportExtras] = useState(false);

  const [someoneTyping, setSomeoneTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const typingChannelRef = useRef(null);
  const typingReceiveTimerRef = useRef(null);
  const lastSendRef = useRef(0);

  const chatEndRef = useRef(null);
  const courtChatEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatTextareaRef = useRef(null);
  const weatherScrollRef = useRef(null);

  // ─── Effects ───
  useEffect(() => {
    if (tab === "chat") {
      setUnreadChat(false);
      try { localStorage.setItem("courtpulse_lastChatSeen", Date.now().toString()); } catch {}
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tab, mainChat]);

  useEffect(() => {
    if (selectedCourt && courtChatEndRef.current) courtChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [selectedCourt, courtChats]);

  useEffect(() => {
    if (someoneTyping) {
      if (tab === "chat" && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      if (selectedCourt && courtChatEndRef.current) courtChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [someoneTyping, tab, selectedCourt]);

  const handleChatScroll = useCallback((e) => {
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!nearBottom);
  }, []);

  useEffect(() => {
    if (weatherScrollRef.current && hourlyWeather.length > 1) {
      const nowIndex = hourlyWeather.findIndex(h => h.hour === "Now");
      if (nowIndex > 0) {
        const scrollPos = nowIndex * 56 - 16;
        weatherScrollRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    }
  }, [hourlyWeather]);

  const scrollToBottom = useCallback(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current) return;
    typingChannelRef.current.track({ typing: true, t: Date.now() });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (typingChannelRef.current) typingChannelRef.current.track({ typing: false, t: Date.now() });
    }, 3000);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ─── Auth ───
  const handleJoin = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    const contact = contactInput.trim() || null;
    try { localStorage.setItem("courtpulse_name", name); } catch {}
    try { if (contact) localStorage.setItem("courtpulse_contact", contact); } catch {}
    setUserName(name);
    (async () => { try { await supabase.from("users").insert({ name, contact }); } catch {} })();
  };

  // ─── Chat ───
  const sendMainChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN) { showToast("Slow down! Wait a moment."); return; }
    lastSendRef.current = now;
    const text = chatInput.trim().slice(0, MAX_MSG_LENGTH);
    setChatInput("");
    if (typingChannelRef.current) typingChannelRef.current.track({ typing: false, t: Date.now() });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const { error } = await supabase.from("chat_messages").insert({ park_id: "marine-park", court_id: null, user_name: userName, text });
    if (error) console.error("Chat send error:", error);
  }, [chatInput, userName]);

  const sendCourtChat = useCallback(async () => {
    if (!courtChatInput.trim() || !selectedCourt) return;
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN) { showToast("Slow down! Wait a moment."); return; }
    lastSendRef.current = now;
    const text = courtChatInput.trim().slice(0, MAX_MSG_LENGTH);
    const courtUuid = courtUuidMap.current[selectedCourt];
    setCourtChatInput("");
    if (!courtUuid) return;
    const { error } = await supabase.from("chat_messages").insert({ park_id: "marine-park", court_id: courtUuid, user_name: userName, text });
    if (error) console.error("Court chat send error:", error);
  }, [courtChatInput, selectedCourt, userName]);

  // ─── Flag / Delete ───
  const handleFlag = (msgId, chatType) => { setFlagConfirm({ msgId, chatType }); setOpenMenu(null); };

  const confirmFlag = async () => {
    if (!flagConfirm) return;
    const { msgId } = flagConfirm;
    await supabase.from("message_flags").insert({ message_id: msgId, flagged_by: userName, reason: "user_report" });
    const { data: flagCount } = await supabase.from("message_flags").select("id").eq("message_id", msgId);
    const count = flagCount?.length || 1;
    const updates = { flagged: true, flagged_at: new Date().toISOString(), flag_count: count };
    if (count >= FLAG_THRESHOLD) { updates.deleted = true; updates.deleted_at = new Date().toISOString(); }
    await supabase.from("chat_messages").update(updates).eq("id", msgId);
    setFlagConfirm(null);
    showToast("Message reported. Thank you.");
  };

  const handleDelete = (msgId, chatType) => { setDeleteConfirm({ msgId, chatType }); setOpenMenu(null); };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { msgId } = deleteConfirm;
    await supabase.from("chat_messages").update({ deleted: true, deleted_at: new Date().toISOString(), text: "" }).eq("id", msgId);
    setDeleteConfirm(null);
    showToast("Message deleted.");
  };

  // ─── Court Report ───
  const submitCourtReport = useCallback(async () => {
    if (reportStacks === null || !selectedCourt) return;
    const courtUuid = courtUuidMap.current[selectedCourt];
    if (!courtUuid) return;

    const _stacks = reportStacks;
    const _conditions = reportConditions;
    const _text = reportText;
    const _court = selectedCourt;

    // Optimistic UI — any court report = playing
    setCourts(p => p.map(c => c.id === _court
      ? { ...c, stacks: _stacks, playing: true, conditions: _conditions, lastReport: "Just now", lastReportAt: Date.now(), reporter: "You" }
      : c
    ));

    setShowCourtReport(false);
    setReportStacks(0);
    setReportConditions([]);
    setReportText("");
    setShowCourtReportExtras(false);
    showToast("Update submitted!");

    // Haptic feedback
    try { navigator.vibrate(50); } catch {}

    // Fire-and-forget DB writes
    (async () => {
      try {
        await supabase.from("reports").insert({
          park_id: "marine-park",
          court_id: courtUuid,
          stacks: _stacks,
          conditions: _conditions,
          comment: _text || null,
          reporter_name: userName,
          status: _stacks === 0 ? "open" : "in-use",
        });
      } catch (e) { console.error("Report submit error:", e); }
      try {
        const systemText = _stacks === 0
          ? `${userName} updated: No wait`
          : `${userName} updated: ${formatStacks(_stacks)} ${_stacks === 1 ? "stack" : "stacks"}`;
        await supabase.from("chat_messages").insert({
          park_id: "marine-park",
          court_id: courtUuid,
          user_name: "System",
          text: systemText,
          is_system: true,
        });
      } catch (e) { console.error("System message error:", e); }
    })();
  }, [reportStacks, reportConditions, reportText, selectedCourt, userName]);

  // ─── Park Report (no busier-wins — just track, display derivation handles override) ───
  const submitParkReport = useCallback(async () => {
    const hasContent = parkReportLevel !== null || parkReportConditions.length > 0 || parkReportText.trim();
    if (!hasContent) return;

    const levelLabels = ["Empty","Half Playing","All Playing","1 Stack / Half","1 Stack / All","2+ Stacks"];
    let comment = parkReportText.trim() || null;
    if (!comment && parkReportLevel !== null) comment = `Overall: ${levelLabels[parkReportLevel]}`;

    const { error } = await supabase.from("reports").insert({
      park_id: "marine-park",
      court_id: null,
      stacks: null,
      overall_level: parkReportLevel,
      conditions: parkReportConditions.length > 0 ? parkReportConditions : null,
      comment,
      reporter_name: userName,
    });
    if (error) console.error("Park report error:", error);

    // Track park report — display derivation handles the court override
    if (parkReportLevel !== null) {
      setParkReportAt(Date.now());
      setParkReportUser(userName);
      setLatestParkLevel(parkReportLevel);
    }

    setParkReportLevel(null);
    setParkReportConditions([]);
    setParkReportText("");
    showToast("Update submitted!");
    try { navigator.vibrate(50); } catch {}
    setTab("home");
  }, [parkReportLevel, parkReportConditions, parkReportText, userName]);

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

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED COURT DISPLAY (replaces all park-override mutation logic)
  // Priority: fresh court report > newer park report (within 60 min) > empty
  // ═══════════════════════════════════════════════════════════════════════
  const getCourtDisplay = (court) => {
    const now = Date.now();
    const threshold8am = getToday8am();

    // 1. Does the court have a fresh direct report?
    if (court.lastReportAt) {
      const afterReset = court.lastReportAt >= threshold8am;
      const freshMs = getFreshnessMs(court.stacks);
      const withinWindow = (now - court.lastReportAt) < freshMs;

      if (afterReset && withinWindow) {
        return { stacks: court.stacks, playing: true, source: "court", reporter: court.reporter, reportAge: now - court.lastReportAt };
      }
    }

    // 2. Is there a valid park report that's NEWER than this court's last direct report?
    if (parkReportAt && latestParkLevel !== null) {
      const parkAfterReset = parkReportAt >= threshold8am;
      const parkWithin60 = (now - parkReportAt) < 60 * 60 * 1000;
      const parkNewerThanCourt = !court.lastReportAt || parkReportAt > court.lastReportAt;

      if (parkAfterReset && parkWithin60 && parkNewerThanCourt) {
        const mapping = PARK_LEVEL_MAP[latestParkLevel];
        if (mapping) {
          return { stacks: mapping.stacks, playing: mapping.playing, source: "park", reporter: parkReportUser, reportAge: now - parkReportAt };
        }
      }
    }

    // 3. Nothing valid
    return { stacks: 0, playing: false, source: "none" };
  };

  // ─── Timestamp helper (uses derived display) ───
  const getTimestampText = (court) => {
    const display = getCourtDisplay(court);
    if (display.source === "court" || display.source === "park") {
      const mins = Math.round(display.reportAge / 60000);
      const timeStr = mins < 1 ? "just now" : `${mins}m ago`;
      const sourceStr = display.source === "park" ? " via park update" : ` by ${display.reporter}`;
      return `Updated ${timeStr}${sourceStr}`;
    }
    return "No recent updates";
  };

  // ─── Report display helper ───
  const getReportDisplay = (r) => {
    if (r.stacks !== null) {
      const sc = getStackColor(r.stacks, true);
      const label = r.stacks === 0 ? "No wait" : `${formatStacks(r.stacks)} stack${r.stacks !== 1 ? "s" : ""}`;
      return { color: sc.color, label };
    }
    if (r.level !== null && r.level !== undefined) {
      return { color: LEVEL_COLORS[r.level] || C.muted, label: LEVEL_LABELS[r.level] || null };
    }
    return { color: C.muted, label: null };
  };

  // ─── Styles ───
  const s = {
    wrap: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: ff, position: "relative", overflow: "hidden" },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 100 },
    navBtn: (active) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 12px", color: active ? C.primary : C.muted, position: "relative", fontFamily: ff }),
    section: { padding: "0 16px", marginBottom: 16 },
    card: { background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12 },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SIGN-IN SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  if (!userName) {
    return (
      <div style={{ ...s.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: C.banner, minHeight: "100vh" }}>
        <FontLoader />
        <style>{`input::placeholder { color: rgba(244,241,235,0.4) !important; }`}</style>
        <div style={{ marginBottom: 20 }}><LogoMark size={56} color={C.cream} /></div>
        <h1 style={{ fontFamily: ff, fontSize: 30, fontWeight: 500, color: C.cream, margin: 0, letterSpacing: "-0.3px" }}>CourtPulse</h1>
        <p style={{ color: "rgba(244,241,235,0.55)", fontSize: 13, marginTop: 6, marginBottom: 40, fontWeight: 400 }}>Never wonder, just go play.</p>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name" onKeyDown={e => e.key === "Enter" && handleJoin()}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(244,241,235,0.15)", background: "rgba(244,241,235,0.08)", color: C.cream, fontSize: 16, fontFamily: ff, marginBottom: 10, boxSizing: "border-box" }} />
          <input value={contactInput} onChange={e => setContactInput(e.target.value)} placeholder="Phone or email (optional)"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(244,241,235,0.15)", background: "rgba(244,241,235,0.08)", color: C.cream, fontSize: 16, fontFamily: ff, marginBottom: 20, boxSizing: "border-box" }} />
          <button onClick={handleJoin} style={{ width: "100%", padding: "15px", borderRadius: 12, background: C.green, border: "none", color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: ff, cursor: "pointer" }}>
            Let's go
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BANNER
  // ═══════════════════════════════════════════════════════════════════════
  const banner = (
    <div style={{ background: C.banner, padding: "14px 18px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={28} color={C.cream} />
          <div>
            <div style={{ fontFamily: ff, fontSize: 17, fontWeight: 500, color: C.cream, lineHeight: 1.1 }}>Marine Park</div>
            <div style={{ fontSize: 11, color: "rgba(244,241,235,0.5)", fontWeight: 400, fontFamily: ff, marginTop: 2 }}>Open · closes 8pm</div>
          </div>
        </div>
        <a href={PARK.mapsUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          <span style={{ color: "rgba(244,241,235,0.45)" }}>{Icons.Pin(12)}</span>
          <span style={{ fontSize: 11, color: "rgba(244,241,235,0.5)", fontFamily: ff, fontWeight: 400 }}>{PARK.address}</span>
        </a>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURT MAP (3-color system + badges + NO REPORTS label)
  // ═══════════════════════════════════════════════════════════════════════
  const courtMap = (() => {
    const w = 420, h = 280, cW = 90, cH = 100, gap = 10;
    const startX = (w - (cW * 4 + gap * 3)) / 2;
    const topY = 22;
    const botY = topY + cH + 30;

    const positions = [
      { id: 1, row: 0, col: 0 }, { id: 2, row: 0, col: 1 }, { id: 3, row: 0, col: 2 }, { id: 4, row: 0, col: 3 },
      { id: 5, row: 1, col: 0 }, { id: 6, row: 1, col: 1 }, { id: 7, row: 1, col: 2 }, { id: 8, row: 1, col: 3 },
    ];

    return (
      <div style={{ ...s.section, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 10 }}>Court Status</div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          <rect x="0" y="0" width={w} height={h} rx="14" fill={C.primary} opacity="0.04"/>
          <rect x="4" y="4" width={w-8} height={h-8} rx="12" fill={C.primary} opacity="0.02"/>

          <line x1={startX-6} y1={topY+cH+15} x2={startX+cW*4+gap*3+6} y2={topY+cH+15} stroke={C.muted} strokeWidth="1.5" strokeDasharray="8,5" opacity="0.18"/>

          <text x={w/2} y={h-5} textAnchor="middle" fontSize="8" fill={C.muted} fontFamily={ff} opacity="0.45" fontWeight="500">ENTRANCE</text>
          <path d={`M${w/2-18} ${h-13} L${w/2} ${h-9} L${w/2+18} ${h-13}`} stroke={C.muted} strokeWidth="1" fill="none" opacity="0.2"/>

          {positions.map(pos => {
            const court = courts.find(c => c.id === pos.id);
            const display = getCourtDisplay(court);
            const x = startX + pos.col * (cW + gap);
            const y = pos.row === 0 ? topY : botY;
            const cc = COURT_COLOR(display.stacks, display.playing);
            const typeLabel = court.type === "beginner" ? "BEGINNER" : court.type === "challenge" ? "CHALLENGE" : null;
            const isEmpty = display.source === "none" || (!display.playing && display.stacks === 0);

            return (
              <g key={court.id} onClick={() => setSelectedCourt(court.id)} style={{ cursor: "pointer" }}>
                <rect x={x} y={y} width={cW} height={cH} rx="8" fill={cc.fill} stroke={cc.stroke} strokeWidth="2"/>

                <text x={x+cW/2} y={y+cH/2+(typeLabel ? -2 : 5)} textAnchor="middle" fontSize="22" fontWeight="600" fill={isEmpty ? C.muted : cc.stroke} fontFamily={ff}>{court.id}</text>

                {/* Court type label (muted gray) */}
                {typeLabel && (
                  <g>
                    <rect x={x+(cW-62)/2} y={y+cH/2+8} width={62} height={16} rx="4" fill="#7A7265" opacity="0.08"/>
                    <text x={x+cW/2} y={y+cH/2+19.5} textAnchor="middle" fontSize="7.5" fontWeight="500" fill="#7A7265" fontFamily={ff} opacity="0.6">{typeLabel}</text>
                  </g>
                )}

                {/* "NO REPORTS" label on empty courts (only if no type label) */}
                {isEmpty && !typeLabel && (
                  <g>
                    <rect x={x+(cW-62)/2} y={y+cH/2+8} width={62} height={16} rx="4" fill="#7A7265" opacity="0.08"/>
                    <text x={x+cW/2} y={y+cH/2+19.5} textAnchor="middle" fontSize="7" fontWeight="500" fill="#7A7265" fontFamily={ff} opacity="0.5">NO REPORTS</text>
                  </g>
                )}

                {/* "NO REPORTS" on typed empty courts — below type label */}
                {isEmpty && typeLabel && (
                  <text x={x+cW/2} y={y+cH/2+33} textAnchor="middle" fontSize="6.5" fontWeight="500" fill="#7A7265" fontFamily={ff} opacity="0.4">NO REPORTS</text>
                )}

                {/* Stack count badge (3+ stacks only) */}
                {display.stacks >= 3 && display.playing && (
                  <g>
                    <circle cx={x+cW-4} cy={y+4} r="11" fill={C.darkRed} stroke={C.cream} strokeWidth="2"/>
                    <text x={x+cW-4} y={y+8} textAnchor="middle" fontSize="10" fontWeight="600" fill={C.cream} fontFamily={ff}>{Math.floor(display.stacks)}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend (4 items, rounded rectangles) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { fill: C.emptyFill, stroke: C.emptyStroke, label: "Empty" },
            { fill: "#2EA86633", stroke: "#2EA866", label: "Playing" },
            { fill: "#D4A83233", stroke: "#D4A832", label: "1 Stack" },
            { fill: "#C4412A33", stroke: "#C4412A", label: "2+ Stacks" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 10, borderRadius: 3, background: l.fill, border: `1.5px solid ${l.stroke}` }}/>
              <span style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {lastReportTime && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
            <span style={{ color: C.muted }}>{Icons.Clock(13)}</span>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>Last update at {lastReportTime} by {lastReportUser}</span>
          </div>
        )}
      </div>
    );
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // WEATHER WIDGET
  // ═══════════════════════════════════════════════════════════════════════
  const weatherWidget = (
    <div style={{ ...s.section }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 10 }}>Today's Weather</div>
      <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: currentWeatherIcon === "rain" ? C.sub : currentWeatherIcon === "cloud" ? C.muted : "#D4A832" }}>
              <WeatherIcon type={currentWeatherIcon} size={22} />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.text, lineHeight: 1 }}>{currentTemp !== null ? `${currentTemp}°` : "--"}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{currentConditionText || "Loading..."}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted }}>Hi / Lo</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 1 }}>{dailyHigh !== null ? `${dailyHigh}°` : "--"} / {dailyLow !== null ? `${dailyLow}°` : "--"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                {Icons.Wind(11)}
                <span style={{ fontSize: 11, color: C.muted }}>Wind</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 1 }}>{currentWind !== null ? `${currentWind} mph` : "--"}</div>
            </div>
          </div>
        </div>
        <div ref={weatherScrollRef} style={{ display: "flex", gap: 0, overflowX: "auto", padding: "12px 14px", WebkitOverflowScrolling: "touch" }}>
          {hourlyWeather.map((h, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              minWidth: 52, padding: "6px 4px", borderRadius: 10,
              background: h.hour === "Now" ? C.primaryLight : "transparent",
              border: h.hour === "Now" ? `1.5px solid ${C.primary}22` : "1px solid transparent",
            }}>
              <span style={{ fontSize: 12, fontWeight: h.hour === "Now" ? 600 : 400, color: h.hour === "Now" ? C.primary : C.muted }}>{h.hour}</span>
              <span style={{ color: h.icon === "rain" ? C.sub : h.icon === "cloud" ? C.muted : "#D4A832" }}>
                <WeatherIcon type={h.icon} size={16} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{h.temp}°</span>
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
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Predicted busyness</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
            {PREDICTED_TIMES[today].map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: Math.max(8, v * 18), borderRadius: 4, background: [C.green, C.amber, C.red, C.darkRed][v] }}/>
                <span style={{ fontSize: 8, color: C.muted }}>{TIME_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(244,241,235,0.75)", borderRadius: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: ff }}>Coming soon</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, textAlign: "center", padding: "0 24px", lineHeight: 1.5 }}>
            Soon, CourtPulse will predict the best times to play. Every update helps it learn.
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LATEST REPORTS (clean text, no colored left borders)
  // ═══════════════════════════════════════════════════════════════════════
  const latestReports = (
    <div style={{ ...s.section }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 10 }}>Latest updates</div>
      {reports.slice(0, 5).map(r => {
        const rd = getReportDisplay(r);
        return (
          <div key={r.id} style={{ ...s.card, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                {r.court ? `Court ${r.court}` : "Park"}{rd.label ? ` · ${rd.label}` : ""}{r.user ? ` · ${r.user}` : ""}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>{r.time}</span>
            </div>
            {r.text && <div style={{ fontSize: 12, color: C.sub, marginTop: 3, wordBreak: "break-word", overflowWrap: "break-word" }}>{r.text}</div>}
            {r.conditions?.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                {r.conditions.map(c => (
                  <span key={c} style={{ fontSize: 10, background: C.amberLight, color: C.amber, padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>{c}</span>
                ))}
              </div>
            )}
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
      <a href="mailto:courtpulsenyc@gmail.com?subject=CourtPulse%20Feedback" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, textDecoration: "none", cursor: "pointer", marginBottom: 8 }}>
        <span style={{ color: C.muted }}>{Icons.Mail(16)}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.sub }}>Get in touch</span>
      </a>
      <div style={{ textAlign: "center" }}>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy Policy</a>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // HOME SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  const loadingSkeleton = (
    <div style={{ ...s.section, marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 10 }}>Court Status</div>
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, height: 270, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, justifyContent: "center", padding: "0 4px" }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ width: "100%", aspectRatio: "90/100", borderRadius: 8, background: C.border, animation: "shimmer 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}/>
          ))}
        </div>
      </div>
    </div>
  );

  const homeScreen = (
    <div style={{ paddingBottom: 90 }}>
      {banner}
      {loading ? loadingSkeleton : courtMap}
      {weatherWidget}
      {aiPrediction}
      {latestReports}
      {feedbackSection}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // UPDATE TAB (Park Report)
  // ═══════════════════════════════════════════════════════════════════════
  const OVERALL_LEVELS = [
    { key: "empty", label: "Empty", desc: "No one playing", color: C.muted },
    { key: "half-play", label: "Half Playing", desc: "About half the courts in use", color: C.green },
    { key: "all-play", label: "All Playing", desc: "Every court in use, no wait", color: C.green },
    { key: "1-stack-half", label: "1 Stack / Half", desc: "1 stack waiting at half the courts", color: C.amber },
    { key: "1-stack-all", label: "1 Stack / All", desc: "1 stack waiting at every court", color: C.amber },
    { key: "2-stack", label: "2+ Stacks", desc: "2 or more stacks deep", color: C.red },
  ];

  const parkReportHasContent = parkReportLevel !== null || parkReportConditions.length > 0 || parkReportText.trim();

  const reportScreen = (
    <div style={{ paddingBottom: 90 }}>
      {banner}
      <div style={{ ...s.section, marginTop: 16 }}>
        <div style={{ ...s.card }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: ff, marginBottom: 4 }}>Update park status</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>How busy is the park right now?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {OVERALL_LEVELS.map((lvl, i) => {
              const selected = parkReportLevel === i;
              return (
                <button key={lvl.key} onClick={() => setParkReportLevel(prev => prev === i ? null : i)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10,
                  background: selected ? lvl.color : C.bg,
                  border: selected ? `2px solid ${lvl.color}` : `1px solid ${C.border}`,
                  color: selected ? "#fff" : C.text,
                  cursor: "pointer", fontFamily: ff, textAlign: "left",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: selected ? "#fff" : C.text }}>{lvl.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 1, color: selected ? "rgba(255,255,255,0.85)" : C.sub }}>{lvl.desc}</div>
                  </div>
                  {selected && <div style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>✓</div>}
                </button>
              );
            })}
          </div>
          <button onClick={submitParkReport} disabled={!parkReportHasContent} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: parkReportHasContent ? C.primary : C.border,
            border: "none", color: parkReportHasContent ? "#fff" : C.muted,
            fontSize: 15, fontWeight: 600, cursor: parkReportHasContent ? "pointer" : "default", fontFamily: ff,
            marginBottom: 8,
          }}>Submit</button>
          <button onClick={() => setShowReportExtras(prev => !prev)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: 10, background: "none", border: "none", cursor: "pointer", fontFamily: ff,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.sub }}>Add conditions or a note</span>
            <span style={{ transform: showReportExtras ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: C.sub }}>{Icons.ChevronDown(14)}</span>
          </button>
          {showReportExtras && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Conditions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {CONDITIONS.map(c => {
                  const active = parkReportConditions.includes(c.key);
                  return (
                    <button key={c.key} onClick={() => setParkReportConditions(p => active ? p.filter(x => x !== c.key) : [...p, c.key])} style={{
                      padding: "8px 14px", borderRadius: 8,
                      background: active ? C.primaryLight : C.bg,
                      border: active ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                      color: active ? C.primary : C.sub,
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: ff,
                    }}>{c.label}</button>
                  );
                })}
              </div>
              <textarea value={parkReportText} onChange={e => setParkReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, boxSizing: "border-box", resize: "none", wordBreak: "break-word", overflowWrap: "break-word" }}/>
            </div>
          )}
        </div>
      </div>
      {/* Recent updates */}
      <div style={{ ...s.section }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 10 }}>Recent updates</div>
        {reports.slice(0, 8).map(r => {
          const rd = getReportDisplay(r);
          return (
            <div key={r.id} style={{ ...s.card, padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{r.court ? `Court ${r.court}` : "Park"}{rd.label ? ` · ${rd.label}` : ""} · {r.user}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{r.time}</span>
              </div>
              {r.text && <div style={{ fontSize: 11, color: C.sub, marginTop: 2, wordBreak: "break-word", overflowWrap: "break-word" }}>{r.text}</div>}
              {r.conditions?.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  {r.conditions.map(c => (
                    <span key={c} style={{ fontSize: 10, background: C.amberLight, color: C.amber, padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CHAT BUBBLE
  // ═══════════════════════════════════════════════════════════════════════
  const chatBubble = (msg, chatType) => {
    const isMenuOpen = openMenu?.msgId === msg.id && openMenu?.chatType === chatType;

    if (msg.isSystem) {
      return (
        <div key={msg.id} style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: 4 }}>
          <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}15`, borderRadius: 10, padding: "6px 14px", maxWidth: "85%" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.primary }}>{msg.text}</span>
            <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{msg.time}</span>
          </div>
        </div>
      );
    }

    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
          <div style={{ maxWidth: "78%" }}>
            {!msg.self && <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>{msg.name}</div>}
            <div style={{ padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.self ? `${C.primary}15` : "#f0ece6", border: `1px solid ${C.border}` }}>
              <span style={{ fontStyle: "italic", fontSize: 13, color: C.muted }}>This message was deleted</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: msg.self ? "right" : "left", paddingLeft: 4, paddingRight: 4 }}>{msg.time}</div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
        <div style={{ maxWidth: "78%", position: "relative" }}>
          {!msg.self && <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>{msg.name}</div>}
          <div style={{ display: "flex", alignItems: "flex-end", flexDirection: msg.self ? "row-reverse" : "row", gap: 2 }}>
            <div style={{
              padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.self ? C.chatSelf : C.chatOther,
              color: msg.self ? "#fff" : C.text,
              fontSize: 14, lineHeight: 1.4,
              border: msg.self ? "none" : `1px solid ${C.border}`,
              wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap",
            }}>
              <Linkify text={msg.text} color={msg.self ? "#B8D4C8" : C.primary} />
            </div>

            <div style={{ position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : { msgId: msg.id, chatType }); }}
                style={{ width: 24, height: 24, borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, opacity: 0.4 }}>
                {Icons.Dots(14)}
              </button>

              {isMenuOpen && (
                <div style={{
                  position: "absolute", bottom: 28, [msg.self ? "left" : "right"]: 0,
                  background: C.card, borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                  border: `1px solid ${C.border}`, overflow: "hidden", zIndex: 50,
                  minWidth: 160, animation: "modalIn 0.15s ease-out",
                }}>
                  {msg.self ? (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id, chatType); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: ff, fontSize: 13, fontWeight: 500, color: C.red }}>
                      <span>{Icons.Trash(14)}</span>Delete for everyone
                    </button>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); handleFlag(msg.id, chatType); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: ff, fontSize: 13, fontWeight: 500, color: C.red }}>
                      <span>{Icons.Flag(14)}</span>Report message
                    </button>
                  )}
                </div>
              )}
            </div>
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
        <div style={{ padding: "12px 18px", borderRadius: "16px 16px 16px 4px", background: C.chatOther, border: `1px solid ${C.border}`, display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.muted, animation: `typingBounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}/>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // CHAT SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  const chatScreen = (
    <div style={{ paddingBottom: chatFocused ? 8 : 90, display: "flex", flexDirection: "column", height: "100vh" }}>
      {banner}
      <div style={{ padding: "10px 16px 6px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: ff }}>Marine Park Chat</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Keep it about pickleball. Be respectful.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", position: "relative" }} onScroll={handleChatScroll} ref={chatScrollRef}>
        {mainChat.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>No messages yet. Say what's up.</div>
        )}
        {mainChat.map(msg => chatBubble(msg, "main"))}
        {typingIndicator}
        <div ref={chatEndRef}/>

        {showScrollBtn && (
          <button onClick={scrollToBottom} style={{
            position: "sticky", bottom: 8, left: "50%", transform: "translateX(-50%)",
            width: 36, height: 36, borderRadius: 18,
            background: C.card, border: `1px solid ${C.border}`,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: C.primary, zIndex: 10,
          }}>
            {Icons.ChevronDown(18)}
          </button>
        )}
      </div>
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={chatTextareaRef} value={chatInput} onChange={e => { setChatInput(e.target.value.slice(0, MAX_MSG_LENGTH)); broadcastTyping(); if (e.target) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; } }}
          onFocus={() => setChatFocused(true)} onBlur={() => setChatFocused(false)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendMainChat(); if (chatTextareaRef.current) chatTextareaRef.current.style.height = "auto"; } }}
          placeholder="Message..." maxLength={MAX_MSG_LENGTH} rows={1}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 16, fontFamily: ff, outline: "none", resize: "none", maxHeight: 120, lineHeight: 1.4, overflow: "auto" }}/>
        <button onClick={() => { sendMainChat(); if (chatTextareaRef.current) { chatTextareaRef.current.style.height = "auto"; chatTextareaRef.current.blur(); } }} style={{ width: 38, height: 38, borderRadius: 19, background: chatInput.trim() ? C.primary : C.border, border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: chatInput.trim() ? "#fff" : C.muted, flexShrink: 0, marginBottom: 1, transition: "background 0.15s ease" }}>
          {Icons.Send(18)}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURT DETAIL
  // ═══════════════════════════════════════════════════════════════════════
  const courtDetail = (() => {
    if (!selectedCourt) return null;
    const court = courts.find(c => c.id === selectedCourt);
    const type = COURT_TYPES[court.type];
    const display = getCourtDisplay(court);
    const sc = getStackColor(display.stacks, display.playing);
    const courtMessages = courtChats[selectedCourt] || [];

    const courtReportModal = showCourtReport ? (() => {
      return (
      <div onClick={() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportText(""); setShowCourtReportExtras(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: C.card, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: ff, marginBottom: 4 }}>Update Court {selectedCourt}</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>{type.label} · {type.sub}</div>

          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8, textAlign: "center" }}>What's the wait right now?</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 }}>
            <button onClick={() => setReportStacks(Math.max(0, reportStacks - 1))} style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
              {Icons.Minus(20)}
            </button>
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 600, color: getStackColor(reportStacks, true).color, fontFamily: ff }}>{formatStacks(reportStacks)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: getStackColor(reportStacks, true).color, marginTop: -2 }}>{reportStacks === 0 ? "No wait" : getStackColor(reportStacks, true).label}</div>
            </div>
            <button onClick={() => setReportStacks(Math.min(MAX_STACKS, reportStacks + 1))} style={{ width: 44, height: 44, borderRadius: 12, background: reportStacks >= MAX_STACKS ? "#f0ece6" : C.bg, border: `1px solid ${C.border}`, cursor: reportStacks >= MAX_STACKS ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: reportStacks >= MAX_STACKS ? C.border : C.sub }}>
              {Icons.Plus(20)}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <button onClick={() => setReportStacks(prev => {
              const hasHalf = prev % 1 === 0.5;
              if (hasHalf) return Math.floor(prev);
              return Math.min(MAX_STACKS, prev + 0.5);
            })} style={{
              padding: "6px 18px", borderRadius: 8,
              background: reportStacks % 1 === 0.5 ? C.primaryLight : C.bg,
              border: reportStacks % 1 === 0.5 ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
              color: reportStacks % 1 === 0.5 ? C.primary : C.sub,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff,
            }}>
              {reportStacks % 1 === 0.5 ? "Remove ½" : "+ ½ Stack"}
            </button>
          </div>

          <button onClick={() => setShowCourtReportExtras(prev => !prev)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: 10, background: "none", border: "none", cursor: "pointer", fontFamily: ff, marginBottom: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.sub }}>Add conditions or a note</span>
            <span style={{ transform: showCourtReportExtras ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: C.sub }}>{Icons.ChevronDown(14)}</span>
          </button>
          {showCourtReportExtras && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Conditions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {CONDITIONS.map(c => {
                  const active = reportConditions.includes(c.key);
                  return (
                    <button key={c.key} onClick={() => setReportConditions(p => active ? p.filter(x => x !== c.key) : [...p, c.key])} style={{
                      padding: "8px 14px", borderRadius: 8,
                      background: active ? C.primaryLight : C.bg,
                      border: active ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                      color: active ? C.primary : C.sub,
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: ff,
                    }}>{c.label}</button>
                  );
                })}
              </div>
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, boxSizing: "border-box", resize: "none", wordBreak: "break-word", overflowWrap: "break-word" }}/>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportText(""); setShowCourtReportExtras(false); }} style={{ flex: 1, padding: 14, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: ff }}>Cancel</button>
            <button onClick={submitCourtReport} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.primary, border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Submit</button>
          </div>
        </div>
      </div>
      );
    })() : null;

    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 150, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
        {courtReportModal}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, background: C.card, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setSelectedCourt(null); setShowCourtReport(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.text }}>
            {Icons.Back(22)}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: ff }}>Court {selectedCourt}</div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>{type.label} · {type.sub}</div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 6, background: sc.bg }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        <div style={{ padding: "12px 16px" }}>
          <div style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: sc.color, fontFamily: ff }}>{display.playing && display.stacks === 0 ? "No wait" : `${formatStacks(display.stacks)} ${display.stacks === 1 ? "Stack" : "Stacks"}`}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{getTimestampText(court)}</div>
            </div>
            <button onClick={() => { setReportStacks(0); setShowCourtReport(true); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.primary, border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
              Update
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>Court {selectedCourt} Chat</div>
          {courtMessages.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 16px", color: C.muted, fontSize: 13 }}>No messages yet. Say what's up.</div>
          )}
          {courtMessages.map(msg => chatBubble(msg, selectedCourt))}
          {typingIndicator}
          <div ref={courtChatEndRef}/>
        </div>

        <div style={{ padding: "8px 16px env(safe-area-inset-bottom, 8px)", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={courtChatInput} onChange={e => { setCourtChatInput(e.target.value.slice(0, MAX_MSG_LENGTH)); broadcastTyping(); if (e.target) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; } }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendCourtChat(); } }} placeholder={`Message Court ${selectedCourt}...`} maxLength={MAX_MSG_LENGTH} rows={1} style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 16, fontFamily: ff, outline: "none", resize: "none", maxHeight: 120, lineHeight: 1.4, overflow: "auto" }}/>
          <button onClick={() => { sendCourtChat(); document.activeElement?.blur(); }} style={{ width: 38, height: 38, borderRadius: 19, background: courtChatInput.trim() ? C.primary : C.border, border: "none", cursor: courtChatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: courtChatInput.trim() ? "#fff" : C.muted, flexShrink: 0, transition: "background 0.15s ease" }}>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: ff, marginBottom: 8 }}>Report this message?</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 20 }}>
          This message will be flagged for review. Repeated violations may result in a user being muted.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setFlagConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: ff }}>Keep editing</button>
          <button onClick={confirmFlag} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.red, border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Report</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE CONFIRMATION MODAL
  // ═══════════════════════════════════════════════════════════════════════
  const deleteModal = deleteConfirm ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: ff, marginBottom: 8 }}>Delete this message?</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 20 }}>
          This message will be deleted for everyone in the chat. This can't be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: ff }}>Keep message</button>
          <button onClick={confirmDelete} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.red, border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Delete message</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════
  const toastEl = toast ? (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", background: C.primary, color: C.cream, padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 500, fontFamily: ff, boxShadow: "0 4px 20px rgba(45,59,52,0.25)", animation: "fadeDown 0.25s ease-out" }}>
      {toast}
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <main>
    <div style={s.wrap}>
      <FontLoader />
      {toastEl}
      {flagModal}
      {deleteModal}
      {courtDetail}

      {tab === "home" && homeScreen}
      {tab === "update" && reportScreen}
      {tab === "chat" && chatScreen}

      {!selectedCourt && !chatFocused && (
        <div style={s.nav}>
          {[
            { key: "home", label: "Home", icon: Icons.Home },
            { key: "update", label: "Update", icon: Icons.Update, accent: true },
            { key: "chat", label: "Chat", icon: Icons.Chat },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={s.navBtn(tab === t.key)}>
              {t.accent ? (
                <div style={{ background: tab === t.key ? C.primary : C.muted, width: 46, height: 46, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginTop: -18, boxShadow: tab === t.key ? "0 4px 16px rgba(45,59,52,0.25)" : "none", transition: "background 0.15s ease, box-shadow 0.15s ease" }}>
                  {t.icon(22)}
                </div>
              ) : (
                <span style={{ color: tab === t.key ? C.primary : C.muted, position: "relative", transition: "color 0.15s ease" }}>
                  {t.icon()}
                  {t.key === "chat" && unreadChat && tab !== "chat" && (
                    <div style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, background: C.red, border: "2px solid #fff" }}/>
                  )}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? C.primary : C.muted, transition: "color 0.15s ease" }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
    </main>
  );
}