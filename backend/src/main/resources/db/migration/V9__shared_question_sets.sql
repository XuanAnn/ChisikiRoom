-- A null owner identifies a shared, application-managed question set.
ALTER TABLE question_sets ALTER COLUMN owner_id DROP NOT NULL;
