-- ═══════════════════════════════════════════════════════════════
--  klipio.io — Initial Database Schema
--
--  Tables:
--    - downloads    : Video download records
--    - analyses     : AI content analysis results
--    - profiles     : User profile extensions (Supabase Auth owns users)
--    - jobs         : Queue system for background processing
--    - rate_limits  : Rate limiting tracking
--    - dead_letter  : Permanently failed jobs for debugging
--
--  Features:
--    - Row Level Security (RLS) enabled
--    - Auto-cleanup via pg_cron
--    - Custom functions for queue management
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
--  DOWNLOADS TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    platform VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'extracting', 'downloading', 'processing', 'ready', 'failed', 'expired')),
    quality VARCHAR(16) NOT NULL DEFAULT 'hd',

    -- R2 Storage
    r2_key TEXT,
    r2_bucket VARCHAR(128),

    -- File metadata
    file_size BIGINT,
    file_name TEXT,
    mime_type VARCHAR(128),
    duration INTEGER,          -- seconds
    width INTEGER,
    height INTEGER,

    -- Video metadata
    title TEXT,
    thumbnail_url TEXT,
    author TEXT,
    description TEXT,

    -- Error tracking
    error_code VARCHAR(64),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- User tracking
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    country VARCHAR(4),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    completed_at TIMESTAMPTZ,

    -- Indexes
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for downloads
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_ip_address ON downloads(ip_address);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_expires_at ON downloads(expires_at);
CREATE INDEX IF NOT EXISTS idx_downloads_platform_status ON downloads(platform, status);

-- ═══════════════════════════════════════════════════════════════
--  ANALYSES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    download_id UUID NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,

    -- Content analysis
    content_type VARCHAR(64),
    summary TEXT,
    key_moments JSONB DEFAULT '[]',
    entities JSONB DEFAULT '[]',
    sentiment JSONB,

    -- Transcript
    transcript TEXT,
    transcript_url TEXT,

    -- Categorization
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    language VARCHAR(16),

    -- Raw results (extensible)
    results JSONB DEFAULT '{}',

    -- Performance
    processing_time_ms INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analyses
CREATE INDEX IF NOT EXISTS idx_analyses_download_id ON analyses(download_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  PROFILES TABLE (extends Supabase Auth)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,

    -- Plan & Quota
    plan VARCHAR(32) NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'enterprise')),
    downloads_count INTEGER NOT NULL DEFAULT 0,
    downloads_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    monthly_quota INTEGER NOT NULL DEFAULT 100,

    -- Billing
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- Preferences
    preferences JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
