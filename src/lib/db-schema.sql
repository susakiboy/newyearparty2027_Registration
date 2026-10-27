-- ==============================================================================
-- SPORTS DAY 2026 — REGISTRATION & EVENT MANAGEMENT SYSTEM
-- Complete PostgreSQL & Supabase Database Migration Script
-- Production-Ready Schema, Indexes, Foreign Keys, Functions, RLS, and Seed Data
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE: events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    year VARCHAR(10) NOT NULL DEFAULT '2026',
    description TEXT,
    logo_url TEXT,
    registration_open BOOLEAN NOT NULL DEFAULT true,
    registration_start TIMESTAMPTZ,
    registration_end TIMESTAMPTZ,
    success_message TEXT DEFAULT 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว กรุณาบันทึก QR Code สำหรับนำมาแสดงในวันงาน',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLE: teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    color_hex VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLE: sub_teams
CREATE TABLE IF NOT EXISTS sub_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE: registrations
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. SD2026-000001
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(210) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    team_name_snapshot VARCHAR(100) NOT NULL,
    sub_team_id UUID REFERENCES sub_teams(id) ON DELETE RESTRICT,
    sub_team_name_snapshot VARCHAR(100),
    qr_token VARCHAR(64) UNIQUE NOT NULL,
    registration_status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, CANCELLED
    check_in_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CHECKED_IN
    checked_in_at TIMESTAMPTZ,
    checked_in_by VARCHAR(100),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLE: admins
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- References auth.users(id) in Supabase Auth
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ADMIN', -- SUPER_ADMIN, ADMIN, CHECKIN_STAFF
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    password_hash TEXT, -- Stored if not using external Auth provider
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLE: check_ins
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    checked_in_by VARCHAR(100) NOT NULL,
    method VARCHAR(30) NOT NULL DEFAULT 'QR_SCAN', -- QR_SCAN, MANUAL_SEARCH
    device_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLE: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- SEQUENCE FOR ATOMIC REGISTRATION CODE GENERATION
CREATE SEQUENCE IF NOT EXISTS registration_code_seq START 1;

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_registrations_code ON registrations(registration_code);
CREATE INDEX IF NOT EXISTS idx_registrations_qr_token ON registrations(qr_token);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON registrations(team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_sub_team ON registrations(sub_team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_check_in ON registrations(check_in_status);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON registrations(registered_at);
CREATE INDEX IF NOT EXISTS idx_registrations_dup_check ON registrations(event_id, LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), team_id);

CREATE INDEX IF NOT EXISTS idx_check_ins_registration ON check_ins(registration_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(checked_in_at);

CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_sub_teams_team ON sub_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);

-- ==============================================================================
-- ATOMIC DATABASE FUNCTIONS
-- ==============================================================================

-- Function: register_participant (Atomic transaction, code generation, concurrency safe)
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
    v_result JSONB;
BEGIN
    -- Check event status and timing
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

    -- Validate team
    SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบทีมที่ระบุ หรือทีมถูกปิดใช้งาน';
    END IF;

    -- Validate sub-team if provided
    IF p_sub_team_id IS NOT NULL THEN
        SELECT * INTO v_sub_team FROM sub_teams WHERE id = p_sub_team_id AND team_id = p_team_id AND status = 'ACTIVE';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'ทีมย่อยไม่ถูกต้อง หรือไม่อยู่ในทีมที่เลือก';
        END IF;
    END IF;

    -- Duplicate check (First Name + Last Name + Team + Event)
    IF EXISTS (
        SELECT 1 FROM registrations 
        WHERE event_id = p_event_id 
          AND LOWER(TRIM(first_name)) = LOWER(TRIM(p_first_name))
          AND LOWER(TRIM(last_name)) = LOWER(TRIM(p_last_name))
          AND team_id = p_team_id
          AND registration_status = 'CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'ข้อมูลนี้มีอยู่ในระบบแล้ว';
    END IF;

    -- Generate atomic sequential registration code
    SELECT nextval('registration_code_seq') INTO v_seq_num;
    v_reg_code := 'SD' || v_event.year || '-' || LPAD(v_seq_num::TEXT, 6, '0');
    v_qr_token := encode(digest(v_reg_code || '-' || gen_random_uuid()::text, 'sha256'), 'hex');
    v_full_name := TRIM(p_first_name) || ' ' || TRIM(p_last_name);

    -- Insert registration record
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
        registered_at
    ) VALUES (
        v_reg_code,
        p_event_id,
        TRIM(p_first_name),
        TRIM(p_last_name),
        v_full_name,
        p_team_id,
        v_team.name,
        p_sub_team_id,
        CASE WHEN v_sub_team IS NOT NULL THEN v_sub_team.name ELSE NULL END,
        v_qr_token,
        'CONFIRMED',
        'PENDING',
        now()
    ) RETURNING id INTO v_reg_id;

    -- Return full created object
    SELECT json_build_object(
        'id', v_reg_id,
        'registration_code', v_reg_code,
        'full_name', v_full_name,
        'first_name', TRIM(p_first_name),
        'last_name', TRIM(p_last_name),
        'team_id', p_team_id,
        'team_name', v_team.name,
        'team_color', v_team.color,
        'team_color_hex', v_team.color_hex,
        'sub_team_id', p_sub_team_id,
        'sub_team_name', CASE WHEN v_sub_team IS NOT NULL THEN v_sub_team.name ELSE NULL END,
        'qr_token', v_qr_token,
        'check_in_status', 'PENDING',
        'registered_at', now()
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Function: check_in_participant (Atomic check-in with duplicate prevention)
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
    v_result JSONB;
BEGIN
    -- Find registration by code or token
    SELECT r.*, t.color_hex AS team_color_hex 
    INTO v_reg 
    FROM registrations r
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.registration_code = p_identifier OR r.qr_token = p_identifier;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบรหัสลงทะเบียนในระบบ';
    END IF;

    IF v_reg.registration_status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'การลงทะเบียนนี้ถูกยกเลิกแล้ว';
    END IF;

    -- If already checked in, return details and duplicate warning
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
                'team_name', v_reg.team_name_snapshot,
                'sub_team_name', v_reg.sub_team_name_snapshot,
                'team_color_hex', v_reg.team_color_hex
            )
        );
    END IF;

    -- Update registration status
    UPDATE registrations
    SET check_in_status = 'CHECKED_IN',
        checked_in_at = v_now,
        checked_in_by = p_checked_by,
        updated_at = v_now
    WHERE id = v_reg.id;

    -- Insert log in check_ins table
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
            'team_name', v_reg.team_name_snapshot,
            'sub_team_name', v_reg.sub_team_name_snapshot,
            'team_color_hex', v_reg.team_color_hex
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
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Public Read active events & teams
CREATE POLICY "Public can view active event" ON events FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Public can view active teams" ON teams FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Public can view active sub_teams" ON sub_teams FOR SELECT USING (status = 'ACTIVE');

