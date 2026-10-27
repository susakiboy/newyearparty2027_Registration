-- ==============================================================================
-- SPORTS DAY 2026 — SUPABASE PRODUCTION DATABASE MIGRATION
-- Migration: 001_initial_schema.sql
-- Direct Execution: Compatible with Supabase SQL Editor & Migration CLI
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing views/functions if needing clean rebuild
DROP VIEW IF EXISTS admins CASCADE;

-- 3. TABLE: events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    year VARCHAR(10) NOT NULL DEFAULT '2026',
    description TEXT,
    logo_url TEXT,
    registration_open BOOLEAN NOT NULL DEFAULT true,
    registration_start TIMESTAMPTZ,
    registration_end TIMESTAMPTZ,
    success_message TEXT DEFAULT 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว กรุณาบันทึกภาพหน้าจอหรือ QR Code สำหรับนำมาแสดงในวันงาน',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'UPCOMING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE: teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    color_hex VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_team_event_name UNIQUE (event_id, name)
);

-- 5. TABLE: sub_teams
CREATE TABLE IF NOT EXISTS sub_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sub_team_name UNIQUE (team_id, name)
);

-- 6. SEQUENCE for atomic sequential Registration Code generation
CREATE SEQUENCE IF NOT EXISTS registration_code_seq START 1;

-- 7. TABLE: registrations
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. SD2026-000001
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(210) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    team_name_snapshot VARCHAR(100) NOT NULL,
    sub_team_id UUID REFERENCES sub_teams(id) ON DELETE SET NULL,
    sub_team_name_snapshot VARCHAR(100),
    qr_token VARCHAR(64) UNIQUE NOT NULL,
    registration_status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (registration_status IN ('CONFIRMED', 'CANCELLED')),
    check_in_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (check_in_status IN ('PENDING', 'CHECKED_IN')),
    checked_in_at TIMESTAMPTZ,
    checked_in_by VARCHAR(100),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Database-level Unique constraint for Duplicate Registration Protection
-- Prevents identical first_name + last_name from duplicate active registrations in the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_event_name_dup 
ON registrations (event_id, LOWER(TRIM(first_name)), LOWER(TRIM(last_name))) 
WHERE (registration_status = 'CONFIRMED');

-- 8. TABLE: check_ins
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    checked_in_by VARCHAR(100) NOT NULL,
    method VARCHAR(30) NOT NULL DEFAULT 'QR_SCAN' CHECK (method IN ('QR_SCAN', 'MANUAL_SEARCH', 'BULK_IMPORT')),
    device_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_check_in_single_entry UNIQUE (registration_id)
);

-- 9. TABLE: admin_profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- References auth.users(id) if Supabase Auth is enabled
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'CHECKIN_STAFF')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    password_hash TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backward compatibility view
CREATE OR REPLACE VIEW admins AS SELECT * FROM admin_profiles;

