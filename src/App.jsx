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

// ─── Court Data ───
const COURT_TYPES = {
  beginner: { label: "Beginner", sub: "4 on / 4 off", color: "#6C63FF" },
  regular: { label: "Regular", sub: "4 on / 4 off", color: C.primary },
  challenge: { label: "Challenge", sub: "2 on / 2 off · Winners stay", color: "#D4540E" },
};

const INIT_COURTS = [
  { id: 1, type: "beginner", stacks: 0, conditions: [], lastReport: "5m ago", reporter: "Mike T." },
  { id: 2, type: "regular", stacks: 1, conditions: [], lastReport: "3m ago", reporter: "Sarah K." },
  { id: 3, type: "regular", stacks: 2, conditions: [], lastReport: "1m ago", reporter: "Dave R." },
  { id: 4, type: "challenge", stacks: 3, conditions: [], lastReport: "2m ago", reporter: "Tony B." },
  { id: 5, type: "beginner", stacks: 0, conditions: ["windy"], lastReport: "8m ago", reporter: "Lisa M." },
  { id: 6, type: "regular", stacks: 1, conditions: [], lastReport: "6m ago", reporter: "Jen P." },
  { id: 7, type: "regular", stacks: 0, conditions: [], lastReport: "10m ago", reporter: "Ray S." },
  { id: 8, type: "challenge", stacks: 2, conditions: ["windy"], lastReport: "4m ago", reporter: "Chris W." },
];

const WEATHER = { temp: 72, high: 78, low: 61, wind: 12, icon: "Sun" };
const COURT_HOURS = { open: "6:00 AM", close: "9:00 PM" };

const STATUS_MAP = (stacks) => {
  if (stacks === 0) return { label: "Open", color: C.green, bg: C.greenLight };
  if (stacks === 1) return { label: "1 Stack", color: C.yellow, bg: C.yellowLight };
  if (stacks === 2) return { label: "2 Stacks", color: C.orange, bg: C.orangeLight };
  return { label: stacks + " Stacks", color: C.red, bg: C.redLight };
};

const COURT_COLOR = (stacks) => {
  if (stacks === 0) return { fill: "#27AE6044", stroke: "#27AE60" };
  if (stacks === 1) return { fill: "#E2A61244", stroke: "#E2A612" };
  if (stacks === 2) return { fill: "#E67E2244", stroke: "#E67E22" };
  return { fill: "#E74C3C44", stroke: "#E74C3C" };
};

const CONDITION_OPTIONS = [
  { key: "windy", icon: "Wind", label: "Windy" },
  { key: "wet", icon: "Drop", label: "Wet Courts" },
  { key: "hot", icon: "Temp", label: "Hot" },
  { key: "perfect", icon: "Star", label: "Great" },
];

const makeCourtChat = (courtId) => [
  { id: 1, name: "Mike T.", text: `Court ${courtId} is playing fast today`, time: "10:15 AM", self: false },
  { id: 2, name: "Sarah K.", text: "Good games here this morning", time: "10:22 AM", self: false },
];

const INIT_MAIN_CHAT = [
  { id: 1, name: "Mike T.", text: "Courts are filling up, get here before 10 if you want to play", time: "9:42 AM", self: false },
  { id: 2, name: "Sarah K.", text: "Heading over now, anyone need a partner?", time: "9:45 AM", self: false },
  { id: 3, name: "Dave R.", text: "Challenge courts are running hot today. Good competition", time: "9:51 AM", self: false },
  { id: 4, name: "Lisa M.", text: "Sprinklers hit court 5 area, a little wet near the baseline but playable", time: "10:02 AM", self: false },
  { id: 5, name: "Jen P.", text: "Just left, courts 6 and 7 are about to open up", time: "10:18 AM", self: false },
  { id: 6, name: "Tony B.", text: "Good morning everyone. Wind is picking up a bit, heads up if you're coming", time: "10:25 AM", self: false },
];

const OVERALL_LEVELS = [
  { key: "empty", label: "Empty", desc: "No one playing", color: C.green },
  { key: "half-play", label: "Half Playing", desc: "About half the courts in use", color: C.yellow },
  { key: "all-play", label: "All Playing", desc: "Every court in use, no wait", color: C.orange },
  { key: "1-stack-half", label: "1 Stack / Half", desc: "1 stack waiting at half the courts", color: C.orange },
  { key: "1-stack-all", label: "1 Stack / All", desc: "1 stack waiting at every court", color: C.red },
  { key: "2-stack", label: "2+ Stacks", desc: "2 or more stacks deep", color: C.red },
];

