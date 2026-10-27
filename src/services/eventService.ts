import { EventConfig, AdminUser } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';
import { auditService } from './auditService';

export const eventService = {
  async getActiveEvent(): Promise<EventConfig> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('events')
          .select('*')
          .eq('status', 'ACTIVE')
          .limit(1)
          .maybeSingle();
        if (!error && data) return data as EventConfig;
      }
    }

    const events = getLocalCollection<EventConfig>(STORAGE_KEYS.EVENTS);
    const active = events.find((e) => e.status === 'ACTIVE') || events[0];
    return active;
  },

  async updateEventSettings(
    eventId: string,
    updates: Partial<EventConfig>,
    currentUser?: AdminUser
  ): Promise<EventConfig> {
    const current = await this.getActiveEvent();

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // Attempt update on the specified eventId or fallback to any active event
        const targetId = eventId || current?.id || 'a0000000-0000-0000-0000-000000000001';
        
        let finalDescription = updates.description;
        if (finalDescription !== undefined && current?.description) {
          const match = current.description.match(/<!--LUCKY_CONFIG:(.*?)-->/s);
          if (match && !finalDescription.includes('<!--LUCKY_CONFIG:')) {
            finalDescription = `${finalDescription.replace(/<!--LUCKY_CONFIG:(.*?)-->/s, '').trim()}\n${match[0]}`.trim();
          }
        }

        const payload = {
          ...updates,
          description: finalDescription !== undefined ? finalDescription : current?.description,
          updated_at: new Date().toISOString(),
        };

        try {
          const { data, error } = await client
            .from('events')
            .update(payload)
            .eq('id', targetId)
            .select()
            .maybeSingle();

          if (error) {
            // Check for RLS permission error (code 42501) or table missing
            if (error.code === '42501' || error.message?.includes('violates row-level security')) {
              console.warn('Supabase RLS policy restricted write on events table. Falling back to local storage sync.', error);
              // Fall through to local storage update
            } else {
              throw error;
            }
          } else if (!data) {
            // If no row was returned (e.g. ID mismatch or events table empty), attempt upsert
            const upsertPayload: EventConfig = {
              id: targetId,
              name: updates.name || current?.name || 'SPORTS DAY',
              year: updates.year || current?.year || '2026',
              description: updates.description ?? current?.description ?? '',
              logo_url: updates.logo_url ?? current?.logo_url ?? '',
              registration_open: updates.registration_open ?? current?.registration_open ?? true,
              registration_start: updates.registration_start ?? current?.registration_start ?? null,
              registration_end: updates.registration_end ?? current?.registration_end ?? null,
              success_message: updates.success_message ?? current?.success_message ?? '',
              status: updates.status || current?.status || 'ACTIVE',
              created_at: current?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { data: upsertData, error: upsertError } = await client
              .from('events')
              .upsert(upsertPayload, { onConflict: 'id' })
              .select()
              .maybeSingle();

            if (upsertError) {
              if (upsertError.code === '42501' || upsertError.message?.includes('violates row-level security')) {
                console.warn('Supabase RLS policy restricted upsert on events table. Falling back to local storage sync.', upsertError);
              } else {
                throw upsertError;
              }
            } else {
              const finalData = upsertData || upsertPayload;

              if (currentUser) {
                await auditService.log({
                  userId: currentUser.id,
                  userName: currentUser.display_name,
                  action: 'UPDATE_EVENT_SETTINGS',
                  entityType: 'EVENT',
                  entityId: targetId,
                  oldData: current,
                  newData: finalData,
                });
              }

              // Also keep local storage synchronized
              const events = getLocalCollection<EventConfig>(STORAGE_KEYS.EVENTS);
              const idx = events.findIndex((e) => e.id === targetId);
              if (idx !== -1) {
                events[idx] = finalData;
              } else {
                events.unshift(finalData);
              }
              setLocalCollection(STORAGE_KEYS.EVENTS, events);

              return finalData;
            }
          } else {
            if (currentUser) {
              await auditService.log({
                userId: currentUser.id,
                userName: currentUser.display_name,
                action: 'UPDATE_EVENT_SETTINGS',
                entityType: 'EVENT',
                entityId: eventId,
                oldData: current,
                newData: data,
              });
            }

            // Also keep local storage synchronized
            const events = getLocalCollection<EventConfig>(STORAGE_KEYS.EVENTS);
            const idx = events.findIndex((e) => e.id === eventId);
            if (idx !== -1) {
              events[idx] = data as EventConfig;
            } else {
              events.unshift(data as EventConfig);
            }
            setLocalCollection(STORAGE_KEYS.EVENTS, events);

            return data as EventConfig;
          }
        } catch (supabaseErr: any) {
          if (supabaseErr?.code === '42501' || supabaseErr?.message?.includes('violates row-level security')) {
            console.warn('Supabase RLS error caught, safely falling back to local persistence:', supabaseErr);
          } else {
            throw supabaseErr;
          }
        }
      }
    }

    // Local Storage Flow
    const events = getLocalCollection<EventConfig>(STORAGE_KEYS.EVENTS);
    const targetId = eventId || current?.id || 'a0000000-0000-0000-0000-000000000001';
    const index = events.findIndex((e) => e.id === targetId || e.id === eventId);

    const baseEvent = index !== -1 ? events[index] : (current || {
      id: targetId,
      name: 'SPORTS DAY',
      year: '2026',
      description: '',
      logo_url: '',
      registration_open: true,
      registration_start: null,
      registration_end: null,
      success_message: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const updatedEvent: EventConfig = {
      ...baseEvent,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (index !== -1) {
      events[index] = updatedEvent;
    } else {
      events.unshift(updatedEvent);
    }
    setLocalCollection(STORAGE_KEYS.EVENTS, events);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_EVENT_SETTINGS',
        entityType: 'EVENT',
        entityId: targetId,
        oldData: current,
        newData: updatedEvent,
      });
    }

    return updatedEvent;
  },

  async updateEvent(
    eventId: string,
    updates: Partial<EventConfig>,
    currentUser?: AdminUser
  ): Promise<EventConfig> {
    return this.updateEventSettings(eventId, updates, currentUser);
  },

  isRegistrationCurrentlyOpen(event: EventConfig): { isOpen: boolean; reason?: string } {
    if (!event.registration_open) {
      return { isOpen: false, reason: 'ขณะนี้ระบบปิดรับลงทะเบียน' };
    }

    const now = new Date();
    if (event.registration_start) {
      const start = new Date(event.registration_start);
      if (now < start) {
        return { isOpen: false, reason: 'ระบบยังไม่เปิดรับลงทะเบียน' };
      }
    }

    if (event.registration_end) {
      const end = new Date(event.registration_end);
      if (now > end) {
        return { isOpen: false, reason: 'หมดเวลาลงทะเบียนแล้ว' };
      }
    }

    return { isOpen: true };
  },
};
