-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/ievtwzygmpluzrltzdmr/sql/new)

-- 1. Topic scores table (aggregate per-topic performance)
CREATE TABLE IF NOT EXISTS topic_scores (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  correct INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  last_attempted DATE,
  exam_type TEXT DEFAULT 'upsc',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

ALTER TABLE topic_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own topic scores"
  ON topic_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic scores"
  ON topic_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic scores"
  ON topic_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_topic_scores_user_id ON topic_scores(user_id);

-- 2. Question history table (every single attempt)
CREATE TABLE IF NOT EXISTS question_history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  time_spent INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exam_type TEXT DEFAULT 'upsc',
  subject_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE question_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own question history"
  ON question_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own question history"
  ON question_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own question history"
  ON question_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_question_history_user_id ON question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_question_history_timestamp ON question_history(timestamp DESC);
