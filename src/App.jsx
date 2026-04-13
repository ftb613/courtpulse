import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Design Tokens ───
const C = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  text: "#1B2028",
  sub: "#5A6270",
  muted: "#6B7280",
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
  blue: "#4A9EBF",
  blueLight: "#E3F2F8",
  darkRed: "#8B1A1A",
  darkRedLight: "#F5E0E0",
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

// ─── Hourly Forecast fallback ───
const HOURLY_FALLBACK = [
  { hour: "Now", temp: "--", icon: "sun" },
];

// ─── Court Data (1,5=beginner left, 4,8=challenge right, rest=regular) ───
const COURT_TYPES = {
  beginner: { label: "Beginner", sub: "4 on / 4 off", color: "#6C63FF" },
  regular: { label: "Regular", sub: "4 on / 4 off", color: C.primary },
  challenge: { label: "Challenge", sub: "2 on / 2 off · Winners stay", color: "#D4540E" },
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
const FRESHNESS_MS = 30 * 60 * 1000; // fallback default

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
const LEVEL_COLORS = [C.green, C.blue, C.blue, C.yellow, C.yellow, C.orange];

// ─── Spam protection ───
const SEND_COOLDOWN = 3000; // 3 seconds
const MAX_MSG_LENGTH = 1000;
const MAX_STACKS = 15;
const FLAG_THRESHOLD = 3; // auto-hide after this many unique flags

// ─── Busyness score (for comparing court vs park reports) ───
const getBusynessScore = (stacks, playing = false) => {
  if (stacks > 0) return stacks;
  if (playing) return 0.01;
  return 0;
};

// ─── Freshness windows (ms) based on stacks ───
const getFreshnessMs = (stacks, playing = false) => {
  if (stacks <= 0 && !playing) return 0;
  if (stacks <= 0 && playing) return 15 * 60 * 1000;
  if (stacks <= 1) return 30 * 60 * 1000;
  if (stacks <= 2) return 45 * 60 * 1000;
  if (stacks <= 3) return 60 * 60 * 1000;
  if (stacks <= 4) return 75 * 60 * 1000;
  if (stacks <= 5) return 90 * 60 * 1000;
  return 105 * 60 * 1000;
};

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

const FontLoader = () => {
  useEffect(() => {
    if (!document.getElementById("courtpulse-fonts")) {
      const link = document.createElement("link");
      link.id = "courtpulse-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  return (
    <style>{`
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes fadeDown { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }
    @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 0.7; } 100% { opacity: 0.4; } }
    textarea { font-family: inherit; }
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

// ─── Helpers ───
const getStackColor = (stacks, playing = false) => {
  if (stacks === 0 && playing) return { bg: C.blueLight, color: C.blue, label: "Playing" };
  if (stacks === 0) return { bg: C.greenLight, color: C.green, label: "Empty" };
  if (stacks <= 1) return { bg: C.yellowLight, color: C.yellow, label: stacks === 0.5 ? "½ Stack" : "1 Stack" };
  if (stacks <= 2) return { bg: C.orangeLight, color: C.orange, label: `${stacks % 1 === 0.5 ? stacks : stacks} Stacks` };
  if (stacks <= 3) return { bg: C.redLight, color: C.red, label: `${stacks % 1 === 0.5 ? stacks : stacks} Stacks` };
  return { bg: C.darkRedLight, color: C.darkRed, label: `${stacks % 1 === 0.5 ? stacks : stacks} Stacks` };
};

// v2-style court colors (fill + stroke)
const COURT_COLOR = (stacks, playing = false) => {
  if (stacks === 0 && playing) return { fill: "#4A9EBF44", stroke: "#4A9EBF" };
  if (stacks === 0) return { fill: "#27AE6044", stroke: "#27AE60" };
  if (stacks <= 1) return { fill: "#E2A61244", stroke: "#E2A612" };
  if (stacks <= 2) return { fill: "#E67E2244", stroke: "#E67E22" };
  if (stacks <= 3) return { fill: "#E74C3C44", stroke: "#E74C3C" };
  return { fill: "#8B1A1A44", stroke: "#8B1A1A" };
};

const formatStacks = (n) => {
  if (n === 0) return "0";
  return n.toString();
};

// Weather code → icon
const weatherCodeToIcon = (code) => {
  if (code <= 1) return "sun";
  if (code === 2) return "partcloud";
  if (code === 3 || code === 45 || code === 48) return "cloud";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (code >= 71 && code <= 77) return "cloud";
  return "sun";
};

// Weather code → human-readable condition text
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
  const [parkReportAt, setParkReportAt] = useState(null); // timestamp of latest park report
  const [parkReportUser, setParkReportUser] = useState(null);

  // ─── Weather State (live from Open-Meteo) ───
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
          if (h < 9 || h > 20) continue; // only show 9am-8pm (court hours)
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
          if (nowEntry) {
            setCurrentTemp(nowEntry.temp);
            setCurrentWeatherIcon(nowEntry.icon);
          } else {
            setCurrentTemp(mapped[0].temp);
            setCurrentWeatherIcon(mapped[0].icon);
          }
        }
        // Current wind speed
        const currentHourIndex = hourly.time.findIndex(t => new Date(t).getHours() === currentHour);
        if (currentHourIndex >= 0 && hourly.windspeed_10m) {
          setCurrentWind(Math.round(hourly.windspeed_10m[currentHourIndex]));
        }
        // Current condition text
        if (currentHourIndex >= 0 && hourly.weather_code) {
          setCurrentConditionText(weatherCodeToText(hourly.weather_code[currentHourIndex]));
        }
        // Daily hi/lo
        if (data.daily) {
          if (data.daily.temperature_2m_max?.[0] != null) setDailyHigh(Math.round(data.daily.temperature_2m_max[0]));
          if (data.daily.temperature_2m_min?.[0] != null) setDailyLow(Math.round(data.daily.temperature_2m_min[0]));
        }
      })
      .catch(() => {}); // keep fallback
  }, []);

  // ─── Court UUID Map (court_number → UUID for Supabase writes) ───
  const courtUuidMap = useRef({});

  // ─── Load data from Supabase ───
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      // Fetch courts with UUIDs
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

      // Fetch recent reports (last 24 hours)
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

        // Track latest park report timestamp
        const latestParkReport = dbReports.find(r => !r.courts?.court_number && r.overall_level !== null && r.overall_level !== undefined);
        if (latestParkReport) {
          setParkReportAt(new Date(latestParkReport.created_at).getTime());
          setParkReportUser(latestParkReport.reporter_name || "Anonymous");
        }

        // Update court stacks from latest direct court reports
        setCourts(prev => {
          const updated = [...prev];
          const latest = {};
          dbReports.forEach(r => {
            if (r.courts?.court_number && !latest[r.courts.court_number]) {
              latest[r.courts.court_number] = r;
            }
          });
          let result = updated.map(c => {
            const lr = latest[c.id];
            if (lr) {
              const mins = Math.round((Date.now() - new Date(lr.created_at).getTime()) / 60000);
              return {
                ...c,
                stacks: Number(lr.stacks) || 0,
                playing: Number(lr.stacks) > 0,
                conditions: lr.conditions || [],
                lastReport: mins < 1 ? "Just now" : `${mins}m ago`,
                lastReportAt: new Date(lr.created_at).getTime(),
                reporter: lr.reporter_name || "Anonymous",
              };
            }
            return c;
          });

          // Apply latest park-level report to courts without fresh direct reports
          if (latestParkReport) {
            const mapping = PARK_LEVEL_MAP[latestParkReport.overall_level];
            if (mapping) {
              const now = Date.now();
              result = result.map(c => {
                const freshMs = getFreshnessMs(c.stacks, c.playing);
                const isFresh = c.lastReportAt && (now - c.lastReportAt < freshMs);
                if (isFresh) return c;
                const courtBusy = getBusynessScore(c.stacks, c.playing);
                const parkBusy = getBusynessScore(mapping.stacks, mapping.playing);
                if (parkBusy > courtBusy) return { ...c, stacks: mapping.stacks, playing: mapping.playing };
                return c;
              });
            }
          }

          return result;
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

        // Check for unread messages since last visit
        try {
          const lastSeen = parseInt(localStorage.getItem("courtpulse_lastChatSeen") || "0");
          if (dbMainChat.length > 0) {
            const newestMsg = dbMainChat[dbMainChat.length - 1];
            const newestTime = new Date(newestMsg.created_at).getTime();
            if (newestTime > lastSeen && newestMsg.user_name !== userName) {
              setUnreadChat(true);
            }
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
        // Set unread dot if not currently on chat tab
        if (m.user_name !== userName) {
          setUnreadChat(prev => true);
        }
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
        if (courtNum) {
          setCourtChats(prev => ({ ...prev, [courtNum]: updater(prev[courtNum] || []) }));
        }
      }
    });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "reports", filter: "park_id=eq.marine-park" }, async (payload) => {
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

      // Court-specific report → update that court directly
      if (courtNum && r.stacks !== null) {
        setCourts(prev => prev.map(c => c.id === courtNum
          ? { ...c, stacks: Number(r.stacks), playing: Number(r.stacks) > 0, conditions: r.conditions || [], lastReport: "Just now", lastReportAt: Date.now(), reporter: r.reporter_name || "Anonymous" }
          : c
        ));
      }

      // Park-level report → apply formula to stale courts
      if (!r.court_id && r.overall_level !== null && r.overall_level !== undefined) {
        setParkReportAt(Date.now());
        setParkReportUser(r.reporter_name || "Anonymous");
        const mapping = PARK_LEVEL_MAP[r.overall_level];
        if (mapping) {
          const now = Date.now();
          setCourts(prev => prev.map(c => {
            const freshMs = getFreshnessMs(c.stacks, c.playing);
            const isFresh = c.lastReportAt && (now - c.lastReportAt < freshMs);
            if (isFresh) return c;
            const courtBusy = getBusynessScore(c.stacks, c.playing);
            const parkBusy = getBusynessScore(mapping.stacks, mapping.playing);
            if (parkBusy > courtBusy) return { ...c, stacks: mapping.stacks, playing: mapping.playing };
            return c;
          }));
        }
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
      // Safety timeout: auto-clear after 5 seconds even if "stopped" event is lost
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
  const typingReceiveTimerRef = useRef(null); // safety timeout on receiving end
  const lastSendRef = useRef(0); // spam protection

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

  // Auto-scroll weather to "Now" hour
  useEffect(() => {
    if (weatherScrollRef.current && hourlyWeather.length > 1) {
      const nowIndex = hourlyWeather.findIndex(h => h.hour === "Now");
      if (nowIndex > 0) {
        const scrollPos = nowIndex * 56 - 16; // ~56px per item, offset to show a bit before
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

  // ─── Auth (FIXED: setUserName fires immediately) ───
  const handleJoin = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    const contact = contactInput.trim() || null;
    try { localStorage.setItem("courtpulse_name", name); } catch {}
    try { if (contact) localStorage.setItem("courtpulse_contact", contact); } catch {}
    setUserName(name);
    // Fire-and-forget DB insert
    (async () => { try { await supabase.from("users").insert({ name, contact }); } catch {} })();
  };

  // ─── Chat (with spam protection) ───
  const sendMainChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN) {
      showToast("Slow down! Wait a moment.");
      return;
    }
    lastSendRef.current = now;
    const text = chatInput.trim().slice(0, MAX_MSG_LENGTH);
    setChatInput("");
    if (typingChannelRef.current) typingChannelRef.current.track({ typing: false, t: Date.now() });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const { error } = await supabase.from("chat_messages").insert({
      park_id: "marine-park",
      court_id: null,
      user_name: userName,
      text,
    });
    if (error) console.error("Chat send error:", error);
  }, [chatInput, userName]);

  const sendCourtChat = useCallback(async () => {
    if (!courtChatInput.trim() || !selectedCourt) return;
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN) {
      showToast("Slow down! Wait a moment.");
      return;
    }
    lastSendRef.current = now;
    const text = courtChatInput.trim().slice(0, MAX_MSG_LENGTH);
    const courtUuid = courtUuidMap.current[selectedCourt];
    setCourtChatInput("");
    if (!courtUuid) return;
    const { error } = await supabase.from("chat_messages").insert({
      park_id: "marine-park",
      court_id: courtUuid,
      user_name: userName,
      text,
    });
    if (error) console.error("Court chat send error:", error);
  }, [courtChatInput, selectedCourt, userName]);

  // ─── Flag Message ───
  const handleFlag = (msgId, chatType) => {
    setFlagConfirm({ msgId, chatType });
    setOpenMenu(null);
  };

  const confirmFlag = async () => {
    if (!flagConfirm) return;
    const { msgId } = flagConfirm;
    // Insert flag record
    await supabase.from("message_flags").insert({ message_id: msgId, flagged_by: userName, reason: "user_report" });
    // Increment flag_count on the message (RPC or manual increment)
    const { data: flagCount } = await supabase.from("message_flags").select("id").eq("message_id", msgId);
    const count = flagCount?.length || 1;
    const updates = { flagged: true, flagged_at: new Date().toISOString(), flag_count: count };
    if (count >= FLAG_THRESHOLD) {
      updates.deleted = true;
      updates.deleted_at = new Date().toISOString();
    }
    await supabase.from("chat_messages").update(updates).eq("id", msgId);
    setFlagConfirm(null);
    showToast("Message reported. Thank you.");
  };

  // ─── Delete Message ───
  const handleDelete = (msgId, chatType) => {
    setDeleteConfirm({ msgId, chatType });
    setOpenMenu(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { msgId } = deleteConfirm;
    await supabase.from("chat_messages").update({ deleted: true, deleted_at: new Date().toISOString(), text: "" }).eq("id", msgId);
    setDeleteConfirm(null);
    showToast("Message deleted.");
  };

  // ─── Court Report (snappy: close instantly, DB writes in background) ───
  const submitCourtReport = useCallback(async () => {
    if (reportStacks === null || !selectedCourt) return;
    const courtUuid = courtUuidMap.current[selectedCourt];
    if (!courtUuid) return;

    // Capture values before resetting state
    const _stacks = reportStacks;
    const _conditions = reportConditions;
    const _text = reportText;
    const _court = selectedCourt;

    // Optimistic UI update
    setCourts(p => p.map(c => c.id === _court
      ? { ...c, stacks: _stacks, playing: _stacks > 0, conditions: _conditions, lastReport: "Just now", lastReportAt: Date.now(), reporter: "You" }
      : c
    ));

    // Close modal and reset immediately
    setShowCourtReport(false);
    setReportStacks(0);
    setReportConditions([]);
    setReportText("");
    setShowCourtReportExtras(false);
    showToast("Report submitted!");

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
        const systemText = _stacks === 0 ? `${userName} reported: Empty` : `${userName} reported: ${formatStacks(_stacks)} ${_stacks === 1 ? "stack" : "stacks"}`;
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

  // ─── Park-Level Report (FIXED: allows comment/condition-only, applies formula) ───
  const submitParkReport = useCallback(async () => {
    const hasContent = parkReportLevel !== null || parkReportConditions.length > 0 || parkReportText.trim();
    if (!hasContent) return;

    const levelLabels = ["Empty","Half Playing","All Playing","1 Stack / Half","1 Stack / All","2+ Stacks"];
    let comment = parkReportText.trim() || null;
    if (!comment && parkReportLevel !== null) {
      comment = `Overall: ${levelLabels[parkReportLevel]}`;
    }

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

    // Apply formula to courts immediately (optimistic)
    if (parkReportLevel !== null) {
      setParkReportAt(Date.now());
      setParkReportUser(userName);
      const mapping = PARK_LEVEL_MAP[parkReportLevel];
      if (mapping) {
        const now = Date.now();
        setCourts(prev => prev.map(c => {
          const freshMs = getFreshnessMs(c.stacks, c.playing);
          const isFresh = c.lastReportAt && (now - c.lastReportAt < freshMs);
          if (isFresh) return c;
          const courtBusy = getBusynessScore(c.stacks, c.playing);
          const parkBusy = getBusynessScore(mapping.stacks, mapping.playing);
          if (parkBusy > courtBusy) return { ...c, stacks: mapping.stacks, playing: mapping.playing };
          return c;
        }));
      }
    }

    setParkReportLevel(null);
    setParkReportConditions([]);
    setParkReportText("");
    showToast("Report submitted!");
  }, [parkReportLevel, parkReportConditions, parkReportText, userName]);

  // Close menu on outside tap
  useEffect(() => {
    if (openMenu) {
      const handler = () => setOpenMenu(null);
      const t = setTimeout(() => document.addEventListener("click", handler, { once: true }), 10);
      return () => { clearTimeout(t); document.removeEventListener("click", handler); };
    }
  }, [openMenu]);

  // ─── Last Report Time (smart: uses court-specific or park report) ───
  const lastReportTime = reports.length > 0 ? reports[0].time : null;
  const lastReportUser = reports.length > 0 ? reports[0].user : null;

  // ─── Court freshness helper ───
  const getCourtFreshness = (court) => {
    // Fade disabled for soft launch — timestamps communicate freshness instead.
    // Revisit once reporting volume is consistent.
    return 1;
  };

  // ─── Court timestamp helper ───
  const getCourtTimestamp = (court) => {
    const now = Date.now();
    const freshMs = getFreshnessMs(court.stacks, court.playing);
    if (court.lastReportAt) {
      const age = now - court.lastReportAt;
      if (age < freshMs) {
        return { text: `Reported ${court.lastReport} by ${court.reporter}`, source: "court" };
      }
    }
    // Fall back to park report if fresher
    if (parkReportAt) {
      const parkAge = now - parkReportAt;
      const parkMins = Math.round(parkAge / 60000);
      if (parkAge < 60 * 60 * 1000) { // park report within 60 min
        return { text: `Updated ${parkMins < 1 ? "just now" : `${parkMins}m ago`} via park report`, source: "park" };
      }
    }
    return { text: "No recent reports", source: "none" };
  };

  // ─── Helper: get report display info (works for both court and park reports) ───
  const getReportDisplay = (r) => {
    let borderColor, displayLabel;
    if (r.stacks !== null) {
      const sc = getStackColor(r.stacks);
      borderColor = sc.color;
      displayLabel = r.stacks === 0 ? "Empty" : `${formatStacks(r.stacks)} stack${r.stacks !== 1 ? "s" : ""}`;
    } else if (r.level !== null && r.level !== undefined) {
      borderColor = LEVEL_COLORS[r.level] || C.border;
      displayLabel = LEVEL_LABELS[r.level] || null;
    } else {
      borderColor = C.muted;
      displayLabel = null;
    }
    return { borderColor, displayLabel };
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
  // BANNER (uses live weather)
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
  // COURT MAP (v2 style — now with "Playing" blue color)
  // ═══════════════════════════════════════════════════════════════════════
  const courtMap = (() => {
    const w = 420, h = 270, cW = 90, cH = 100, gap = 10;
    const startX = (w - (cW * 4 + gap * 3)) / 2;
    const topY = 22;
    const botY = topY + cH + 30;

    const positions = [
      { id: 1, row: 0, col: 0 }, { id: 2, row: 0, col: 1 }, { id: 3, row: 0, col: 2 }, { id: 4, row: 0, col: 3 },
      { id: 5, row: 1, col: 0 }, { id: 6, row: 1, col: 1 }, { id: 7, row: 1, col: 2 }, { id: 8, row: 1, col: 3 },
    ];

    return (
      <div style={{ ...s.section, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Court Status</div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          <rect x="0" y="0" width={w} height={h} rx="14" fill="#2D5A27" opacity="0.08"/>
          <rect x="4" y="4" width={w-8} height={h-8} rx="12" fill="#3A7233" opacity="0.04"/>

          <line x1={startX-6} y1={topY+cH+15} x2={startX+cW*4+gap*3+6} y2={topY+cH+15} stroke="#5A6270" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.18"/>

          <text x={w/2} y={h-5} textAnchor="middle" fontSize="8" fill="#5A6270" fontFamily={ff} opacity="0.45" fontWeight="600">ENTRANCE</text>
          <path d={`M${w/2-18} ${h-13} L${w/2} ${h-9} L${w/2+18} ${h-13}`} stroke="#5A6270" strokeWidth="1" fill="none" opacity="0.2"/>

          {positions.map(pos => {
            const court = courts.find(c => c.id === pos.id);
            const x = startX + pos.col * (cW + gap);
            const y = pos.row === 0 ? topY : botY;
            const cc = COURT_COLOR(court.stacks, court.playing);
            const typeLabel = court.type === "beginner" ? "BEGINNER" : court.type === "challenge" ? "CHALLENGE" : null;
            const typeColor = court.type === "beginner" ? "#6C63FF" : court.type === "challenge" ? "#D4540E" : null;
            const freshness = getCourtFreshness(court);

            return (
              <g key={court.id} onClick={() => setSelectedCourt(court.id)} style={{ cursor: "pointer", opacity: freshness }}>
                <rect x={x} y={y} width={cW} height={cH} rx="8" fill={cc.fill} stroke={cc.stroke} strokeWidth="2.5"/>

                <text x={x+cW/2} y={y+cH/2+(typeLabel ? 0 : 5)} textAnchor="middle" fontSize="20" fontWeight="800" fill={cc.stroke} fontFamily={ff}>{court.id}</text>

                {typeLabel && (
                  <g>
                    <rect x={x+(cW-60)/2} y={y+cH/2+7} width={60} height={17} rx="5" fill={typeColor} opacity="0.15"/>
                    <text x={x+cW/2} y={y+cH/2+19} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={typeColor} fontFamily={ff} opacity="0.9">{typeLabel}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend (updated with Playing) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { color: "#27AE60", label: "Empty" },
            { color: "#4A9EBF", label: "Playing" },
            { color: "#E2A612", label: "1 Stack" },
            { color: "#E67E22", label: "2 Stacks" },
            { color: "#E74C3C", label: "3 Stacks" },
            { color: "#8B1A1A", label: "3+" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, opacity: 0.7 }}/>
              <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {lastReportTime && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
            <span style={{ color: C.sub }}>{Icons.Clock(13)}</span>
            <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>Last report at {lastReportTime} by {lastReportUser}</span>
          </div>
        )}
      </div>
    );
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // WEATHER WIDGET (Option C: summary header + hourly scroll)
  // ═══════════════════════════════════════════════════════════════════════
  const weatherWidget = (
    <div style={{ ...s.section }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Today's Weather</div>
      <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
        {/* Summary header */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: currentWeatherIcon === "rain" ? C.primary : currentWeatherIcon === "cloud" ? C.muted : "#F0C040" }}>
              <WeatherIcon type={currentWeatherIcon} size={22} />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1 }}>{currentTemp !== null ? `${currentTemp}°` : "--"}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{currentConditionText || "Loading..."}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.sub }}>Hi / Lo</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 1 }}>{dailyHigh !== null ? `${dailyHigh}°` : "--"} / {dailyLow !== null ? `${dailyLow}°` : "--"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                {Icons.Wind(11)}
                <span style={{ fontSize: 11, color: C.sub }}>Wind</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 1 }}>{currentWind !== null ? `${currentWind} mph` : "--"}</div>
            </div>
          </div>
        </div>
        {/* Hourly scroll */}
        <div ref={weatherScrollRef} style={{ display: "flex", gap: 0, overflowX: "auto", padding: "12px 14px", WebkitOverflowScrolling: "touch" }}>
          {hourlyWeather.map((h, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              minWidth: 52, padding: "6px 4px", borderRadius: 10,
              background: h.hour === "Now" ? C.primaryLight : "transparent",
              border: h.hour === "Now" ? `1.5px solid ${C.primary}33` : "1px solid transparent",
            }}>
              <span style={{ fontSize: 12, fontWeight: h.hour === "Now" ? 700 : 500, color: h.hour === "Now" ? C.primary : C.sub }}>{h.hour}</span>
              <span style={{ color: h.icon === "rain" ? C.primary : h.icon === "cloud" ? C.muted : "#F0C040" }}>
                <WeatherIcon type={h.icon} size={16} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{h.temp}°</span>
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
  // LATEST REPORTS (FIXED: shows level label + correct color for park reports)
  // ═══════════════════════════════════════════════════════════════════════
  const latestReports = (
    <div style={{ ...s.section }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Latest Reports</div>
      {reports.slice(0, 5).map(r => {
        const { borderColor, displayLabel } = getReportDisplay(r);
        return (
          <div key={r.id} style={{ ...s.card, padding: "10px 14px", borderLeft: `4px solid ${borderColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {r.court ? `Court ${r.court}` : "Overall"}{displayLabel ? ` · ${displayLabel}` : ""}{r.user ? ` · ${r.user}` : ""}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>{r.time}</span>
            </div>
            {r.text && <div style={{ fontSize: 12, color: C.sub, marginTop: 3, wordBreak: "break-word", overflowWrap: "break-word" }}>{r.text}</div>}
            {r.conditions?.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                {r.conditions.map(c => (
                  <span key={c} style={{ fontSize: 10, background: C.yellowLight, color: C.yellow, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{c}</span>
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
        <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Feedback or issue? Contact us</span>
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
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Court Status</div>
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
  // REPORT TAB (FIXED: comment-only allowed, correct recent reports display)
  // ═══════════════════════════════════════════════════════════════════════
  const OVERALL_LEVELS = [
    { key: "empty", label: "Empty", desc: "No one playing", color: C.green },
    { key: "half-play", label: "Half Playing", desc: "About half the courts in use", color: C.blue },
    { key: "all-play", label: "All Playing", desc: "Every court in use, no wait", color: C.blue },
    { key: "1-stack-half", label: "1 Stack / Half", desc: "1 stack waiting at half the courts", color: C.yellow },
    { key: "1-stack-all", label: "1 Stack / All", desc: "1 stack waiting at every court", color: C.yellow },
    { key: "2-stack", label: "2+ Stacks", desc: "2 or more stacks deep", color: C.orange },
  ];

  const parkReportHasContent = parkReportLevel !== null || parkReportConditions.length > 0 || parkReportText.trim();

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
                <button key={lvl.key} onClick={() => setParkReportLevel(prev => prev === i ? null : i)} style={{
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
          <button onClick={submitParkReport} disabled={!parkReportHasContent} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: parkReportHasContent ? C.primary : C.border,
            border: "none", color: parkReportHasContent ? "#fff" : C.muted,
            fontSize: 15, fontWeight: 700, cursor: parkReportHasContent ? "pointer" : "default", fontFamily: ff,
            marginBottom: 8,
          }}>Submit Report</button>
          <button onClick={() => setShowReportExtras(prev => !prev)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: 10, background: "none", border: "none", cursor: "pointer", fontFamily: ff,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Add conditions or a note</span>
            <span style={{ transform: showReportExtras ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: C.sub }}>{Icons.ChevronDown(14)}</span>
          </button>
          {showReportExtras && (
            <div style={{ marginTop: 8 }}>
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
              <textarea value={parkReportText} onChange={e => setParkReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, boxSizing: "border-box", resize: "none", wordBreak: "break-word", overflowWrap: "break-word" }}/>
            </div>
          )}
        </div>
      </div>
      {/* Past reports (FIXED: correct colors + labels) */}
      <div style={{ ...s.section }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recent Reports</div>
        {reports.slice(0, 8).map(r => {
          const { borderColor, displayLabel } = getReportDisplay(r);
          return (
            <div key={r.id} style={{ ...s.card, padding: "10px 14px", borderLeft: `4px solid ${borderColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.court ? `Court ${r.court}` : "Overall"}{displayLabel ? ` · ${displayLabel}` : ""} · {r.user}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{r.time}</span>
              </div>
              {r.text && <div style={{ fontSize: 11, color: C.sub, marginTop: 2, wordBreak: "break-word", overflowWrap: "break-word" }}>{r.text}</div>}
              {r.conditions?.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  {r.conditions.map(c => (
                    <span key={c} style={{ fontSize: 10, background: C.yellowLight, color: C.yellow, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{c}</span>
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
  // CHAT BUBBLE (v2.4: linkify, 3-dot bottom, dropdown fix, flag visible, system msgs)
  // ═══════════════════════════════════════════════════════════════════════
  const chatBubble = (msg, chatType) => {
    const isMenuOpen = openMenu?.msgId === msg.id && openMenu?.chatType === chatType;

    // System messages (court reports posted to chat)
    if (msg.isSystem) {
      return (
        <div key={msg.id} style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: 4 }}>
          <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}22`, borderRadius: 10, padding: "6px 14px", maxWidth: "85%" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{msg.text}</span>
            <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{msg.time}</span>
          </div>
        </div>
      );
    }

    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
          <div style={{ maxWidth: "78%" }}>
            {!msg.self && <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 2, paddingLeft: 4 }}>{msg.name}</div>}
            <div style={{ padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.self ? "rgba(43,108,176,0.15)" : "#f0f0f0", border: `1px solid ${C.border}` }}>
              <span style={{ fontStyle: "italic", fontSize: 13, color: C.muted }}>
                This message was deleted
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
          <div style={{ display: "flex", alignItems: "flex-end", flexDirection: msg.self ? "row-reverse" : "row", gap: 2 }}>
            <div style={{
              padding: "10px 14px", borderRadius: msg.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.self ? C.chatSelf : C.chatOther,
              color: msg.self ? "#fff" : C.text,
              fontSize: 14, lineHeight: 1.4,
              border: msg.self ? "none" : `1px solid ${C.border}`,
              wordBreak: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
            }}>
              <Linkify text={msg.text} color={msg.self ? "#B3D4FF" : C.primary} />
            </div>

            <div style={{ position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : { msgId: msg.id, chatType }); }}
                style={{ width: 24, height: 24, borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, opacity: 0.4 }}>
                {Icons.Dots(14)}
              </button>

              {isMenuOpen && (
                <div style={{
                  position: "absolute", bottom: 28, [msg.self ? "left" : "right"]: 0,
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
  // CHAT SCREEN (v2.4: textarea, enter=newline, nav hides on focus)
  // ═══════════════════════════════════════════════════════════════════════
  const chatScreen = (
    <div style={{ paddingBottom: chatFocused ? 8 : 90, display: "flex", flexDirection: "column", height: "100vh" }}>
      {banner}
      <div style={{ padding: "10px 16px 6px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif" }}>Marine Park Chat</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Keep it about pickleball. Be respectful.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", position: "relative" }} onScroll={handleChatScroll} ref={chatScrollRef}>
        {mainChat.map(msg => chatBubble(msg, "main"))}
        {typingIndicator}
        <div ref={chatEndRef}/>

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
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={chatTextareaRef} value={chatInput} onChange={e => { setChatInput(e.target.value.slice(0, MAX_MSG_LENGTH)); broadcastTyping(); if (e.target) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; } }}
          onFocus={() => setChatFocused(true)} onBlur={() => setChatFocused(false)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendMainChat(); if (chatTextareaRef.current) chatTextareaRef.current.style.height = "auto"; } }}
          placeholder="Message..." maxLength={MAX_MSG_LENGTH} rows={1}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 16, fontFamily: ff, outline: "none", resize: "none", maxHeight: 120, lineHeight: 1.4, overflow: "auto" }}/>
        <button onClick={() => { sendMainChat(); if (chatTextareaRef.current) { chatTextareaRef.current.style.height = "auto"; chatTextareaRef.current.blur(); } }} style={{ width: 38, height: 38, borderRadius: 19, background: chatInput.trim() ? C.primary : C.border, border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: chatInput.trim() ? "#fff" : C.muted, flexShrink: 0, marginBottom: 1 }}>
          {Icons.Send(18)}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // COURT DETAIL (stacks capped at MAX_STACKS, word wrap on chat)
  // ═══════════════════════════════════════════════════════════════════════
  const courtDetail = (() => {
    if (!selectedCourt) return null;
    const court = courts.find(c => c.id === selectedCourt);
    const type = COURT_TYPES[court.type];
    const sc = getStackColor(court.stacks, court.playing);
    const courtMessages = courtChats[selectedCourt] || [];

    const courtReportModal = showCourtReport ? (() => {
      return (
      <div onClick={() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportText(""); setShowCourtReportExtras(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: C.card, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", animation: "slideUp 0.25s ease" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Report Court {selectedCourt}</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>{type.label} · {type.sub}</div>

          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8, textAlign: "center" }}>What's the wait right now?</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 }}>
            <button onClick={() => setReportStacks(Math.max(0, reportStacks - 1))} style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
              {Icons.Minus(20)}
            </button>
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: getStackColor(reportStacks).color, fontFamily: "'Fraunces', serif" }}>{formatStacks(reportStacks)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: getStackColor(reportStacks).color, marginTop: -2 }}>{getStackColor(reportStacks).label}</div>
            </div>
            <button onClick={() => setReportStacks(Math.min(MAX_STACKS, reportStacks + 1))} style={{ width: 44, height: 44, borderRadius: 12, background: reportStacks >= MAX_STACKS ? "#f0f0f0" : C.bg, border: `1px solid ${C.border}`, cursor: reportStacks >= MAX_STACKS ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: reportStacks >= MAX_STACKS ? C.border : C.sub }}>
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
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff,
            }}>
              {reportStacks % 1 === 0.5 ? "Remove ½" : "+ ½ Stack"}
            </button>
          </div>

          <button onClick={() => setShowCourtReportExtras(prev => !prev)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: 10, background: "none", border: "none", cursor: "pointer", fontFamily: ff, marginBottom: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Add conditions or a note</span>
            <span style={{ transform: showCourtReportExtras ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: C.sub }}>{Icons.ChevronDown(14)}</span>
          </button>
          {showCourtReportExtras && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Conditions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
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
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Add a note (optional)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: ff, boxSizing: "border-box", resize: "none", wordBreak: "break-word", overflowWrap: "break-word" }}/>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportText(""); setShowCourtReportExtras(false); }} style={{ flex: 1, padding: 14, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.sub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
            <button onClick={submitCourtReport} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.primary, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Submit</button>
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
              <div style={{ fontSize: 24, fontWeight: 900, color: sc.color, fontFamily: "'Fraunces', serif" }}>{court.stacks === 0 && court.playing ? "Playing" : `${formatStacks(court.stacks)} ${court.stacks === 1 ? "Stack" : "Stacks"}`}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{getCourtTimestamp(court).text}</div>
            </div>
            <button onClick={() => { setReportStacks(0); setShowCourtReport(true); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.primary, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>
              Report
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>Court {selectedCourt} Chat</div>
          {courtMessages.map(msg => chatBubble(msg, selectedCourt))}
          {typingIndicator}
          <div ref={courtChatEndRef}/>
        </div>

        <div style={{ padding: "8px 16px env(safe-area-inset-bottom, 8px)", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={courtChatInput} onChange={e => { setCourtChatInput(e.target.value.slice(0, MAX_MSG_LENGTH)); broadcastTyping(); if (e.target) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; } }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendCourtChat(); } }} placeholder={`Message Court ${selectedCourt}...`} maxLength={MAX_MSG_LENGTH} rows={1} style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`, fontSize: 16, fontFamily: ff, outline: "none", resize: "none", maxHeight: 120, lineHeight: 1.4, overflow: "auto" }}/>
          <button onClick={() => { sendCourtChat(); document.activeElement?.blur(); }} style={{ width: 38, height: 38, borderRadius: 19, background: courtChatInput.trim() ? C.primary : C.border, border: "none", cursor: courtChatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: courtChatInput.trim() ? "#fff" : C.muted, flexShrink: 0 }}>
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
    <main>
    <div style={s.wrap}>
      <FontLoader />
      {toastEl}
      {flagModal}
      {deleteModal}
      {courtDetail}

      {tab === "home" && homeScreen}
      {tab === "report" && reportScreen}
      {tab === "chat" && chatScreen}

      {!selectedCourt && !chatFocused && (
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
                <span style={{ color: tab === t.key ? C.primary : C.muted, position: "relative" }}>
                  {t.icon()}
                  {t.key === "chat" && unreadChat && tab !== "chat" && (
                    <div style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, background: C.red, border: "2px solid #fff" }}/>
                  )}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.primary : C.muted }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
    </main>
  );
}