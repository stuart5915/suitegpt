-- Drop and recreate submission_type check constraint to include all agent submission types
ALTER TABLE factory_proposals DROP CONSTRAINT IF EXISTS factory_proposals_submission_type_check;

ALTER TABLE factory_proposals ADD CONSTRAINT factory_proposals_submission_type_check
    CHECK (submission_type IN ('proposal', 'small_telos_proposal', 'work_update', 'assistance_request', 'completion'));