--  JOBS TABLE (Queue System)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(32) NOT NULL
        CHECK (type IN ('extract', 'download', 'analyze')),
    status VARCHAR(32) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter')),

    priority INTEGER NOT NULL DEFAULT 0,

    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,

    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    worker_id TEXT,

    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical indexes for queue performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, type);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC, created_at ASC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON jobs(worker_id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_jobs_type_status_created ON jobs(type, status, created_at);

-- ═══════════════════════════════════════════════════════════════
--  RATE_LIMITS TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    requests_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_ip_window UNIQUE (ip_address, window_start),
    CONSTRAINT unique_user_window UNIQUE (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, window_start);

-- ═══════════════════════════════════════════════════════════════
--  DEAD_LETTER TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dead_letter (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    error TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id TEXT,
    retried BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_created ON dead_letter(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_letter_retried ON dead_letter(retried) WHERE retried = FALSE;

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter ENABLE ROW LEVEL SECURITY;

-- Downloads: users can read their own; service role can do everything
CREATE POLICY downloads_select_own ON downloads
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY downloads_insert_own ON downloads
    FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY downloads_update_own ON downloads
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY downloads_service_all ON downloads
    FOR ALL USING (auth.role() = 'service_role');

-- Analyses: tied to downloads
CREATE POLICY analyses_select_own ON analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM downloads WHERE downloads.id = analyses.download_id
            AND downloads.user_id = auth.uid()
        )
    );

CREATE POLICY analyses_service_all ON analyses
    FOR ALL USING (auth.role() = 'service_role');

-- Profiles: users can only access their own
CREATE POLICY profiles_select_own ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_update_own ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY profiles_service_all ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Jobs: service role only (users poll via download status)
CREATE POLICY jobs_service_all ON jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Rate limits: service role only
CREATE POLICY rate_limits_service_all ON rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Dead letter: service role only
CREATE POLICY dead_letter_service_all ON dead_letter
    FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function: Atomically claim the next available job
CREATE OR REPLACE FUNCTION pop_job(
    job_type TEXT,
    worker_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    claimed_job JSONB;
    job_record RECORD;
BEGIN
    -- Find and lock the next available job
    SELECT * INTO job_record
    FROM jobs
    WHERE status = 'queued'
      AND type = job_type
      AND scheduled_for <= NOW()
      AND attempts < max_attempts
    ORDER BY priority DESC, scheduled_for ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Mark as processing
    UPDATE jobs
    SET status = 'processing',
        processed_at = NOW(),
        attempts = attempts + 1,
        worker_id = pop_job.worker_id,
        updated_at = NOW()
    WHERE id = job_record.id;

    -- Return the job as JSONB
    SELECT to_jsonb(jobs.*) INTO claimed_job
    FROM jobs
    WHERE id = job_record.id;

    RETURN claimed_job;
END;
$$ LANGUAGE plpgsql;

-- Function: Retry failed jobs (called by cron)
CREATE OR REPLACE FUNCTION retry_failed_jobs(
    max_age_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
    requeued_count INTEGER := 0;
    failed_job RECORD;
BEGIN
    FOR failed_job IN
        SELECT * FROM jobs
        WHERE status = 'failed'
          AND failed_at > NOW() - INTERVAL '1 hour' * max_age_hours
          AND attempts < max_attempts
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE jobs
        SET status = 'queued',
            scheduled_for = NOW() + INTERVAL '1 second' * (2 ^ attempts),
            error = NULL,
            updated_at = NOW()
        WHERE id = failed_job.id;

        requeued_count := requeued_count + 1;
    END LOOP;

    RETURN requeued_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup expired downloads
CREATE OR REPLACE FUNCTION cleanup_expired_downloads()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM downloads
    WHERE status = 'expired'
       OR (status = 'ready' AND expires_at < NOW() - INTERVAL '48 hours')
       OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')
       OR (status = 'queued' AND created_at < NOW() - INTERVAL '1 hour');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user download quota
CREATE OR REPLACE FUNCTION get_user_download_quota(
    p_user_id UUID
)
RETURNS TABLE (used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ) AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        -- Create default profile
        INSERT INTO profiles (id, email, plan, downloads_count, downloads_reset_at, monthly_quota)
        VALUES (p_user_id, NULL, 'free', 0, NOW(), 100)
        RETURNING * INTO v_profile;
    END IF;

    -- Reset counter if needed
    IF v_profile.downloads_reset_at < date_trunc('month', NOW()) THEN
        UPDATE profiles
        SET downloads_count = 0,
            downloads_reset_at = date_trunc('month', NOW())
        WHERE id = p_user_id;

        v_profile.downloads_count := 0;
    END IF;

    used := v_profile.downloads_count;
    quota := v_profile.monthly_quota;
    reset_at := v_profile.downloads_reset_at;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment download count
CREATE OR REPLACE FUNCTION increment_download_count(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET downloads_count = downloads_count + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Queue stats
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE (
    queued BIGINT,
    processing BIGINT,
    completed BIGINT,
    failed BIGINT,
    dead_letter BIGINT,
    avg_processing_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'queued')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'processing')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'dead_letter')::BIGINT,
        AVG(
            EXTRACT(EPOCH FROM (completed_at - processed_at)) * 1000
        )::NUMERIC
    FROM jobs;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at on all tables
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_downloads_updated_at
    BEFORE UPDATE ON downloads
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION trigger_create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, plan, downloads_count, downloads_reset_at, monthly_quota)
    VALUES (
        NEW.id,
        NEW.email,
        'free',
        0,
        NOW(),
        100
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_profile_after_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION trigger_create_profile_on_signup();

-- ═══════════════════════════════════════════════════════════════
--  CRON JOBS (via pg_cron)
-- ═══════════════════════════════════════════════════════════════

-- Cleanup expired downloads every hour
SELECT cron.schedule(
    'cleanup_expired_downloads',
    '0 * * * *',  -- Every hour
    $$SELECT cleanup_expired_downloads()$$
);

-- Retry failed jobs every 10 minutes
SELECT cron.schedule(
    'retry_failed_jobs',
    '*/10 * * * *',
    $$SELECT retry_failed_jobs(24)$$
);

-- Purge old completed jobs daily
SELECT cron.schedule(
    'purge_old_jobs',
    '0 3 * * *',  -- 3 AM daily
    $$DELETE FROM jobs WHERE status IN ('completed', 'failed') AND updated_at < NOW() - INTERVAL '30 days'$$
);

-- Purge old dead letter entries weekly
SELECT cron.schedule(
    'purge_dead_letter',
    '0 4 * * 0',  -- Sunday 4 AM
    $$DELETE FROM dead_letter WHERE created_at < NOW() - INTERVAL '30 days'$$
);
