-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to set up real-time battles
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop old tables if they exist
DROP TABLE IF EXISTS public.matchmaking_queue CASCADE;
DROP TABLE IF EXISTS public.battle_rooms CASCADE;

-- 2. Matchmaking queue — players waiting for a match
CREATE TABLE public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT 'Student',
  user_level int NOT NULL DEFAULT 1,
  user_avatar text NOT NULL DEFAULT '🧑‍🎓',
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  matched_room_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Battle rooms — the actual battle state
CREATE TABLE public.battle_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid NOT NULL REFERENCES auth.users(id),
  player2_id uuid REFERENCES auth.users(id),
  player1_name text NOT NULL DEFAULT 'Player 1',
  player2_name text DEFAULT 'Player 2',
  player1_avatar text NOT NULL DEFAULT '🧑‍🎓',
  player2_avatar text DEFAULT '🧑‍🎓',
  player1_level int NOT NULL DEFAULT 1,
  player2_level int DEFAULT 1,
  player1_score int NOT NULL DEFAULT 0,
  player2_score int NOT NULL DEFAULT 0,
  player1_current int NOT NULL DEFAULT 0,
  player2_current int NOT NULL DEFAULT 0,
  player1_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  player2_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- 4. Enable RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_rooms ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for matchmaking_queue
CREATE POLICY "Users can insert own queue entry" ON public.matchmaking_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all queue entries" ON public.matchmaking_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own queue entry" ON public.matchmaking_queue
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue entry" ON public.matchmaking_queue
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. RLS policies for battle_rooms
CREATE POLICY "Users can read rooms they are in" ON public.battle_rooms
  FOR SELECT TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can insert rooms" ON public.battle_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update their rooms" ON public.battle_rooms
  FOR UPDATE TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- 7. Function to find and match two players
CREATE OR REPLACE FUNCTION public.find_match(p_user_id uuid, p_user_name text, p_user_level int, p_user_avatar text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_waiting RECORD;
  v_room_id uuid;
  v_questions jsonb;
BEGIN
  -- Check if user is already in a room that's still active
  SELECT id INTO v_room_id FROM public.battle_rooms
    WHERE (player1_id = p_user_id OR player2_id = p_user_id)
    AND status IN ('waiting', 'playing')
    LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN jsonb_build_object('room_id', v_room_id, 'status', 'existing');
  END IF;

  -- Clean up any old queue entries for this user
  DELETE FROM public.matchmaking_queue WHERE user_id = p_user_id;

  -- Look for a waiting player (not ourselves)
  SELECT * INTO v_waiting FROM public.matchmaking_queue
    WHERE status = 'waiting' AND user_id != p_user_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

  IF v_waiting IS NOT NULL THEN
    -- Found a match! Create a battle room
    v_room_id := gen_random_uuid();

    INSERT INTO public.battle_rooms (
      id, player1_id, player2_id,
      player1_name, player2_name,
      player1_avatar, player2_avatar,
      player1_level, player2_level,
      status
    ) VALUES (
      v_room_id,
      v_waiting.user_id, p_user_id,
      v_waiting.user_name, p_user_name,
      v_waiting.user_avatar, p_user_avatar,
      v_waiting.user_level, p_user_level,
      'playing'
    );

    -- Update the waiting player's queue entry
    UPDATE public.matchmaking_queue
      SET status = 'matched', matched_room_id = v_room_id
      WHERE id = v_waiting.id;

    -- Remove matched player from queue
    DELETE FROM public.matchmaking_queue WHERE id = v_waiting.id;

    RETURN jsonb_build_object('room_id', v_room_id, 'status', 'matched');
  ELSE
    -- No match found, add to queue
    INSERT INTO public.matchmaking_queue (user_id, user_name, user_level, user_avatar)
      VALUES (p_user_id, p_user_name, p_user_level, p_user_avatar)
      ON CONFLICT (user_id) DO UPDATE SET status = 'waiting', created_at = now();

    RETURN jsonb_build_object('room_id', null, 'status', 'queued');
  END IF;
END;
$$;

-- 8. Function to submit an answer
CREATE OR REPLACE FUNCTION public.submit_battle_answer(
  p_room_id uuid,
  p_user_id uuid,
  p_question_index int,
  p_answer int,
  p_correct boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_is_p1 boolean;
  v_new_score int;
  v_new_answers jsonb;
  v_new_current int;
  v_both_done boolean;
BEGIN
  SELECT * INTO v_room FROM public.battle_rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN RETURN jsonb_build_object('error', 'Room not found'); END IF;

  v_is_p1 := (v_room.player1_id = p_user_id);

  IF v_is_p1 THEN
    v_new_score := v_room.player1_score + (CASE WHEN p_correct THEN 1 ELSE 0 END);
    v_new_answers := v_room.player1_answers || jsonb_build_object('q', p_question_index, 'a', p_answer, 'c', p_correct);
    v_new_current := p_question_index + 1;

    UPDATE public.battle_rooms SET
      player1_score = v_new_score,
      player1_answers = v_new_answers,
      player1_current = v_new_current
    WHERE id = p_room_id;
  ELSE
    v_new_score := v_room.player2_score + (CASE WHEN p_correct THEN 1 ELSE 0 END);
    v_new_answers := v_room.player2_answers || jsonb_build_object('q', p_question_index, 'a', p_answer, 'c', p_correct);
    v_new_current := p_question_index + 1;

    UPDATE public.battle_rooms SET
      player2_score = v_new_score,
      player2_answers = v_new_answers,
      player2_current = v_new_current
    WHERE id = p_room_id;
  END IF;

  -- Check if both players finished all questions
  SELECT * INTO v_room FROM public.battle_rooms WHERE id = p_room_id;
  IF v_room.player1_current >= 5 AND v_room.player2_current >= 5 THEN
    UPDATE public.battle_rooms SET
      status = 'finished',
      finished_at = now(),
      winner_id = CASE
        WHEN v_room.player1_score > v_room.player2_score THEN v_room.player1_id
        WHEN v_room.player2_score > v_room.player1_score THEN v_room.player2_id
        ELSE NULL
      END
    WHERE id = p_room_id;
  END IF;

  RETURN jsonb_build_object('score', v_new_score, 'current', v_new_current);
END;
$$;

-- 9. Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- 10. Index for fast queue lookups
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.matchmaking_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_room_status ON public.battle_rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_players ON public.battle_rooms(player1_id, player2_id);

-- ═══════════════════════════════════════════════════════════════
-- 11. Questions bank table — admins add MCQs here
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'biology')),
  chapter text NOT NULL,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option int NOT NULL CHECK (correct_option >= 0 AND correct_option <= 3),
  explanation text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read questions
CREATE POLICY "Anyone can read questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/superadmins can insert
CREATE POLICY "Admins can insert questions"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Only admins/superadmins can update
CREATE POLICY "Admins can update questions"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Only admins/superadmins can delete
CREATE POLICY "Admins can delete questions"
  ON public.questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON public.questions(subject, chapter);
