-- ═══════════════════════════════════════════════════════════════
-- CourtPulse Database Setup
-- Paste this entire file into Supabase SQL Editor and hit Run
-- ═══════════════════════════════════════════════════════════════

-- Tables
CREATE TABLE IF NOT EXISTS parks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  total_courts INTEGER,
  hours TEXT,
  lights BOOLEAN DEFAULT false,
  surface TEXT,
  amenities TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT REFERENCES parks(id),
  label TEXT NOT NULL,
  court_number INTEGER
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id UUID REFERENCES courts(id),
  park_id TEXT REFERENCES parks(id),
  status TEXT CHECK (status IN ('open', 'in-use')),
  paddles_waiting INTEGER DEFAULT 0,
  comment TEXT,
  reporter_name TEXT DEFAULT 'Anonymous',
  reporter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT REFERENCES parks(id),
  user_name TEXT DEFAULT 'Anonymous',
  user_id TEXT,
  text TEXT NOT NULL,
  post_type TEXT DEFAULT 'comment',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT REFERENCES parks(id),
  user_name TEXT DEFAULT 'Anonymous',
  user_id TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT REFERENCES parks(id),
  name TEXT NOT NULL,
  day_of_week TEXT,
  time_range TEXT,
  event_type TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expert_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT REFERENCES parks(id),
  day_of_week INTEGER,
  hour INTEGER,
  expected_occupancy FLOAT,
  notes TEXT,
  submitted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (allows public read/write)
ALTER TABLE parks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read parks" ON parks FOR SELECT USING (true);

ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read courts" ON courts FOR SELECT USING (true);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Anyone can report" ON reports FOR INSERT WITH CHECK (true);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read feed" ON feed_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can post feed" ON feed_posts FOR INSERT WITH CHECK (true);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can chat" ON chat_messages FOR INSERT WITH CHECK (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);

ALTER TABLE expert_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read baselines" ON expert_baselines FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════
-- Seed Data: Marine Park
-- ═══════════════════════════════════════════════════════════════

INSERT INTO parks (id, name, address, total_courts, hours, lights, surface, amenities) VALUES
  ('marine-park', 'Marine Park', 'Fillmore Ave & Marine Pkwy, Brooklyn', 6, '6 AM – 9 PM', true, 'Asphalt', ARRAY['Restrooms', 'Water Fountain', 'Benches', 'Parking Lot']);

INSERT INTO courts (park_id, label, court_number) VALUES
  ('marine-park', 'Court 1', 1),
  ('marine-park', 'Court 2', 2),
  ('marine-park', 'Court 3', 3),
  ('marine-park', 'Court 4', 4),
  ('marine-park', 'Court 5', 5),
  ('marine-park', 'Court 6', 6);

INSERT INTO events (park_id, name, day_of_week, time_range, event_type) VALUES
  ('marine-park', 'Open Play Night', 'Mon', '6–8 PM', 'open'),
  ('marine-park', 'Intermediate Mixer', 'Wed', '6–8 PM', 'open'),
  ('marine-park', 'Senior Morning Play', 'Thu', '9–11 AM', 'open'),
  ('marine-park', 'Weekend Open Play', 'Sat', '8 AM–12 PM', 'open'),
  ('marine-park', 'League Matches', 'Sat', '1–4 PM', 'league'),
  ('marine-park', 'Sunday Social', 'Sun', '9 AM–1 PM', 'open');

-- Done! Now go to Database → Replication in Supabase dashboard
-- and enable real-time for: reports, feed_posts, chat_messages
