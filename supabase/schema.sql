-- ============================================================
-- ReasoningWizard — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quizzes" ON quizzes FOR SELECT USING (true);

-- 3. Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_option INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read questions" ON questions FOR SELECT USING (true);

-- 4. Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  time_taken_seconds INT NOT NULL DEFAULT 0,
  answers JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all attempts" ON quiz_attempts FOR SELECT USING (true);
CREATE POLICY "Users can insert own attempts" ON quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Seed some sample data
INSERT INTO quizzes (title, subject, quiz_date, duration_minutes) VALUES
  ('Maths Challenge', 'Mathematics', CURRENT_DATE, 10),
  ('Science Quiz', 'Science', CURRENT_DATE, 15),
  ('English Grammar', 'English', CURRENT_DATE, 10),
  ('History Quiz', 'History', CURRENT_DATE + 1, 12),
  ('Geography Challenge', 'Geography', CURRENT_DATE + 1, 10);

-- Seed questions for Maths Challenge
INSERT INTO questions (quiz_id, question_text, options, correct_option, sort_order)
SELECT q.id, vals.question_text, vals.options, vals.correct_option, vals.sort_order
FROM quizzes q, (VALUES
  ('What is 15 × 12?', '["160","170","180","190"]'::jsonb, 2, 1),
  ('Solve: 256 ÷ 16', '["14","15","16","17"]'::jsonb, 2, 2),
  ('What is the square root of 144?', '["10","11","12","13"]'::jsonb, 2, 3),
  ('What is 3⁴?', '["27","64","81","91"]'::jsonb, 2, 4),
  ('Simplify: 2/5 + 3/10', '["1/2","7/10","4/5","3/5"]'::jsonb, 1, 5),
  ('What is 20% of 350?', '["60","65","70","75"]'::jsonb, 2, 6),
  ('If x + 7 = 15, what is x?', '["6","7","8","9"]'::jsonb, 2, 7),
  ('What is the perimeter of a rectangle with length 8 and width 5?', '["24","26","28","30"]'::jsonb, 1, 8),
  ('Convert 0.75 to a fraction.', '["1/2","3/4","2/3","4/5"]'::jsonb, 1, 9),
  ('What is the next prime number after 19?', '["21","22","23","25"]'::jsonb, 2, 10)
) AS vals(question_text, options, correct_option, sort_order)
WHERE q.title = 'Maths Challenge';

-- Seed questions for Science Quiz
INSERT INTO questions (quiz_id, question_text, options, correct_option, sort_order)
SELECT q.id, vals.question_text, vals.options, vals.correct_option, vals.sort_order
FROM quizzes q, (VALUES
  ('What is the chemical symbol for water?', '["H2O","CO2","NaCl","O2"]'::jsonb, 0, 1),
  ('What planet is known as the Red Planet?', '["Venus","Mars","Jupiter","Saturn"]'::jsonb, 1, 2),
  ('What is the powerhouse of the cell?', '["Nucleus","Ribosome","Mitochondria","Chloroplast"]'::jsonb, 2, 3),
  ('What gas do plants absorb from the atmosphere?', '["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"]'::jsonb, 2, 4),
  ('What is the boiling point of water in °C?', '["90","95","100","105"]'::jsonb, 2, 5),
  ('Which element has the atomic number 1?', '["Helium","Hydrogen","Lithium","Carbon"]'::jsonb, 1, 6),
  ('What type of energy does the Sun produce?', '["Kinetic","Chemical","Nuclear","Thermal"]'::jsonb, 2, 7),
  ('What is the SI unit of force?', '["Joule","Watt","Newton","Pascal"]'::jsonb, 2, 8)
) AS vals(question_text, options, correct_option, sort_order)
WHERE q.title = 'Science Quiz';

-- Seed questions for English Grammar
INSERT INTO questions (quiz_id, question_text, options, correct_option, sort_order)
SELECT q.id, vals.question_text, vals.options, vals.correct_option, vals.sort_order
FROM quizzes q, (VALUES
  ('Which is a proper noun?', '["city","london","river","mountain"]'::jsonb, 1, 1),
  ('Choose the correct spelling:', '["recieve","receive","receve","receeve"]'::jsonb, 1, 2),
  ('What is the past tense of "run"?', '["runned","running","ran","runed"]'::jsonb, 2, 3),
  ('"She sings beautifully." What part of speech is "beautifully"?', '["Adjective","Adverb","Noun","Verb"]'::jsonb, 1, 4),
  ('Which sentence is correct?', '["Their going home.","There going home.","They''re going home.","Theyre going home."]'::jsonb, 2, 5),
  ('What is the plural of "child"?', '["childs","childrens","children","childes"]'::jsonb, 2, 6),
  ('Identify the conjunction: "I like tea and coffee."', '["I","like","tea","and"]'::jsonb, 3, 7),
  ('Which word is an antonym of "brave"?', '["bold","cowardly","strong","fearless"]'::jsonb, 1, 8)
) AS vals(question_text, options, correct_option, sort_order)
WHERE q.title = 'English Grammar';
