import { Registration, EventConfig, AdminUser, LuckyDrawConfig, LuckyDrawStats } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS, notifySubscribers } from './storage';
import { auditService } from './auditService';
import { eventService } from './eventService';

export const DEFAULT_LUCKY_CONFIG: LuckyDrawConfig = {
  enabled: true,
  start_number: 1,
  end_number: 500,
  prefix: '',
  digits: 3,
  auto_assign_on_register: true,
  prize_note: 'นำหมายเลขนี้ไปแสดงเพื่อรับของรางวัลตอน Check-in เข้างาน',
};

const CONFIG_REGEX = /<!--LUCKY_CONFIG:(.*?)-->/s;

export const luckyDrawService = {
  /**
   * Extract lucky number from a registration qr_token
   */
  extractLuckyNumber(qrToken?: string | null): string | null {
    if (!qrToken) return null;
    const parts = qrToken.split('#LUCKY:');
    if (parts.length > 1 && parts[1].trim()) {
      return parts[1].trim();
    }
    return null;
  },

  /**
   * Embed lucky number into qr_token
   */
  embedLuckyNumber(qrToken: string, luckyNumber: string | null): string {
    const base = qrToken.split('#LUCKY:')[0].trim();
    if (!luckyNumber || !luckyNumber.trim()) {
      return base;
    }
    return `${base}#LUCKY:${luckyNumber.trim()}`;
  },

  /**
   * Format a numerical value into padded lucky draw code with optional prefix
   */
  formatNumber(num: number, config: LuckyDrawConfig): string {
    const pad = Math.max(1, config.digits || 3);
    const padded = String(num).padStart(pad, '0');
    return `${config.prefix || ''}${padded}`;
  },

  /**
   * Enrich a registration object with extracted lucky_number
   */
  enrichRegistration(reg: any): Registration {
    const lucky = this.extractLuckyNumber(reg.qr_token);
    return {
      ...reg,
      lucky_number: lucky || reg.lucky_number || null,
    };
  },

  /**
   * Retrieve current lucky draw configuration
   */
  async getConfig(eventParam?: EventConfig | null): Promise<LuckyDrawConfig> {
    try {
      const activeEvent = eventParam || (await eventService.getActiveEvent());
      if (activeEvent?.description) {
        const match = activeEvent.description.match(CONFIG_REGEX);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            return {
              ...DEFAULT_LUCKY_CONFIG,
              ...parsed,
              start_number: Number(parsed.start_number) || DEFAULT_LUCKY_CONFIG.start_number,
              end_number: Number(parsed.end_number) || DEFAULT_LUCKY_CONFIG.end_number,
              digits: Number(parsed.digits) || DEFAULT_LUCKY_CONFIG.digits,
            };
          } catch (e) {
            console.error('Failed to parse lucky draw config from event description:', e);
          }
        }
      }

      // Check localStorage fallback
      const cached = localStorage.getItem('sd_lucky_draw_config');
      if (cached) {
        return { ...DEFAULT_LUCKY_CONFIG, ...JSON.parse(cached) };
      }
    } catch (err) {
      console.warn('Error reading lucky draw config:', err);
    }

    return { ...DEFAULT_LUCKY_CONFIG };
  },

  /**
   * Save lucky draw configuration into Supabase events table description
   */
  async saveConfig(
    config: LuckyDrawConfig,
    currentUser?: AdminUser
  ): Promise<LuckyDrawConfig> {
    const currentEvent = await eventService.getActiveEvent();
    const eventId = currentEvent?.id || 'a0000000-0000-0000-0000-000000000001';

    // Sanitize config
    const cleanConfig: LuckyDrawConfig = {
      enabled: Boolean(config.enabled),
      start_number: Math.max(1, Number(config.start_number) || 1),
      end_number: Math.max(Number(config.start_number) || 1, Number(config.end_number) || 500),
      prefix: (config.prefix || '').trim(),
      digits: Math.min(6, Math.max(1, Number(config.digits) || 3)),
      auto_assign_on_register: Boolean(config.auto_assign_on_register),
      prize_note: config.prize_note || DEFAULT_LUCKY_CONFIG.prize_note,
    };

    // Embed in description
    const currentDesc = (currentEvent?.description || '').replace(CONFIG_REGEX, '').trim();
    const newDescription = `${currentDesc}\n<!--LUCKY_CONFIG:${JSON.stringify(cleanConfig)}-->`.trim();

    // 1. Update in Supabase
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { error } = await client
            .from('events')
            .update({
              description: newDescription,
              updated_at: new Date().toISOString(),
            })
            .eq('id', eventId);

          if (error) {
            console.warn('Supabase update on events description error:', error);
          }
        } catch (err) {
          console.error('Supabase saveConfig error:', err);
        }
      }
    }

    // 2. Update local storage cache
    localStorage.setItem('sd_lucky_draw_config', JSON.stringify(cleanConfig));
    const events = getLocalCollection<EventConfig>(STORAGE_KEYS.EVENTS);
    const updatedEvents = events.map((e) =>
      e.id === eventId ? { ...e, description: newDescription } : e
    );
    setLocalCollection(STORAGE_KEYS.EVENTS, updatedEvents);

    // 3. Audit log
    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_LUCKY_DRAW_CONFIG',
        entityType: 'SETTING',
        entityId: 'lucky_draw_config',
        newData: cleanConfig,
      });
    }

    notifySubscribers();
    return cleanConfig;
  },

  /**
   * Get lucky draw statistics (total, assigned, unassigned, pool remaining)
   */
  async getStats(eventId: string): Promise<LuckyDrawStats> {
    const config = await this.getConfig();
    let regs: Registration[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data } = await client
          .from('registrations')
          .select('id, qr_token, registration_status')
          .eq('event_id', eventId)
          .eq('registration_status', 'CONFIRMED');
        if (data) regs = data.map((r) => this.enrichRegistration(r));
      }
    }

    if (regs.length === 0) {
      regs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS)
        .filter((r) => r.event_id === eventId && r.registration_status === 'CONFIRMED')
        .map((r) => this.enrichRegistration(r));
    }

    const totalRegistrations = regs.length;
    const assignedCount = regs.filter((r) => Boolean(r.lucky_number)).length;
    const unassignedCount = totalRegistrations - assignedCount;

    const totalPoolCapacity = Math.max(0, config.end_number - config.start_number + 1);
    const remainingPoolCapacity = Math.max(0, totalPoolCapacity - assignedCount);

    return {
      totalRegistrations,
      assignedCount,
      unassignedCount,
      totalPoolCapacity,
      remainingPoolCapacity,
    };
  },

  /**
   * Fetch all assigned lucky numbers currently in the database to prevent collision
   */
  async getAssignedNumbersSet(eventId: string): Promise<Set<string>> {
    const set = new Set<string>();

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data } = await client
          .from('registrations')
          .select('qr_token')
          .eq('event_id', eventId);
        if (data) {
          data.forEach((r) => {
            const num = this.extractLuckyNumber(r.qr_token);
            if (num) set.add(num.toUpperCase());
          });
          return set;
        }
      }
    }

    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    localRegs.forEach((r) => {
      const num = this.extractLuckyNumber(r.qr_token) || r.lucky_number;
      if (num) set.add(num.toUpperCase());
    });
    return set;
  },

  /**
   * Generate next available random lucky number for a new registration
   */
  async generateNextAvailableNumber(
    eventId: string,
    configOverride?: LuckyDrawConfig
  ): Promise<string | null> {
    const config = configOverride || (await this.getConfig());
    if (!config.enabled) return null;

    const assignedSet = await this.getAssignedNumbersSet(eventId);
    const availableNumbers: string[] = [];

    for (let i = config.start_number; i <= config.end_number; i++) {
      const formatted = this.formatNumber(i, config);
      if (!assignedSet.has(formatted.toUpperCase())) {
        availableNumbers.push(formatted);
      }
    }

    if (availableNumbers.length === 0) {
      console.warn('Lucky draw number pool exhausted! No more numbers available.');
      return null;
    }

    // Pick random available number
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    return availableNumbers[randomIndex];
  },

  /**
   * Batch Randomize lucky numbers for all registered participants who don't have one yet.
   * Guarantees strictly no duplicates.
   */
  async batchRandomizeUnassigned(
    eventId: string,
    currentUser?: AdminUser
  ): Promise<{ assignedCount: number; remainingAvailable: number }> {
    const config = await this.getConfig();
    if (!config.enabled) {
      throw new Error('ระบบสุ่มหมายเลขของรางวัลยังไม่ได้เปิดใช้งาน กรุณาเปิดใช้งานก่อน');
    }

    // 1. Fetch all registrations
    let allRegs: any[] = [];
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('registration_status', 'CONFIRMED')
          .order('registered_at', { ascending: true });
        if (!error && data) {
          allRegs = data;
        }
      }
    }

    if (allRegs.length === 0) {
      allRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).filter(
        (r) => r.event_id === eventId && r.registration_status === 'CONFIRMED'
      );
    }

    // 2. Identify assigned vs unassigned
    const assignedSet = new Set<string>();
    const unassignedList: any[] = [];

    allRegs.forEach((r) => {
      const existingLucky = this.extractLuckyNumber(r.qr_token);
      if (existingLucky) {
        assignedSet.add(existingLucky.toUpperCase());
      } else {
        unassignedList.push(r);
      }
    });

    if (unassignedList.length === 0) {
      return { assignedCount: 0, remainingAvailable: Math.max(0, (config.end_number - config.start_number + 1) - assignedSet.size) };
    }

    // 3. Build pool of available numbers
    const availablePool: string[] = [];
    for (let i = config.start_number; i <= config.end_number; i++) {
      const formatted = this.formatNumber(i, config);
      if (!assignedSet.has(formatted.toUpperCase())) {
        availablePool.push(formatted);
      }
    }

    if (availablePool.length < unassignedList.length) {
      throw new Error(
        `ช่วงตัวเลขที่ตั้งไว้ไม่เพียงพอ! มีผู้รอรับหมายเลข ${unassignedList.length} คน แต่เหลือหมายเลขว่างเพียง ${availablePool.length} เบอร์ (กรุณาขยายช่วงตัวเลขสิ้นสุดในหน้าตั้งค่า)`
      );
    }

    // 4. Fisher-Yates Shuffle the pool
    for (let i = availablePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePool[i], availablePool[j]] = [availablePool[j], availablePool[i]];
    }

    // 5. Assign to unassigned participants
    let successCount = 0;
    const client = isSupabaseConfigured() ? getSupabase() : null;

    for (let idx = 0; idx < unassignedList.length; idx++) {
      const reg = unassignedList[idx];
      const assignedLucky = availablePool[idx];
      const updatedQrToken = this.embedLuckyNumber(reg.qr_token, assignedLucky);

      if (client) {
        try {
          const { error } = await client
            .from('registrations')
            .update({
              qr_token: updatedQrToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', reg.id);
          if (!error) {
            successCount++;
            reg.qr_token = updatedQrToken;
          }
        } catch (err) {
          console.error(`Failed to assign lucky number to ${reg.registration_code}:`, err);
        }
      } else {
        reg.qr_token = updatedQrToken;
        successCount++;
      }
    }

    // 6. Sync local collection
    const localAll = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const updatedLocal = localAll.map((loc) => {
      const matched = unassignedList.find((u) => u.id === loc.id);
      if (matched) {
        return this.enrichRegistration(matched);
      }
      return loc;
    });
    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, updatedLocal);

    // 7. Audit log
    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'BATCH_RANDOMIZE_LUCKY_NUMBERS',
        entityType: 'REGISTRATION',
        entityId: eventId,
        newData: {
          assignedCount: successCount,
          start_number: config.start_number,
          end_number: config.end_number,
        },
      });
    }

    notifySubscribers();
    const remainingAvailable = Math.max(
      0,
      config.end_number - config.start_number + 1 - (assignedSet.size + successCount)
    );
    return { assignedCount: successCount, remainingAvailable };
  },

  /**
   * Reset & Re-randomize ALL registrations with new unique lucky numbers
   */
  async reRandomizeAll(
    eventId: string,
    currentUser?: AdminUser
  ): Promise<{ assignedCount: number }> {
    const config = await this.getConfig();
    if (!config.enabled) {
      throw new Error('ระบบสุ่มหมายเลขของรางวัลยังไม่ได้เปิดใช้งาน กรุณาเปิดใช้งานก่อน');
    }

    let allRegs: any[] = [];
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('registration_status', 'CONFIRMED');
        if (!error && data) allRegs = data;
      }
    }

    if (allRegs.length === 0) {
      allRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).filter(
        (r) => r.event_id === eventId && r.registration_status === 'CONFIRMED'
      );
    }

    const totalPool = config.end_number - config.start_number + 1;
    if (totalPool < allRegs.length) {
      throw new Error(
        `ช่วงตัวเลขไม่เพียงพอสำหรับทุกคน! มีผู้ลงทะเบียน ${allRegs.length} คน แต่ช่วงตัวเลขรองรับได้เพียง ${totalPool} เบอร์`
      );
    }

    // Generate full pool
    const pool: string[] = [];
    for (let i = config.start_number; i <= config.end_number; i++) {
      pool.push(this.formatNumber(i, config));
    }

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const client = isSupabaseConfigured() ? getSupabase() : null;
    let count = 0;

    for (let idx = 0; idx < allRegs.length; idx++) {
      const reg = allRegs[idx];
      const newLucky = pool[idx];
      const updatedQrToken = this.embedLuckyNumber(reg.qr_token, newLucky);

      if (client) {
        try {
          await client
            .from('registrations')
            .update({
              qr_token: updatedQrToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', reg.id);
          count++;
          reg.qr_token = updatedQrToken;
        } catch (e) {
          console.error(`Error re-randomizing reg ${reg.id}:`, e);
        }
      } else {
        reg.qr_token = updatedQrToken;
        count++;
      }
    }

    // Local sync
    const localAll = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const updatedLocal = localAll.map((loc) => {
      const matched = allRegs.find((r) => r.id === loc.id);
      return matched ? this.enrichRegistration(matched) : loc;
    });
    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, updatedLocal);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'RE_RANDOMIZE_ALL_LUCKY_NUMBERS',
        entityType: 'REGISTRATION',
        entityId: eventId,
        newData: { totalReassigned: count },
      });
    }

    notifySubscribers();
    return { assignedCount: count };
  },

  /**
   * Clear all lucky numbers from all registrations
   */
  async clearAllLuckyNumbers(
    eventId: string,
    currentUser?: AdminUser
  ): Promise<{ clearedCount: number }> {
    let allRegs: any[] = [];
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('registrations')
          .select('*')
          .eq('event_id', eventId);
        if (!error && data) allRegs = data;
      }
    }

    if (allRegs.length === 0) {
      allRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).filter(
        (r) => r.event_id === eventId
      );
    }

    const client = isSupabaseConfigured() ? getSupabase() : null;
    let count = 0;

    for (const reg of allRegs) {
      const cleanToken = this.embedLuckyNumber(reg.qr_token, null);
      if (cleanToken !== reg.qr_token) {
        if (client) {
          try {
            await client
              .from('registrations')
              .update({
                qr_token: cleanToken,
                updated_at: new Date().toISOString(),
              })
              .eq('id', reg.id);
            count++;
          } catch (e) {
            console.error('Error clearing lucky number:', e);
          }
        } else {
          count++;
        }
        reg.qr_token = cleanToken;
      }
    }

    // Local sync
    const localAll = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const updatedLocal = localAll.map((loc) => {
      const cleanToken = this.embedLuckyNumber(loc.qr_token, null);
      return { ...loc, qr_token: cleanToken, lucky_number: null };
    });
    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, updatedLocal);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'CLEAR_ALL_LUCKY_NUMBERS',
        entityType: 'REGISTRATION',
        entityId: eventId,
        newData: { clearedCount: count },
      });
    }

    notifySubscribers();
    return { clearedCount: count };
  },

  /**
   * Manually assign or edit a lucky number for a specific participant
   */
  async manuallyAssignNumber(
    registrationId: string,
    luckyNumber: string,
    eventId: string,
    currentUser?: AdminUser
  ): Promise<Registration> {
    const cleanNumber = luckyNumber.trim();

    // Check duplicate
    if (cleanNumber) {
      const assigned = await this.getAssignedNumbersSet(eventId);
      // Check if another person has this number
      if (isSupabaseConfigured()) {
        const client = getSupabase();
        if (client) {
          const { data } = await client
            .from('registrations')
            .select('id, full_name, qr_token')
            .eq('event_id', eventId)
            .ilike('qr_token', `%#LUCKY:${cleanNumber}%`);

          const other = (data || []).find((r) => r.id !== registrationId);
          if (other) {
            throw new Error(`หมายเลข ${cleanNumber} ถูกใช้งานแล้วโดยคุณ "${other.full_name}"`);
          }
        }
      }
    }

    let updatedReg: any = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data: current } = await client
          .from('registrations')
          .select('*')
          .eq('id', registrationId)
          .single();

        if (current) {
          const newQrToken = this.embedLuckyNumber(current.qr_token, cleanNumber || null);
          const { data, error } = await client
            .from('registrations')
            .update({
              qr_token: newQrToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', registrationId)
            .select('*, teams(color_hex, name)')
            .single();

          if (error) throw error;
          updatedReg = this.enrichRegistration(data);
        }
      }
    }

    if (!updatedReg) {
      const localAll = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
      const target = localAll.find((r) => r.id === registrationId);
      if (!target) throw new Error('ไม่พบข้อมูลผู้ลงทะเบียน');
      const newQrToken = this.embedLuckyNumber(target.qr_token, cleanNumber || null);
      updatedReg = {
        ...target,
        qr_token: newQrToken,
        lucky_number: cleanNumber || null,
        updated_at: new Date().toISOString(),
      };
      setLocalCollection(
        STORAGE_KEYS.REGISTRATIONS,
        localAll.map((r) => (r.id === registrationId ? updatedReg : r))
      );
    }

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'MANUAL_ASSIGN_LUCKY_NUMBER',
        entityType: 'REGISTRATION',
        entityId: registrationId,
        newData: { luckyNumber: cleanNumber },
      });
    }

    notifySubscribers();
    return updatedReg;
  },
};