const INIT_REPORTS = [
  { id: 1, user: "Tony B.", time: "10:25 AM", level: "all-play", conditions: ["windy"], text: "Every court running, wind picking up from the east" },
  { id: 2, user: "Lisa M.", time: "9:50 AM", level: "half-play", conditions: ["wet"], text: "Courts 4-5 side still damp from sprinklers" },
  { id: 3, user: "Dave R.", time: "9:30 AM", level: "half-play", conditions: [], text: "Steady morning crowd, should fill up by 10" },
];

// AI Prediction data — hourly busyness forecast per day of week
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AI_PREDICTIONS_BY_DAY = {
  Mon: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 0 }, { hour: "8A", level: 1 },
    { hour: "9A", level: 2 }, { hour: "10A", level: 2 }, { hour: "11A", level: 3 },
    { hour: "12P", level: 2 }, { hour: "1P", level: 2 }, { hour: "2P", level: 1 },
    { hour: "3P", level: 1 }, { hour: "4P", level: 2 }, { hour: "5P", level: 3 },
    { hour: "6P", level: 2 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Tue: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 1 }, { hour: "8A", level: 2 },
    { hour: "9A", level: 3 }, { hour: "10A", level: 3 }, { hour: "11A", level: 3 },
    { hour: "12P", level: 2 }, { hour: "1P", level: 2 }, { hour: "2P", level: 1 },
    { hour: "3P", level: 1 }, { hour: "4P", level: 2 }, { hour: "5P", level: 2 },
    { hour: "6P", level: 1 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Wed: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 0 }, { hour: "8A", level: 1 },
    { hour: "9A", level: 2 }, { hour: "10A", level: 3 }, { hour: "11A", level: 3 },
    { hour: "12P", level: 3 }, { hour: "1P", level: 2 }, { hour: "2P", level: 2 },
    { hour: "3P", level: 1 }, { hour: "4P", level: 2 }, { hour: "5P", level: 3 },
    { hour: "6P", level: 2 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Thu: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 1 }, { hour: "8A", level: 2 },
    { hour: "9A", level: 2 }, { hour: "10A", level: 3 }, { hour: "11A", level: 3 },
    { hour: "12P", level: 2 }, { hour: "1P", level: 2 }, { hour: "2P", level: 1 },
    { hour: "3P", level: 2 }, { hour: "4P", level: 3 }, { hour: "5P", level: 3 },
    { hour: "6P", level: 2 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Fri: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 0 }, { hour: "8A", level: 1 },
    { hour: "9A", level: 2 }, { hour: "10A", level: 3 }, { hour: "11A", level: 3 },
    { hour: "12P", level: 3 }, { hour: "1P", level: 3 }, { hour: "2P", level: 2 },
    { hour: "3P", level: 2 }, { hour: "4P", level: 3 }, { hour: "5P", level: 3 },
    { hour: "6P", level: 2 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Sat: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 1 }, { hour: "8A", level: 2 },
    { hour: "9A", level: 3 }, { hour: "10A", level: 4 }, { hour: "11A", level: 4 },
    { hour: "12P", level: 4 }, { hour: "1P", level: 3 }, { hour: "2P", level: 2 },
    { hour: "3P", level: 2 }, { hour: "4P", level: 3 }, { hour: "5P", level: 3 },
    { hour: "6P", level: 2 }, { hour: "7P", level: 1 }, { hour: "8P", level: 0 },
  ],
  Sun: [
    { hour: "6A", level: 0 }, { hour: "7A", level: 1 }, { hour: "8A", level: 2 },
    { hour: "9A", level: 3 }, { hour: "10A", level: 4 }, { hour: "11A", level: 4 },
    { hour: "12P", level: 3 }, { hour: "1P", level: 3 }, { hour: "2P", level: 2 },
    { hour: "3P", level: 1 }, { hour: "4P", level: 2 }, { hour: "5P", level: 2 },
    { hour: "6P", level: 1 }, { hour: "7P", level: 0 }, { hour: "8P", level: 0 },
  ],
};

const PREDICTION_COLORS = [
  C.green,      // 0 - Empty
  "#7BC67E",    // 1 - Light
  C.yellow,     // 2 - Moderate
  C.orange,     // 3 - Busy
  C.red,        // 4 - Packed
];