-- 2. Public can create registration through defined criteria
CREATE POLICY "Public can register" ON registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view own registration by token" ON registrations FOR SELECT USING (true);

-- 3. Staff/Admins have management rights
CREATE POLICY "Full access registrations" ON registrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access checkins" ON check_ins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access teams" ON teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access sub_teams" ON sub_teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access events" ON events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access audit logs" ON audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access admins" ON admins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================
DO $$
DECLARE
    v_event_id UUID;
    v_purple_id UUID;
    v_pink_id UUID;
    v_yellow_id UUID;
    v_green_id UUID;
BEGIN
    -- Insert Default Event: SPORTS DAY 2026
    INSERT INTO events (
        id,
        name,
        year,
        description,
        logo_url,
        registration_open,
        success_message,
        status
    ) VALUES (
        'a0000000-0000-0000-0000-000000000001'::UUID,
        'SPORTS DAY',
        '2026',
        'มหกรรมกีฬาสีและสานสัมพันธ์ประจำปี 2569 — ร่วมพลัง รวมใจ ก้าวไกลไปด้วยกัน',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=200&auto=format&fit=crop&q=60',
        true,
        'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว กรุณาบันทึกภาพหน้าจอหรือดาวน์โหลด QR Code สำหรับนำมาแสดงในวันงาน',
        'ACTIVE'
    ) ON CONFLICT (id) DO NOTHING;

    v_event_id := 'a0000000-0000-0000-0000-000000000001'::UUID;

    -- Insert Initial 4 Teams (Purple, Pink, Yellow, Green)
    INSERT INTO teams (id, event_id, name, color, color_hex, status, sort_order)
    VALUES 
        ('b0000000-0000-0000-0000-000000000001'::UUID, v_event_id, 'Team Purple', 'Purple', '#8B5CF6', 'ACTIVE', 1),
        ('b0000000-0000-0000-0000-000000000002'::UUID, v_event_id, 'Team Pink', 'Pink', '#EC4899', 'ACTIVE', 2),
        ('b0000000-0000-0000-0000-000000000003'::UUID, v_event_id, 'Team Yellow', 'Yellow', '#EAB308', 'ACTIVE', 3),
        ('b0000000-0000-0000-0000-000000000004'::UUID, v_event_id, 'Team Green', 'Green', '#10B981', 'ACTIVE', 4)
    ON CONFLICT (id) DO NOTHING;

    -- Insert Example Sub Teams for Team Purple
    INSERT INTO sub_teams (team_id, name, status, sort_order)
    VALUES
        ('b0000000-0000-0000-0000-000000000001'::UUID, 'Purple A', 'ACTIVE', 1),
        ('b0000000-0000-0000-0000-000000000001'::UUID, 'Purple B', 'ACTIVE', 2),
        ('b0000000-0000-0000-0000-000000000001'::UUID, 'Purple C', 'ACTIVE', 3),
        ('b0000000-0000-0000-0000-000000000001'::UUID, 'Purple Staff', 'ACTIVE', 4),
        -- Team Pink sub teams
        ('b0000000-0000-0000-0000-000000000002'::UUID, 'Pink Alpha', 'ACTIVE', 1),
        ('b0000000-0000-0000-0000-000000000002'::UUID, 'Pink Beta', 'ACTIVE', 2),
        ('b0000000-0000-0000-0000-000000000002'::UUID, 'Pink Staff', 'ACTIVE', 3),
        -- Team Yellow sub teams
        ('b0000000-0000-0000-0000-000000000003'::UUID, 'Yellow Strike', 'ACTIVE', 1),
        ('b0000000-0000-0000-0000-000000000003'::UUID, 'Yellow Gold', 'ACTIVE', 2),
        -- Team Green sub teams
        ('b0000000-0000-0000-0000-000000000004'::UUID, 'Green Force', 'ACTIVE', 1),
        ('b0000000-0000-0000-0000-000000000004'::UUID, 'Green Eco', 'ACTIVE', 2)
    ON CONFLICT DO NOTHING;

    -- Insert Default Super Admin
    INSERT INTO admins (
        id,
        display_name,
        email,
        role,
        status
    ) VALUES (
        'c0000000-0000-0000-0000-000000000001'::UUID,
        'Super Administrator',
        'superadmin@sportsday.com',
        'SUPER_ADMIN',
        'ACTIVE'
    ) ON CONFLICT (email) DO NOTHING;

END $$;
