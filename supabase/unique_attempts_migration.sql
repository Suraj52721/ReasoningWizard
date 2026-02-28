-- Clean up duplicate attempts, keeping only the best one per user/quiz
DELETE FROM quiz_attempts
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (user_id, quiz_id) id
    FROM quiz_attempts
    ORDER BY user_id, quiz_id, score DESC, completed_at DESC
  ) as distinct_attempts
);

-- Add unique constraint
ALTER TABLE quiz_attempts
ADD CONSTRAINT unique_user_quiz_attempt UNIQUE (user_id, quiz_id);
