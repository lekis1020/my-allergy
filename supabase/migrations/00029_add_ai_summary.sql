ALTER TABLE papers ADD COLUMN IF NOT EXISTS ai_summary text;

COMMENT ON COLUMN papers.ai_summary IS 'AI-generated 2-3 sentence summary in Korean, created by Gemini from abstract';