// ─── SVG Icons ───
const Icons = {
  Sun: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Wind: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>,
  Drop: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>,
  Temp: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>,
  Star: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  Nav: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  Clock: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Back: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Send: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  Home: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1V10"/></svg>,
  Chat: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Report: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Alert: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Plus: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Brain: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a6 6 0 016 6c0 2.5-1.5 4.5-3 5.5V16h-6v-2.5C7.5 12.5 6 10.5 6 8a6 6 0 016-6z"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,
};

const CondIcon = ({ type, size = 16 }) => {
  const fn = Icons[type];
  return fn ? fn(size) : null;
};

const FontLoader = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap');`}</style>
);

// ─── CourtPulse Banner ───
const Banner = () => (
  <div style={{
    background: `linear-gradient(135deg, ${C.banner} 0%, #264D73 100%)`,
    padding: "14px 18px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.2)",
      }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", padding: "5px 10px", borderRadius: 8 }}>
        <span style={{ color: "#F0C040" }}>{Icons.Sun(14)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{WEATHER.temp}°</span>
      </div>
    </div>
  </div>
);

// ─── Court Map (clean — color coded only, no text labels) ───
const CourtMap = ({ courts, onCourtTap }) => {
  const w = 380;
  const h = 250;
  const cW = 76;
  const cH = 82;
  const gap = 10;
  const startX = (w - (cW * 4 + gap * 3)) / 2;
  const topY = 22;
  const botY = topY + cH + 30;

  const positions = [
    { id: 1, row: 0, col: 0 }, { id: 2, row: 0, col: 1 }, { id: 3, row: 0, col: 2 }, { id: 4, row: 0, col: 3 },
    { id: 5, row: 1, col: 0 }, { id: 6, row: 1, col: 1 }, { id: 7, row: 1, col: 2 }, { id: 8, row: 1, col: 3 },
  ];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <rect x="0" y="0" width={w} height={h} rx="14" fill="#2D5A27" opacity="0.08" />
      <rect x="4" y="4" width={w - 8} height={h - 8} rx="12" fill="#3A7233" opacity="0.04" />

      {/* Center divider */}
      <line x1={startX - 6} y1={topY + cH + 15} x2={startX + cW * 4 + gap * 3 + 6} y2={topY + cH + 15}
        stroke="#5A6270" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.18" />
      <text x={w / 2} y={topY + cH + 12} textAnchor="middle" fontSize="7.5" fill="#5A6270" fontFamily={ff} opacity="0.45" fontWeight="600">NET DIVIDERS</text>

      {/* Entrance */}
      <text x={w / 2} y={h - 5} textAnchor="middle" fontSize="8" fill="#5A6270" fontFamily={ff} opacity="0.45" fontWeight="600">ENTRANCE</text>
      <path d={`M${w / 2 - 18} ${h - 13} L${w / 2} ${h - 9} L${w / 2 + 18} ${h - 13}`} stroke="#5A6270" strokeWidth="1" fill="none" opacity="0.2" />

      {positions.map(pos => {
        const court = courts.find(c => c.id === pos.id);
        const x = startX + pos.col * (cW + gap);
        const y = pos.row === 0 ? topY : botY;
        const cc = COURT_COLOR(court.stacks);
        const hasCond = court.conditions.length > 0;
        const typeLabel = court.type === "beginner" ? "BEGINNER" : court.type === "challenge" ? "CHALLENGE" : null;
        const typeColor = court.type === "beginner" ? "#6C63FF" : court.type === "challenge" ? "#D4540E" : null;

        return (
          <g key={court.id} onClick={() => onCourtTap(court.id)} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={cW} height={cH} rx="7" fill={cc.fill} stroke={cc.stroke} strokeWidth="2.5" />
            {/* Inner court lines */}
            <line x1={x + 5} y1={y + cH / 2} x2={x + cW - 5} y2={y + cH / 2} stroke={cc.stroke} strokeWidth="0.7" opacity="0.3" />
            <rect x={x + cW * 0.18} y={y + cH * 0.18} width={cW * 0.64} height={cH * 0.64} rx="3" fill="none" stroke={cc.stroke} strokeWidth="0.5" opacity="0.2" />

            {/* Court number */}
            <text x={x + cW / 2} y={y + cH / 2 + (typeLabel ? 0 : 5)} textAnchor="middle" fontSize="16" fontWeight="800" fill={cc.stroke} fontFamily={ff}>{court.id}</text>

            {/* Court type label for beginner/challenge */}
            {typeLabel && (
              <g>
                <rect x={x + 8} y={y + cH / 2 + 7} width={cW - 16} height={15} rx="4" fill={typeColor} opacity="0.15" />
                <text x={x + cW / 2} y={y + cH / 2 + 18} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={typeColor} fontFamily={ff} opacity="0.9">{typeLabel}</text>
              </g>
            )}

            {/* Condition dot */}
            {hasCond && <circle cx={x + cW - 9} cy={y + 9} r="4.5" fill={C.yellow} stroke="#fff" strokeWidth="1.5" />}
          </g>
        );
      })}
    </svg>
  );
};

// ─── AI Prediction Timeline (day-of-week navigable) ───
const PredictionTimeline = () => {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6
  const [selectedDay, setSelectedDay] = useState(todayIdx);

  const dayKey = DAYS_OF_WEEK[selectedDay];
  const predictions = AI_PREDICTIONS_BY_DAY[dayKey];
  const isToday = selectedDay === todayIdx;

  const now = new Date();
  const currentHour = now.getHours();
  const nowIdx = isToday ? predictions.findIndex((p) => {
    const h = parseInt(p.hour);
    const isPM = p.hour.includes("P");
    const h24 = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
    return h24 >= currentHour;
  }) : -1;

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "14px 14px 12px", border: `1px solid ${C.border}`, margin: "12px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ color: C.primary }}>{Icons.Brain(15)}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>AI Predicted Busyness</span>
      </div>

      {/* Day-of-week selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {DAYS_OF_WEEK.map((d, i) => {
          const active = i === selectedDay;
          const today = i === todayIdx;
          return (
            <button key={d} onClick={() => setSelectedDay(i)}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 8,
                border: active ? `2px solid ${C.primary}` : today ? `1.5px solid ${C.primary}44` : `1px solid ${C.border}`,
                background: active ? C.primaryLight : C.card,
                cursor: "pointer", fontFamily: ff,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 600, color: active ? C.primary : today ? C.primary : C.sub }}>{d}</span>
              {today && <div style={{ width: 4, height: 4, borderRadius: 2, background: C.primary, marginTop: 1 }} />}
            </button>
          );
        })}
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 56, marginBottom: 4 }}>
        {predictions.map((p, i) => {
          const barH = p.level === 0 ? 8 : 12 + (p.level * 11);
          const isNow = i === nowIdx;
          return (
            <div key={p.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: "100%",
                height: barH,
                borderRadius: 3,
                background: PREDICTION_COLORS[p.level],
                opacity: isNow ? 1 : 0.55,
                border: isNow ? `2px solid ${C.text}` : "none",
                boxSizing: "border-box",
                transition: "all 0.2s",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {predictions.map((p, i) => (
          <div key={p.hour + "l"} style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 8, color: C.muted, fontWeight: 500 }}>{i % 2 === 0 ? p.hour : ""}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
        {[
          { label: "Empty", color: PREDICTION_COLORS[0] },
          { label: "Light", color: PREDICTION_COLORS[1] },
          { label: "Moderate", color: PREDICTION_COLORS[2] },
          { label: "Busy", color: PREDICTION_COLORS[3] },
          { label: "Packed", color: PREDICTION_COLORS[4] },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 9, color: C.muted, fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Stack Stepper (+/-) ───
const StackStepper = ({ value, onChange }) => {
  const st = STATUS_MAP(value);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "12px 0" }}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        style={{
          width: 52, height: 52, borderRadius: 14,
          background: value === 0 ? C.bg : C.card,
          border: `2px solid ${value === 0 ? C.border : C.primary}`,
          cursor: value === 0 ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: value === 0 ? C.muted : C.primary,
          fontFamily: ff,
        }}
      >{Icons.Minus(22)}</button>
      <div style={{ textAlign: "center", minWidth: 90 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: st.color, lineHeight: 1, fontFamily: ff }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: st.color, marginTop: 4 }}>{st.label}</div>
      </div>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 52, height: 52, borderRadius: 14,
          background: C.card,
          border: `2px solid ${C.primary}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.primary,
          fontFamily: ff,
        }}
      >{Icons.Plus(22)}</button>
    </div>
  );
};

// ─── Sign Up Screen ───
const SignUpScreen = ({ onJoin }) => {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const inputStyle = {
    width: "100%", padding: "14px 16px", borderRadius: 12,
    border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff,
    color: C.text, background: C.card, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", maxHeight: 932,
      background: C.bg, fontFamily: ff, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box",
    }}>
      <FontLoader />
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: `linear-gradient(135deg, ${C.banner} 0%, #264D73 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20, boxShadow: "0 8px 24px rgba(26,58,92,0.25)",
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="6" fill="#27AE60" opacity="0.9"/>
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeDasharray="3,3"/>
          <circle cx="12" cy="12" r="2" fill="white"/>
        </svg>
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", marginBottom: 4 }}>CourtPulse</div>
      <p style={{ fontSize: 15, color: C.sub, marginBottom: 32, textAlign: "center", lineHeight: 1.4 }}>
        Real-time court status for<br/>Marine Park pickleball
      </p>

      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6, paddingLeft: 2 }}>Your Name</label>
          <input type="text" placeholder="First name & last initial" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6, paddingLeft: 2 }}>Phone or Email</label>
          <input type="text" placeholder="For notifications (optional)" value={contact} onChange={e => setContact(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <button
        onClick={() => { if (name.trim()) onJoin(name.trim()); }}
        disabled={!name.trim()}
        style={{
          width: "100%", maxWidth: 320, padding: "16px",
          borderRadius: 14, border: "none",
          background: name.trim() ? `linear-gradient(135deg, ${C.banner} 0%, #264D73 100%)` : C.border,
          color: name.trim() ? "#fff" : C.muted,
          fontSize: 17, fontWeight: 700, fontFamily: ff,
          cursor: name.trim() ? "pointer" : "default",
          boxShadow: name.trim() ? "0 4px 16px rgba(26,58,92,0.3)" : "none",
        }}
      >
        Join Marine Park
      </button>

      <p style={{ fontSize: 12, color: C.muted, marginTop: 16, textAlign: "center", lineHeight: 1.4 }}>
        By joining, you agree to keep reports<br/>accurate and respect other players.
      </p>
    </div>
  );
};


// ─── Main App ───
export default function CourtPulse() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("AJ");
  const [tab, setTab] = useState("home");
  const [courts, setCourts] = useState(INIT_COURTS);
  const [mainChat, setMainChat] = useState(INIT_MAIN_CHAT);
  const [courtChats, setCourtChats] = useState(() => {
    const obj = {};
    INIT_COURTS.forEach(c => { obj[c.id] = makeCourtChat(c.id); });
    return obj;
  });
  const [chatInput, setChatInput] = useState("");
  const [reports, setReports] = useState(INIT_REPORTS);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [courtChatInput, setCourtChatInput] = useState("");
  const [showCourtReport, setShowCourtReport] = useState(false);
  const [reportStacks, setReportStacks] = useState(0);

  const [reportConditions, setReportConditions] = useState([]);
  const [parkReportLevel, setParkReportLevel] = useState(null);
  const [parkReportConditions, setParkReportConditions] = useState([]);
  const [parkReportText, setParkReportText] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  const chatEndRef = useRef(null);
  const courtChatEndRef = useRef(null);

  useEffect(() => {
    if (tab === "chat" && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [tab, mainChat]);

  useEffect(() => {
    if (selectedCourt && courtChatEndRef.current) courtChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [selectedCourt, courtChats]);

  const sendMainChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMainChat(p => [...p, { id: Date.now(), name: "You", text: chatInput.trim(), time, self: true }]);
    setChatInput("");
  }, [chatInput]);

  const sendCourtChat = useCallback(() => {
    if (!courtChatInput.trim() || !selectedCourt) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setCourtChats(p => ({
      ...p,
      [selectedCourt]: [...(p[selectedCourt] || []), { id: Date.now(), name: "You", text: courtChatInput.trim(), time, self: true }]
    }));
    setCourtChatInput("");
  }, [courtChatInput, selectedCourt]);

  const submitCourtReport = useCallback(() => {
    if (!selectedCourt) return;
    setCourts(p => p.map(c => c.id === selectedCourt
      ? { ...c, stacks: reportStacks, conditions: reportConditions, lastReport: "Just now", reporter: userName }
      : c
    ));
    setReportSuccess(true);
    setTimeout(() => { setShowCourtReport(false); setReportStacks(0); setReportConditions([]); setReportSuccess(false); }, 900);
  }, [reportStacks, reportConditions, selectedCourt, userName]);

  const submitParkReport = useCallback(() => {
    if (!parkReportLevel) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setReports(p => [{ id: Date.now(), user: userName, time, level: parkReportLevel, conditions: parkReportConditions, text: parkReportText }, ...p]);
    setReportSuccess(true);
    setTimeout(() => { setParkReportLevel(null); setParkReportConditions([]); setParkReportText(""); setReportSuccess(false); }, 1200);
  }, [parkReportLevel, parkReportConditions, parkReportText, userName]);

  const activeConditions = [...new Set(courts.flatMap(c => c.conditions))];

  // ─── Sign Up Gate ───
  if (!loggedIn) {
    return <SignUpScreen onJoin={(name) => { setUserName(name); setLoggedIn(true); }} />;
  }

  // ─── Court Detail View ───
  if (selectedCourt) {
    const court = courts.find(c => c.id === selectedCourt);
    const st = STATUS_MAP(court.stacks);
    const typeInfo = COURT_TYPES[court.type];
    const msgs = courtChats[selectedCourt] || [];

    return (
      <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", maxHeight: 932, background: C.bg, fontFamily: ff, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <FontLoader />
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", background: C.card, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setSelectedCourt(null); setShowCourtReport(false); setReportStacks(0); setReportConditions([]); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.primary, display: "flex" }}>{Icons.Back()}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Court {court.id}</div>
            <div style={{ fontSize: 12, color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label} · {typeInfo.sub}</div>
          </div>
          <div style={{ background: st.bg, color: st.color, fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${st.color}33` }}>{st.label}</div>
        </div>

        {court.conditions.length > 0 && (
          <div style={{ padding: "8px 16px", background: C.yellowLight, display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            {Icons.Alert(13)}<span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{court.conditions.map(c => CONDITION_OPTIONS.find(o => o.key === c)?.label).join(", ")}</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{court.lastReport}</span>
          </div>
        )}

        {/* Toggle */}
        <div style={{ display: "flex", padding: "10px 16px", gap: 8, background: C.card, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setShowCourtReport(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: !showCourtReport ? C.primary : C.bg, color: !showCourtReport ? "#fff" : C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Chat</button>
          <button onClick={() => setShowCourtReport(true)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: showCourtReport ? C.primary : C.bg, color: showCourtReport ? "#fff" : C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Report</button>
        </div>

        {!showCourtReport ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: C.muted, background: C.bg, padding: "4px 12px", borderRadius: 16 }}>Court {court.id} · {typeInfo.label}</span>
              </div>
              {msgs.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.self ? "flex-end" : "flex-start", marginBottom: 10 }}>
                  <div style={{ maxWidth: "78%" }}>
                    {!m.self && <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 3, paddingLeft: 10 }}>{m.name}</div>}
                    <div style={{ background: m.self ? C.chatSelf : C.chatOther, color: m.self ? "#fff" : C.text, borderRadius: m.self ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 15px", fontSize: 15, lineHeight: 1.45, fontFamily: ff, border: m.self ? "none" : `1px solid ${C.border}` }}>{m.text}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: m.self ? "right" : "left", padding: "0 10px" }}>{m.time}</div>
                  </div>
                </div>
              ))}
              <div ref={courtChatEndRef} />
            </div>
            <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", gap: 10 }}>
              <input type="text" placeholder={`Message Court ${court.id}...`} value={courtChatInput} onChange={e => setCourtChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendCourtChat(); }}
                style={{ flex: 1, padding: "12px 16px", borderRadius: 22, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff, color: C.text, background: C.bg, outline: "none" }} />
              <button onClick={sendCourtChat} disabled={!courtChatInput.trim()}
                style={{ width: 44, height: 44, borderRadius: 22, background: courtChatInput.trim() ? C.primary : C.border, border: "none", cursor: courtChatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{Icons.Send(18)}</button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
            {reportSuccess ? (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: C.green, fontSize: 28 }}>&#10003;</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>Court {court.id} Updated</div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>Stacks waiting</p>
                <StackStepper value={reportStacks} onChange={setReportStacks} />

                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "18px 0 12px" }}>Conditions (optional)</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 28 }}>
                  {CONDITION_OPTIONS.map(c => {
                    const active = reportConditions.includes(c.key);
                    return (
                      <button key={c.key} onClick={() => setReportConditions(p => p.includes(c.key) ? p.filter(k => k !== c.key) : [...p, c.key])}
                        style={{ padding: "12px 4px", borderRadius: 12, border: active ? `2.5px solid ${C.primary}` : `1.5px solid ${C.border}`, background: active ? C.primaryLight : C.card, cursor: "pointer", fontFamily: ff, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <span style={{ color: active ? C.primary : C.muted }}><CondIcon type={c.icon} size={20} /></span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.primary : C.sub }}>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={submitCourtReport}
                  style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: C.primary, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: ff, cursor: "pointer" }}>
                  Update Court {court.id}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Main Shell ───
  return (
    <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", maxHeight: 932, background: C.bg, fontFamily: ff, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <FontLoader />
      <Banner />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: 80 }}>

        {/* ═══ HOME ═══ */}
        {tab === "home" && (
          <div>
            <div style={{ padding: "12px 18px 14px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Pickleball Courts · Brooklyn, NY</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href="https://maps.google.com/?q=Marine+Park+Pickleball+Courts+Brooklyn+NY" target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 5, background: C.primaryLight, padding: "7px 12px", borderRadius: 10, textDecoration: "none", color: C.primary, fontSize: 12, fontWeight: 600 }}>
                    {Icons.Nav(13)} Directions
                  </a>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.bg, padding: "6px 10px", borderRadius: 8 }}>
                  <span style={{ color: C.muted }}>{Icons.Clock(13)}</span>
                  <span style={{ fontSize: 12, color: C.sub, fontWeight: 500 }}>{COURT_HOURS.open} – {COURT_HOURS.close}</span>
                </div>
              </div>
            </div>

            {activeConditions.length > 0 && (
              <div style={{ margin: "12px 16px 0", padding: "10px 14px", background: C.yellowLight, borderRadius: 12, display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.yellow}33` }}>
                <span style={{ color: C.yellow }}>{Icons.Alert(15)}</span>
                <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>Active: {activeConditions.map(c => CONDITION_OPTIONS.find(o => o.key === c)?.label).join(", ")}</span>
              </div>
            )}

            {/* Court Map */}
            <div style={{ margin: "12px 16px 0", background: C.card, borderRadius: 16, padding: "14px 12px 10px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Courts Right Now</span>
                <span style={{ fontSize: 11, color: C.muted }}>Tap for details</span>
              </div>
              <CourtMap courts={courts} onCourtTap={(id) => setSelectedCourt(id)} />
              {/* Color legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                {[{ l: "Open", c: C.green }, { l: "1 Stack", c: C.yellow }, { l: "2 Stacks", c: C.orange }, { l: "3+", c: C.red }].map(i => (
                  <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: i.c + "44", border: `2px solid ${i.c}` }} />
                    <span style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>{i.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Predictions Timeline */}
            <PredictionTimeline />

            {/* Live summary cards */}
            <div style={{ display: "flex", gap: 10, margin: "12px 16px 0" }}>
              <div style={{ flex: 1, background: C.greenLight, borderRadius: 14, padding: "14px", border: `1px solid ${C.green}22` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>Live Reports</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{courts.filter(c => c.stacks === 0).length} Open</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{courts.filter(c => c.stacks > 0).length} courts with waits</div>
              </div>
              <div style={{ flex: 1, background: C.primaryLight, borderRadius: 14, padding: "14px", border: `1px solid ${C.primary}22` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 4 }}>Best Time</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.primary }}>2 PM</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Crowd thins after lunch</div>
              </div>
            </div>

            {/* Latest Reports */}
            <div style={{ margin: "14px 16px 0", paddingBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Latest Reports</span>
              {reports.slice(0, 2).map(r => (
                <div key={r.id} style={{ background: C.card, borderRadius: 12, padding: "12px 14px", marginTop: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.user}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{r.time}</span>
                  </div>
                  {r.text && <p style={{ fontSize: 14, color: C.sub, margin: "6px 0 0", lineHeight: 1.4 }}>{r.text}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: OVERALL_LEVELS.find(l => l.key === r.level)?.color + "18", color: OVERALL_LEVELS.find(l => l.key === r.level)?.color }}>{OVERALL_LEVELS.find(l => l.key === r.level)?.label}</span>
                    {r.conditions.map(c => (
                      <span key={c} style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: C.bg, color: C.sub }}>{CONDITION_OPTIONS.find(o => o.key === c)?.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ REPORT (form auto-shown) ═══ */}
        {tab === "report" && (
          <div style={{ padding: "16px" }}>
            {/* Report Form — always visible */}
            <div style={{ background: C.card, borderRadius: 16, padding: "18px 16px", border: `1px solid ${C.border}`, marginBottom: 16 }}>
              {reportSuccess ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 28, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: C.green, fontSize: 24 }}>&#10003;</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>Report Submitted</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Thanks for keeping everyone updated</div>
                </div>
              ) : (
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 16px" }}>Report Park Conditions</h3>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>How packed is it?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                    {OVERALL_LEVELS.map(l => {
                      const active = parkReportLevel === l.key;
                      return (
                        <button key={l.key} onClick={() => setParkReportLevel(l.key)}
                          style={{ padding: "11px 14px", borderRadius: 12, border: active ? `2.5px solid ${l.color}` : `1.5px solid ${C.border}`, background: active ? l.color + "12" : C.card, cursor: "pointer", fontFamily: ff, display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: l.color, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: active ? l.color : C.text }}>{l.label}</div>
                            <div style={{ fontSize: 12, color: C.muted }}>{l.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>Conditions (optional)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
                    {CONDITION_OPTIONS.map(c => {
                      const active = parkReportConditions.includes(c.key);
                      return (
                        <button key={c.key} onClick={() => setParkReportConditions(p => p.includes(c.key) ? p.filter(k => k !== c.key) : [...p, c.key])}
                          style={{ padding: "12px 4px", borderRadius: 12, border: active ? `2.5px solid ${C.primary}` : `1.5px solid ${C.border}`, background: active ? C.primaryLight : C.card, cursor: "pointer", fontFamily: ff, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          <span style={{ color: active ? C.primary : C.muted }}><CondIcon type={c.icon} size={20} /></span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.primary : C.sub }}>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>Add a note (optional)</p>
                  <textarea value={parkReportText} onChange={e => setParkReportText(e.target.value)} placeholder="Wind from the east, courts are dry..."
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: ff, color: C.text, background: C.bg, resize: "none", height: 64, outline: "none", boxSizing: "border-box" }} />
                  <button onClick={submitParkReport} disabled={!parkReportLevel}
                    style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", marginTop: 14, background: parkReportLevel ? C.primary : C.border, color: parkReportLevel ? "#fff" : C.muted, fontSize: 16, fontWeight: 700, fontFamily: ff, cursor: parkReportLevel ? "pointer" : "default" }}>
                    Submit Report
                  </button>
                </>
              )}
            </div>

            {/* Past reports below */}
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recent Reports</div>
            {reports.map(r => (
              <div key={r.id} style={{ background: C.card, borderRadius: 14, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.user}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{r.time}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 7, background: OVERALL_LEVELS.find(l => l.key === r.level)?.color + "18", color: OVERALL_LEVELS.find(l => l.key === r.level)?.color }}>{OVERALL_LEVELS.find(l => l.key === r.level)?.label}</span>
                  {r.conditions.map(c => (
                    <span key={c} style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 7, background: C.bg, color: C.sub, border: `1px solid ${C.border}` }}>{CONDITION_OPTIONS.find(o => o.key === c)?.label}</span>
                  ))}
                </div>
                {r.text && <p style={{ fontSize: 13, color: C.sub, margin: "6px 0 0", lineHeight: 1.4 }}>{r.text}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ═══ CHAT ═══ */}
        {tab === "chat" && (
          <div style={{ padding: "16px 16px 60px" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: C.muted, background: C.card, padding: "5px 14px", borderRadius: 16, border: `1px solid ${C.border}` }}>Marine Park Community</span>
            </div>
            {mainChat.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.self ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <div style={{ maxWidth: "78%" }}>
                  {!m.self && <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 3, paddingLeft: 10 }}>{m.name}</div>}
                  <div style={{ background: m.self ? C.chatSelf : C.chatOther, color: m.self ? "#fff" : C.text, borderRadius: m.self ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 15px", fontSize: 15, lineHeight: 1.45, fontFamily: ff, border: m.self ? "none" : `1px solid ${C.border}` }}>{m.text}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: m.self ? "right" : "left", padding: "0 10px" }}>{m.time}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      {tab === "chat" && (
        <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, padding: "10px 16px", background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <input type="text" placeholder="Message Marine Park..." value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendMainChat(); }}
            style={{ flex: 1, padding: "12px 16px", borderRadius: 22, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: ff, color: C.text, background: C.bg, outline: "none" }} />
          <button onClick={sendMainChat} disabled={!chatInput.trim()}
            style={{ width: 44, height: 44, borderRadius: 22, background: chatInput.trim() ? C.primary : C.border, border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{Icons.Send(18)}</button>
        </div>
      )}

      {/* Tab Bar — 3 tabs: Home, Report, Chat */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", alignItems: "center", paddingBottom: 4 }}>
        {[
          { key: "home", label: "Home", icon: Icons.Home },
          { key: "report", label: "Report", icon: Icons.Report },
          { key: "chat", label: "Chat", icon: Icons.Chat, badge: 3 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 20px", position: "relative" }}>
            <span style={{ color: tab === t.key ? C.primary : C.muted }}>{t.icon()}</span>
            <span style={{ fontSize: 11, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.primary : C.muted }}>{t.label}</span>
            {t.badge && tab !== t.key && (
              <div style={{ position: "absolute", top: 0, right: 10, width: 16, height: 16, borderRadius: 8, background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.badge}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