-- 10. TABLE: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address_if_available VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. TABLE: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR PRODUCTION QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_registrations_code ON registrations(registration_code);
CREATE INDEX IF NOT EXISTS idx_registrations_qr_token ON registrations(qr_token);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON registrations(team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_sub_team ON registrations(sub_team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_check_in ON registrations(check_in_status);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON registrations(registered_at);

CREATE INDEX IF NOT EXISTS idx_check_ins_registration ON check_ins(registration_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(checked_in_at);

CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_sub_teams_team ON sub_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==============================================================================
-- STORED PROCEDURES / RPCs FOR ATOMIC TRANSACTIONS
-- ==============================================================================

-- 1. Atomic Concurrency-Safe Registration Function
CREATE OR REPLACE FUNCTION register_participant(
    p_event_id UUID,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_team_id UUID,
    p_sub_team_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event RECORD;
    v_team RECORD;
    v_sub_team RECORD;
    v_seq_num BIGINT;
    v_reg_code VARCHAR(30);
    v_qr_token VARCHAR(64);
    v_full_name VARCHAR(210);
    v_reg_id UUID;
    v_clean_first VARCHAR;
    v_clean_last VARCHAR;
    v_result JSONB;
BEGIN
    v_clean_first := TRIM(p_first_name);
    v_clean_last := TRIM(p_last_name);

    IF v_clean_first IS NULL OR v_clean_first = '' THEN
        RAISE EXCEPTION 'กรุณากรอกชื่อ';
    END IF;
    IF v_clean_last IS NULL OR v_clean_last = '' THEN
        RAISE EXCEPTION 'กรุณากรอกนามสกุล';
    END IF;

    -- Validate Event Status & Window
    SELECT * INTO v_event FROM events WHERE id = p_event_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบกิจกรรม หรือกิจกรรมถูกปิดใช้งาน';
    END IF;

    IF NOT v_event.registration_open THEN
        RAISE EXCEPTION 'ขณะนี้ระบบปิดรับลงทะเบียน';
    END IF;

    IF v_event.registration_start IS NOT NULL AND now() < v_event.registration_start THEN
        RAISE EXCEPTION 'ระบบยังไม่เปิดรับลงทะเบียน';
    END IF;

    IF v_event.registration_end IS NOT NULL AND now() > v_event.registration_end THEN
        RAISE EXCEPTION 'หมดเวลาลงทะเบียนแล้ว';
    END IF;

    -- Validate Team
    SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบทีมที่ระบุ หรือทีมถูกปิดใช้งาน';
    END IF;

    -- Validate Sub-team if provided
    IF p_sub_team_id IS NOT NULL THEN
        SELECT * INTO v_sub_team FROM sub_teams WHERE id = p_sub_team_id AND team_id = p_team_id AND status = 'ACTIVE';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'ทีมย่อยไม่ถูกต้อง หรือไม่อยู่ในทีมที่เลือก';
        END IF;
    END IF;

    -- Concurrency-Safe Duplicate Check (First Name + Last Name in same event)
    IF EXISTS (
        SELECT 1 FROM registrations 
        WHERE event_id = p_event_id 
          AND LOWER(TRIM(first_name)) = LOWER(v_clean_first)
          AND LOWER(TRIM(last_name)) = LOWER(v_clean_last)
          AND registration_status = 'CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'ตรวจพบรายชื่อ "% %" ได้ลงทะเบียนไว้แล้วในระบบ ห้ามลงทะเบียนซ้ำ', v_clean_first, v_clean_last;
    END IF;

    -- Atomic sequential Registration Code generation: SD2026-000001
    SELECT nextval('registration_code_seq') INTO v_seq_num;
    v_reg_code := 'SD' || COALESCE(v_event.year, '2026') || '-' || LPAD(v_seq_num::TEXT, 6, '0');
    
    -- Secure cryptographic QR verification token
    v_qr_token := encode(digest(v_reg_code || '-' || gen_random_uuid()::text || '-' || clock_timestamp()::text, 'sha256'), 'hex');
    v_full_name := v_clean_first || ' ' || v_clean_last;

    -- Insert atomic registration record
    INSERT INTO registrations (
        registration_code,
        event_id,
        first_name,
        last_name,
        full_name,
        team_id,
        team_name_snapshot,
        sub_team_id,
        sub_team_name_snapshot,
        qr_token,
        registration_status,
        check_in_status,
        registered_at,
        updated_at
    ) VALUES (
        v_reg_code,
        p_event_id,
        v_clean_first,
        v_clean_last,
        v_full_name,
        p_team_id,
        v_team.name,
        p_sub_team_id,
        CASE WHEN v_sub_team IS NOT NULL THEN v_sub_team.name ELSE NULL END,
        v_qr_token,
        'CONFIRMED',
        'PENDING',
        now(),
        now()
    ) RETURNING id INTO v_reg_id;

    -- Build return JSON payload
    SELECT json_build_object(
        'id', v_reg_id,
        'registration_code', v_reg_code,
        'event_id', p_event_id,
        'full_name', v_full_name,
        'first_name', v_clean_first,
        'last_name', v_clean_last,
        'team_id', p_team_id,
        'team_name_snapshot', v_team.name,
        'team_name', v_team.name,
        'team_color', v_team.color,
        'team_color_hex', v_team.color_hex,
        'sub_team_id', p_sub_team_id,
        'sub_team_name_snapshot', CASE WHEN v_sub_team IS NOT NULL THEN v_sub_team.name ELSE NULL END,
        'qr_token', v_qr_token,
        'registration_status', 'CONFIRMED',
        'check_in_status', 'PENDING',
        'registered_at', now()
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 2. Atomic Check-in Verification Function
CREATE OR REPLACE FUNCTION check_in_participant(
    p_identifier VARCHAR, -- registration_code OR qr_token
    p_checked_by VARCHAR,
    p_method VARCHAR DEFAULT 'QR_SCAN',
    p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- Query registration
    SELECT r.*, t.color_hex AS team_color_hex, t.name AS current_team_name
    INTO v_reg 
    FROM registrations r
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.registration_code = TRIM(p_identifier) OR r.qr_token = TRIM(p_identifier);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบรหัสลงทะเบียนในระบบ';
    END IF;

    IF v_reg.registration_status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'การลงทะเบียนนี้ถูกยกเลิกแล้ว';
    END IF;

    -- Already Checked-in Check
    IF v_reg.check_in_status = 'CHECKED_IN' THEN
        RETURN json_build_object(
            'success', false,
            'is_duplicate', true,
            'message', 'ผู้เข้าร่วมรายนี้ Check-in แล้ว',
            'first_check_in_time', v_reg.checked_in_at,
            'checked_in_by', v_reg.checked_in_by,
            'registration', json_build_object(
                'id', v_reg.id,
                'registration_code', v_reg.registration_code,
                'full_name', v_reg.full_name,
                'first_name', v_reg.first_name,
                'last_name', v_reg.last_name,
                'team_name_snapshot', v_reg.team_name_snapshot,
                'sub_team_name_snapshot', v_reg.sub_team_name_snapshot,
                'team_color_hex', v_reg.team_color_hex,
                'check_in_status', 'CHECKED_IN',
                'checked_in_at', v_reg.checked_in_at
            )
        );
    END IF;

    -- Update registration status atomically
    UPDATE registrations
    SET check_in_status = 'CHECKED_IN',
        checked_in_at = v_now,
        checked_in_by = p_checked_by,
        updated_at = v_now
    WHERE id = v_reg.id;

    -- Insert permanent audit entry in check_ins
    INSERT INTO check_ins (
        registration_id,
        event_id,
        checked_in_at,
        checked_in_by,
        method,
        device_info
    ) VALUES (
        v_reg.id,
        v_reg.event_id,
        v_now,
        p_checked_by,
        p_method,
        p_device_info
    );

    RETURN json_build_object(
        'success', true,
        'is_duplicate', false,
        'message', 'Check-in สำเร็จ',
        'checked_in_at', v_now,
        'checked_in_by', p_checked_by,
        'registration', json_build_object(
            'id', v_reg.id,
            'registration_code', v_reg.registration_code,
            'full_name', v_reg.full_name,
            'first_name', v_reg.first_name,
            'last_name', v_reg.last_name,
            'team_name_snapshot', v_reg.team_name_snapshot,
            'sub_team_name_snapshot', v_reg.sub_team_name_snapshot,
            'team_color_hex', v_reg.team_color_hex,
            'check_in_status', 'CHECKED_IN',
            'checked_in_at', v_now
        )
    );
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public Reads for Active Registration Portal
CREATE POLICY "Public can view active event" 
    ON events FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Public can view active teams" 
    ON teams FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Public can view active sub_teams" 
    ON sub_teams FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Public can view general system settings" 
    ON system_settings FOR SELECT USING (true);

-- 2. Public Registration Insertions
-- Public users can only invoke registration RPC or insert single valid registration
CREATE POLICY "Public registration via RPC and insert" 
    ON registrations FOR INSERT WITH CHECK (registration_status = 'CONFIRMED');

CREATE POLICY "Public view confirmed registration by token" 
    ON registrations FOR SELECT USING (true);

-- 3. Staff & Admin Access (Allows both authenticated and anon with anon key in client-side apps)
CREATE POLICY "Full access to events" 
    ON events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to teams" 
    ON teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to sub_teams" 
    ON sub_teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to registrations" 
    ON registrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to checkins" 
    ON check_ins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to audit logs" 
    ON audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to system settings" 
    ON system_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access to admin profiles" 
    ON admin_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
-- Enable Realtime publication for tables needing live dashboard updates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
        ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
        ALTER PUBLICATION supabase_realtime ADD TABLE sub_teams;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
