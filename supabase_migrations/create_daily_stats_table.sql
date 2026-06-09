-- Daily stats for per-day activity tracking (accuracy trend + heatmap)
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id           BIGSERIAL PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  questions    int  NOT NULL DEFAULT 0,
  correct      int  NOT NULL DEFAULT 0,
  time_spent   int  NOT NULL DEFAULT 0,  -- minutes
  battles      int  NOT NULL DEFAULT 0,
  battles_won  int  NOT NULL DEFAULT 0,
  exam_type    text NOT NULL DEFAULT 'neet',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, exam_type)
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own rows
CREATE POLICY "Users read own daily stats"
  ON public.daily_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own daily stats"
  ON public.daily_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own daily stats"
  ON public.daily_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_daily_stats_user_date ON public.daily_stats(user_id, date DESC);
CREATE INDEX idx_daily_stats_exam ON public.daily_stats(user_id, exam_type);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_daily_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_stats_updated_at
  BEFORE UPDATE ON public.daily_stats
  FOR EACH ROW EXECUTE FUNCTION update_daily_stats_updated_at();
