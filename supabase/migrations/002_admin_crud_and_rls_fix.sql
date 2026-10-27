-- ==============================================================================
-- SPORTS DAY 2026: ADMIN REGISTRATIONS CRUD & RLS FIX MIGRATION (002)
-- Fixes: Row Level Security (RLS) UPDATE/DELETE permissions & provides atomic RPCs
-- ==============================================================================

-- 1. Ensure Full Access RLS Policies for registrations
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access to registrations" ON registrations;
DROP POLICY IF EXISTS "Allow update registrations for all" ON registrations;
DROP POLICY IF EXISTS "Allow delete registrations for all" ON registrations;

CREATE POLICY "Full access to registrations" 
    ON registrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Ensure Full Access RLS Policies for check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access to checkins" ON check_ins;
CREATE POLICY "Full access to checkins" 
    ON check_ins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Atomic Stored Procedure for Admin Update Registration (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION admin_update_registration(
    p_identifier VARCHAR, -- UUID string or registration_code
    p_first_name VARCHAR DEFAULT NULL,
    p_last_name VARCHAR DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_sub_team_id UUID DEFAULT NULL,
    p_team_name_snapshot VARCHAR DEFAULT NULL,
    p_sub_team_name_snapshot VARCHAR DEFAULT NULL,
    p_registration_status VARCHAR DEFAULT NULL,
    p_check_in_status VARCHAR DEFAULT NULL,
    p_updated_by VARCHAR DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg RECORD;
    v_now TIMESTAMPTZ := now();
    v_clean_id VARCHAR := TRIM(p_identifier);
    v_team RECORD;
    v_sub_team RECORD;
    v_team_name VARCHAR;
    v_sub_team_name VARCHAR;
    v_result JSONB;
BEGIN
    -- Locate registration row by UUID or registration_code
    SELECT * INTO v_reg 
    FROM registrations 
    WHERE (id::text = v_clean_id OR registration_code = v_clean_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลผู้ลงทะเบียนรหัส % ในระบบ', v_clean_id;
    END IF;

    -- Resolve Team Name if team_id provided
    IF p_team_id IS NOT NULL THEN
        SELECT * INTO v_team FROM teams WHERE id = p_team_id;
        IF FOUND THEN
            v_team_name := v_team.name;
        ELSE
            v_team_name := COALESCE(p_team_name_snapshot, v_reg.team_name_snapshot);
        END IF;
    ELSE
        v_team_name := COALESCE(p_team_name_snapshot, v_reg.team_name_snapshot);
    END IF;

    -- Resolve Sub-Team Name if sub_team_id provided
    IF p_sub_team_id IS NOT NULL THEN
        SELECT * INTO v_sub_team FROM sub_teams WHERE id = p_sub_team_id;
        IF FOUND THEN
            v_sub_team_name := v_sub_team.name;
        ELSE
            v_sub_team_name := p_sub_team_name_snapshot;
        END IF;
    ELSE
        v_sub_team_name := p_sub_team_name_snapshot;
    END IF;

    -- Perform atomic update
    UPDATE registrations
    SET
        first_name = COALESCE(TRIM(p_first_name), first_name),
        last_name = COALESCE(TRIM(p_last_name), last_name),
        full_name = CASE 
            WHEN p_first_name IS NOT NULL OR p_last_name IS NOT NULL THEN
                TRIM(COALESCE(p_first_name, first_name)) || ' ' || TRIM(COALESCE(p_last_name, last_name))
            ELSE full_name
        END,
        team_id = COALESCE(p_team_id, team_id),
        team_name_snapshot = COALESCE(v_team_name, team_name_snapshot),
        sub_team_id = p_sub_team_id,
        sub_team_name_snapshot = v_sub_team_name,
        registration_status = COALESCE(p_registration_status, registration_status),
        check_in_status = COALESCE(p_check_in_status, check_in_status),
        checked_in_at = CASE 
            WHEN p_check_in_status = 'CHECKED_IN' AND checked_in_at IS NULL THEN v_now
            WHEN p_check_in_status = 'PENDING' THEN NULL
            ELSE checked_in_at
        END,
        checked_in_by = CASE
            WHEN p_check_in_status = 'CHECKED_IN' AND checked_in_by IS NULL THEN p_updated_by
            WHEN p_check_in_status = 'PENDING' THEN NULL
            ELSE checked_in_by
        END,
        updated_at = v_now
    WHERE id = v_reg.id
    RETURNING to_jsonb(registrations.*) INTO v_result;

    RETURN v_result;
END;
$$;

-- 4. Atomic Stored Procedure for Admin Delete Registration (Soft or Hard Delete)
CREATE OR REPLACE FUNCTION admin_delete_registration(
    p_identifier VARCHAR, -- UUID string or registration_code
    p_is_permanent BOOLEAN DEFAULT FALSE,
    p_deleted_by VARCHAR DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg RECORD;
    v_clean_id VARCHAR := TRIM(p_identifier);
BEGIN
    -- Locate registration row by UUID or registration_code
    SELECT * INTO v_reg 
    FROM registrations 
    WHERE (id::text = v_clean_id OR registration_code = v_clean_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลผู้ลงทะเบียนรหัส % ในระบบ', v_clean_id;
    END IF;

    IF p_is_permanent THEN
        -- Delete linked check-ins first
        DELETE FROM check_ins WHERE registration_id = v_reg.id;
        -- Delete registration row permanently
        DELETE FROM registrations WHERE id = v_reg.id;
        RETURN json_build_object(
            'success', true,
            'action', 'PERMANENT_DELETE',
            'id', v_reg.id,
            'registration_code', v_reg.registration_code,
            'message', 'ลบข้อมูลผู้ลงทะเบียนออกจากฐานข้อมูลระบบถาวรเรียบร้อยแล้ว'
        );
    ELSE
        -- Soft delete (mark as CANCELLED)
        UPDATE registrations
        SET registration_status = 'CANCELLED',
            updated_at = now()
        WHERE id = v_reg.id;
        RETURN json_build_object(
            'success', true,
            'action', 'SOFT_DELETE',
            'id', v_reg.id,
            'registration_code', v_reg.registration_code,
            'message', 'ยกเลิกรายการลงทะเบียนเรียบร้อยแล้ว (Soft Delete)'
        );
    END IF;
END;
$$;

-- ==============================================================================
-- 5. Full Access RLS Policies for events, teams, and sub_teams
-- ==============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full access to events" ON events;
CREATE POLICY "Full access to events" 
    ON events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full access to teams" ON teams;
CREATE POLICY "Full access to teams" 
    ON teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE sub_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full access to sub_teams" ON sub_teams;
CREATE POLICY "Full access to sub_teams" 
    ON sub_teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Ensure a default active event exists in events table to prevent foreign key failure
INSERT INTO events (id, name, year, description, status, registration_open)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'SPORTS DAY',
    '2026',
    'มหกรรมกีฬาสีและสานสัมพันธ์ประจำปี 2569 — ร่วมพลัง รวมใจ ก้าวไกลไปด้วยกัน',
    'ACTIVE',
    true
)
ON CONFLICT (id) DO UPDATE
SET updated_at = now();

-- ==============================================================================
-- 6. Atomic Stored Procedure: Admin Create Team (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION admin_create_team(
    p_event_id UUID,
    p_name VARCHAR,
    p_color VARCHAR,
    p_color_hex VARCHAR,
    p_status VARCHAR DEFAULT 'ACTIVE',
    p_sort_order INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_name VARCHAR := TRIM(p_name);
    v_event_id UUID := p_event_id;
    v_new_id UUID := gen_random_uuid();
    v_now TIMESTAMPTZ := now();
    v_result JSONB;
BEGIN
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'กรุณาระบุชื่อทีม';
    END IF;

    -- Ensure event exists
    IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event_id) THEN
        SELECT id INTO v_event_id FROM events WHERE status = 'ACTIVE' LIMIT 1;
        IF v_event_id IS NULL THEN
            v_event_id := 'a0000000-0000-0000-0000-000000000001';
            INSERT INTO events (id, name, year, status, registration_open)
            VALUES (v_event_id, 'SPORTS DAY', '2026', 'ACTIVE', true)
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;

    -- Check duplicate name in this event
    IF EXISTS (SELECT 1 FROM teams WHERE event_id = v_event_id AND LOWER(name) = LOWER(v_clean_name)) THEN
        RAISE EXCEPTION 'มีทีมชื่อ "%" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น', v_clean_name;
    END IF;

    INSERT INTO teams (
        id, event_id, name, color, color_hex, status, sort_order, created_at, updated_at
    ) VALUES (
        v_new_id,
        v_event_id,
        v_clean_name,
        COALESCE(NULLIF(TRIM(p_color), ''), v_clean_name),
        COALESCE(NULLIF(TRIM(p_color_hex), ''), '#8B5CF6'),
        COALESCE(p_status, 'ACTIVE'),
        COALESCE(p_sort_order, 0),
        v_now,
        v_now
    ) RETURNING to_jsonb(teams.*) INTO v_result;

    RETURN v_result;
END;
$$;

-- ==============================================================================
-- 7. Atomic Stored Procedure: Admin Update Team (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION admin_update_team(
    p_id UUID,
    p_name VARCHAR DEFAULT NULL,
    p_color VARCHAR DEFAULT NULL,
    p_color_hex VARCHAR DEFAULT NULL,
    p_status VARCHAR DEFAULT NULL,
    p_sort_order INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team RECORD;
    v_clean_name VARCHAR := TRIM(p_name);
    v_now TIMESTAMPTZ := now();
    v_result JSONB;
BEGIN
    SELECT * INTO v_team FROM teams WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลทีมรหัส % ในระบบ', p_id;
    END IF;

    -- Check duplicate name if changed
    IF v_clean_name IS NOT NULL AND v_clean_name <> '' AND LOWER(v_clean_name) <> LOWER(v_team.name) THEN
        IF EXISTS (SELECT 1 FROM teams WHERE event_id = v_team.event_id AND id <> p_id AND LOWER(name) = LOWER(v_clean_name)) THEN
            RAISE EXCEPTION 'มีทีมชื่อ "%" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น', v_clean_name;
        END IF;
    END IF;

    UPDATE teams
    SET
        name = COALESCE(NULLIF(v_clean_name, ''), name),
        color = COALESCE(NULLIF(TRIM(p_color), ''), color),
        color_hex = COALESCE(NULLIF(TRIM(p_color_hex), ''), color_hex),
        status = COALESCE(p_status, status),
        sort_order = COALESCE(p_sort_order, sort_order),
        updated_at = v_now
    WHERE id = p_id
    RETURNING to_jsonb(teams.*) INTO v_result;

    RETURN v_result;
END;
$$;

-- ==============================================================================
-- 8. Atomic Stored Procedure: Admin Delete Team (Safe Deletion / Deactivation)
-- ==============================================================================
CREATE OR REPLACE FUNCTION admin_delete_team(
    p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team RECORD;
    v_reg_count INT := 0;
BEGIN
    SELECT * INTO v_team FROM teams WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลทีมรหัส % ในระบบ', p_id;
    END IF;

    -- Check if any registrations reference this team
    SELECT COUNT(*) INTO v_reg_count FROM registrations WHERE team_id = p_id;

    IF v_reg_count > 0 THEN
        -- Safely deactivate to maintain audit and registration integrity
        UPDATE teams
        SET status = 'INACTIVE',
            updated_at = now()
        WHERE id = p_id;

        RETURN json_build_object(
            'success', true,
            'action', 'DEACTIVATED',
            'id', p_id,
            'message', 'เนื่องจากมีประวัติผู้ลงทะเบียนในทีมนี้ (' || v_reg_count || ' คน) ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน'
        );
    ELSE
        -- No registrations, safe to delete sub_teams and team
        DELETE FROM sub_teams WHERE team_id = p_id;
        DELETE FROM teams WHERE id = p_id;

        RETURN json_build_object(
            'success', true,
            'action', 'DELETED',
            'id', p_id,
            'message', 'ลบทีมและทีมย่อยออกจากระบบเรียบร้อยแล้ว'
        );
    END IF;
END;
$$;

-- ==============================================================================
-- 9. Atomic Stored Procedures: Sub-Teams CRUD (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION admin_create_sub_team(
    p_team_id UUID,
    p_name VARCHAR,
    p_status VARCHAR DEFAULT 'ACTIVE',
    p_sort_order INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_name VARCHAR := TRIM(p_name);
    v_new_id UUID := gen_random_uuid();
    v_now TIMESTAMPTZ := now();
    v_result JSONB;
BEGIN
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'กรุณาระบุชื่อทีมย่อย';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
        RAISE EXCEPTION 'ไม่พบทีมหลักในระบบ';
    END IF;

    IF EXISTS (SELECT 1 FROM sub_teams WHERE team_id = p_team_id AND LOWER(name) = LOWER(v_clean_name)) THEN
        RAISE EXCEPTION 'มีทีมย่อยชื่อ "%" ในสังกัดนี้แล้ว กรุณาใช้ชื่ออื่น', v_clean_name;
    END IF;

    INSERT INTO sub_teams (
        id, team_id, name, status, sort_order, created_at, updated_at
    ) VALUES (
        v_new_id,
        p_team_id,
        v_clean_name,
        COALESCE(p_status, 'ACTIVE'),
        COALESCE(p_sort_order, 0),
        v_now,
        v_now
    ) RETURNING to_jsonb(sub_teams.*) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_sub_team(
    p_id UUID,
    p_name VARCHAR DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_status VARCHAR DEFAULT NULL,
    p_sort_order INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_clean_name VARCHAR := TRIM(p_name);
    v_now TIMESTAMPTZ := now();
    v_result JSONB;
BEGIN
    SELECT * INTO v_sub FROM sub_teams WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลทีมย่อยรหัส % ในระบบ', p_id;
    END IF;

    UPDATE sub_teams
    SET
        name = COALESCE(NULLIF(v_clean_name, ''), name),
        team_id = COALESCE(p_team_id, team_id),
        status = COALESCE(p_status, status),
        sort_order = COALESCE(p_sort_order, sort_order),
        updated_at = v_now
    WHERE id = p_id
    RETURNING to_jsonb(sub_teams.*) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_sub_team(
    p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_reg_count INT := 0;
BEGIN
    SELECT * INTO v_sub FROM sub_teams WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลทีมย่อยรหัส % ในระบบ', p_id;
    END IF;

    SELECT COUNT(*) INTO v_reg_count FROM registrations WHERE sub_team_id = p_id;

    IF v_reg_count > 0 THEN
        UPDATE sub_teams
        SET status = 'INACTIVE',
            updated_at = now()
        WHERE id = p_id;

        RETURN json_build_object(
            'success', true,
            'action', 'DEACTIVATED',
            'id', p_id,
            'message', 'เนื่องจากมีผู้ลงทะเบียนในทีมย่อยนี้ (' || v_reg_count || ' คน) ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน'
        );
    ELSE
        DELETE FROM sub_teams WHERE id = p_id;

        RETURN json_build_object(
            'success', true,
            'action', 'DELETED',
            'id', p_id,
            'message', 'ลบทีมย่อยออกจากระบบเรียบร้อยแล้ว'
        );
    END IF;
END;
$$;
