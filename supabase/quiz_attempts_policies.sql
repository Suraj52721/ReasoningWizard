-- Enable UPDATE and DELETE for own attempts
DROP POLICY IF EXISTS "Users can update own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users can delete own attempts" ON quiz_attempts;

CREATE POLICY "Users can update own attempts" ON quiz_attempts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own attempts" ON quiz_attempts FOR DELETE USING (auth.uid() = user_id);
