-- Harden anonymous access to download and analysis rows.
-- Polling and anonymous download status access go through server API routes using
-- the service role; the public anon key should not read all anonymous rows.

DROP POLICY IF EXISTS downloads_select_own ON downloads;
CREATE POLICY downloads_select_own ON downloads
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS analyses_select_own ON analyses;
CREATE POLICY analyses_select_own ON analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM downloads
            WHERE downloads.id = analyses.download_id
              AND downloads.user_id = auth.uid()
        )
    );
