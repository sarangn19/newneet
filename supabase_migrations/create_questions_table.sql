-- Questions bank for NEET + UPSC
CREATE TABLE IF NOT EXISTS public.questions (
  id BIGSERIAL PRIMARY KEY,
  subject text NOT NULL,
  chapter text NOT NULL,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option int NOT NULL CHECK (correct_option >= 0 AND correct_option <= 3),
  explanation text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium',
  source text DEFAULT '',
  exam_type text NOT NULL DEFAULT 'neet',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for fast lookups
CREATE INDEX idx_questions_subject ON public.questions(subject);
CREATE INDEX idx_questions_exam_type ON public.questions(exam_type);
CREATE INDEX idx_questions_chapter ON public.questions(chapter);
