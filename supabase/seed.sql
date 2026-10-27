-- ==============================================================================
-- SPORTS DAY 2026 — SUPABASE SEED DATA SCRIPT
-- Migration: seed.sql
-- Direct Execution: Supabase SQL Editor
-- ==============================================================================

DO $$
DECLARE
    v_event_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
    v_purple_id UUID := 'b0000000-0000-0000-0000-000000000001'::UUID;
    v_pink_id UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
    v_yellow_id UUID := 'b0000000-0000-0000-0000-000000000003'::UUID;
    v_green_id UUID := 'b0000000-0000-0000-0000-000000000004'::UUID;
BEGIN
    -- 1. Initial Event: SPORTS DAY 2026
    INSERT INTO events (
        id,
        name,
        year,
        description,
        logo_url,
        registration_open,
        registration_start,
        registration_end,
        success_message,
        status
    ) VALUES (
        v_event_id,
        'SPORTS DAY',
        '2026',
        'มหกรรมกีฬาสีและสานสัมพันธ์ประจำปี 2569 — ร่วมพลัง รวมใจ ก้าวไกลไปด้วยกัน',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&auto=format&fit=crop&q=80',
        true,
        NULL,
        NULL,
        'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว กรุณาบันทึกภาพหน้าจอหรือดาวน์โหลด QR Code สำหรับนำมาแสดงในวันงาน',
        'ACTIVE'
    ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        year = EXCLUDED.year,
        status = EXCLUDED.status;

    -- 2. Initial Teams: Purple, Pink, Yellow, Green
    INSERT INTO teams (id, event_id, name, color, color_hex, status, sort_order)
    VALUES
        (v_purple_id, v_event_id, 'Team Purple', 'Purple', '#8B5CF6', 'ACTIVE', 1),
        (v_pink_id, v_event_id, 'Team Pink', 'Pink', '#EC4899', 'ACTIVE', 2),
        (v_yellow_id, v_event_id, 'Team Yellow', 'Yellow', '#EAB308', 'ACTIVE', 3),
        (v_green_id, v_event_id, 'Team Green', 'Green', '#10B981', 'ACTIVE', 4)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        color_hex = EXCLUDED.color_hex;

    -- 3. Initial Sub Teams for Each Team
    -- Purple Sub Teams
    INSERT INTO sub_teams (team_id, name, status, sort_order)
    VALUES
        (v_purple_id, 'Purple A', 'ACTIVE', 1),
        (v_purple_id, 'Purple B', 'ACTIVE', 2),
        (v_purple_id, 'Purple C', 'ACTIVE', 3),
        (v_purple_id, 'Purple Staff', 'ACTIVE', 4)
    ON CONFLICT (team_id, name) DO NOTHING;

    -- Pink Sub Teams
    INSERT INTO sub_teams (team_id, name, status, sort_order)
    VALUES
        (v_pink_id, 'Pink Alpha', 'ACTIVE', 1),
        (v_pink_id, 'Pink Beta', 'ACTIVE', 2),
        (v_pink_id, 'Pink Staff', 'ACTIVE', 3)
    ON CONFLICT (team_id, name) DO NOTHING;

    -- Yellow Sub Teams
    INSERT INTO sub_teams (team_id, name, status, sort_order)
    VALUES
        (v_yellow_id, 'Yellow Strike', 'ACTIVE', 1),
        (v_yellow_id, 'Yellow Gold', 'ACTIVE', 2),
        (v_yellow_id, 'Yellow Staff', 'ACTIVE', 3)
    ON CONFLICT (team_id, name) DO NOTHING;

    -- Green Sub Teams
    INSERT INTO sub_teams (team_id, name, status, sort_order)
    VALUES
        (v_green_id, 'Green Force', 'ACTIVE', 1),
        (v_green_id, 'Green Eco', 'ACTIVE', 2),
        (v_green_id, 'Green Staff', 'ACTIVE', 3)
    ON CONFLICT (team_id, name) DO NOTHING;

    -- 4. Initial Master Super Admin Profile
    INSERT INTO admin_profiles (
        id,
        display_name,
        email,
        role,
        status,
        password_hash
    ) VALUES (
        'c0000000-0000-0000-0000-000000000001'::UUID,
        'Super Administrator',
        'superadmin@sportsday.com',
        'SUPER_ADMIN',
        'ACTIVE',
        'M2K3Dwin'
    ) ON CONFLICT (email) DO UPDATE SET
        role = 'SUPER_ADMIN',
        status = 'ACTIVE';

    -- 5. Initial System Settings
    INSERT INTO system_settings (key, value, description, updated_by)
    VALUES
        ('app_info', '{"app_name": "SPORTS DAY 2026", "version": "1.0.0", "event_year": "2026"}'::jsonb, 'General application information', 'System Seed'),
        ('checkin_config', '{"allow_duplicate_scan": false, "sound_effects": true, "auto_next_scan": true}'::jsonb, 'Check-in scanner configuration', 'System Seed'),
        ('registration_policy', '{"max_per_person": 1, "require_sub_team": false, "enforce_unique_name": true}'::jsonb, 'Registration validation rules', 'System Seed')
    ON CONFLICT (key) DO NOTHING;

END $$;
