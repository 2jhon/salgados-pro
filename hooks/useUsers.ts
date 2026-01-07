
import { useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { supabase, withRetry, safeStringifyError } from '../lib/supabase';

const LS_USERS_KEY = 'salgados_cached_users_v1';

const getLocalMeta = (userId: string) => {
  try {
    const item = localStorage.getItem(`user_meta_${userId}`);
    return item ? JSON.parse(item) : {};
  } catch { return {}; }
};

const saveLocalMeta = (userId: string, data: { avatarUrl?: string; bannerUrl?: string }) => {
  try {
    const current = getLocalMeta(userId);
    localStorage.setItem(`user_meta_${userId}`, JSON.stringify({ ...current, ...data }));
  } catch {}
};

const sanitizeSectionIds = (input: any): string[] => {
  if (!input) return [];
  let result: string[] = [];
  const extract = (item: any) => {
    if (!item) return;
    if (Array.isArray(item)) {
      item.forEach(extract);
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return;
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          extract(parsed);
        } catch (e) { result.push(trimmed); }
      } else { result.push(trimmed); }
    } else if (typeof item === 'number') {
      result.push(String(item));
    }
  };
  extract(input);
  return Array.from(new Set(result.map(id => id.replace(/["']/g, '').trim()).filter(id => id.length > 3)));
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const nexusReport = (msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string, data?: any) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId, data);
  };

  const mapUser = useCallback((u: any): User => {
    const cleanSections = sanitizeSectionIds(u.assigned_section_id);
    const localMeta = getLocalMeta(String(u.id));
    const hasProPlan = !!u.has_pro_plan; 
    const isAdFree = !!u.is_ad_free;
    const isAdvertiser = !!u.is_advertiser;

    return {
      id: String(u.id),
      workspaceId: u.workspace_id,
      name: u.name || '',
      email: u.email || '',
      cpf: u.cpf || '',
      phone: u.phone || '',
      role: u.role || 'MANAGER_FACTORY',
      accessCode: String(u.access_code || ''),
      assignedSectionIds: cleanSections,
      isAdFree: isAdFree,
      isAdvertiser: isAdvertiser,
      hideSalesValues: !!u.hide_sales_values,
      enableSounds: u.enable_sounds ?? true,
      hasProPlan: hasProPlan,
      userType: u.user_type || 'COMPANY',
      proExpiresAt: u.pro_expires_at,
      adFreeExpiresAt: u.ad_free_expires_at,
      advertiserExpiresAt: u.advertiser_expires_at,
      avatarUrl: u.avatar_url || localMeta.avatarUrl,
      bannerUrl: u.banner_url || localMeta.bannerUrl
    };
  }, []);

  const fetchUsersByWorkspace = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return [];
    setActiveWorkspaceId(workspaceId);
    setLoading(true);
    const taskId = `SYNC_USERS_${workspaceId}`;
    nexusReport(`Sincronizando base de equipe...`, 'START', 'NETWORK', taskId);
    
    try {
      const { data, error } = await supabase.from('users').select('*').eq('workspace_id', workspaceId);
      if (error) throw error;
      if (data) {
        const mapped = data.map(mapUser);
        setUsers(mapped);
        try { localStorage.setItem(`${LS_USERS_KEY}_${workspaceId}`, JSON.stringify(mapped)); } catch {}
        nexusReport(`Equipe sincronizada: ${mapped.length} membros.`, 'DONE', 'NETWORK', taskId);
        return mapped;
      }
    } catch (e: any) {
      nexusReport(`FALHA NA SINCRONIZAÇÃO USUÁRIOS`, 'FAIL', 'NETWORK', taskId, e);
      try {
        const saved = localStorage.getItem(`${LS_USERS_KEY}_${workspaceId}`);
        if (saved) { const parsed = JSON.parse(saved); setUsers(parsed); return parsed; }
      } catch (err) {}
    } finally { setLoading(false); }
    return [];
  }, [mapUser]);

  // REALTIME & REVALIDATION
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const channel = supabase
      .channel(`users_changes_${activeWorkspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `workspace_id=eq.${activeWorkspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newUser = mapUser(payload.new);
            setUsers(prev => [...prev, newUser]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedUser = mapUser(payload.new);
            setUsers(prev => prev.map(u => String(u.id) === String(updatedUser.id) ? updatedUser : u));
          } else if (payload.eventType === 'DELETE') {
            setUsers(prev => prev.filter(u => String(u.id) !== String(payload.old.id)));
          }
      })
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUsersByWorkspace(activeWorkspaceId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [activeWorkspaceId, mapUser, fetchUsersByWorkspace]);

  const findUserById = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapUser(data) : null;
    } catch (e) { return null; }
  }, [mapUser]);

  const createUser = async (userData: Omit<User, 'id'>) => {
    const cleanSections = sanitizeSectionIds(userData.assignedSectionIds);
    const payload = {
      workspace_id: userData.workspaceId,
      name: userData.name,
      email: userData.email,
      phone: userData.phone?.replace(/\D/g, ''),
      role: userData.role,
      access_code: String(userData.accessCode).trim(),
      assigned_section_id: cleanSections,
      is_ad_free: !!userData.isAdFree,
      is_advertiser: !!userData.isAdvertiser,
      hide_sales_values: !!userData.hideSalesValues,
      enable_sounds: userData.enableSounds ?? true,
      has_pro_plan: !!userData.hasProPlan,
      user_type: userData.userType || 'COMPANY',
      avatar_url: userData.avatarUrl || null,
      banner_url: userData.bannerUrl || null
    };

    try {
      const { data, error } = await supabase.from('users').insert([payload]).select();
      if (error) throw error;
      if (data) {
        const created = mapUser(data[0]);
        if (userData.avatarUrl || userData.bannerUrl) {
           saveLocalMeta(created.id, { avatarUrl: userData.avatarUrl, bannerUrl: userData.bannerUrl });
        }
        setUsers(prev => [...prev, created]);
        return created;
      }
    } catch (e: any) { throw new Error(safeStringifyError(e)); }
    return null;
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.cpf !== undefined) payload.cpf = updates.cpf;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.accessCode !== undefined) payload.access_code = String(updates.accessCode).trim();
    if (updates.hideSalesValues !== undefined) payload.hide_sales_values = !!updates.hideSalesValues;
    if (updates.enableSounds !== undefined) payload.enable_sounds = updates.enableSounds;
    if (updates.assignedSectionIds !== undefined) payload.assigned_section_id = sanitizeSectionIds(updates.assignedSectionIds);
    if (updates.proExpiresAt !== undefined) payload.pro_expires_at = updates.proExpiresAt;
    if (updates.adFreeExpiresAt !== undefined) payload.ad_free_expires_at = updates.adFreeExpiresAt;
    if (updates.advertiserExpiresAt !== undefined) payload.advertiser_expires_at = updates.advertiserExpiresAt;
    if (updates.hasProPlan !== undefined) payload.has_pro_plan = updates.hasProPlan;
    if (updates.isAdFree !== undefined) payload.is_ad_free = updates.isAdFree;
    if (updates.isAdvertiser !== undefined) payload.is_advertiser = updates.isAdvertiser;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.bannerUrl !== undefined) payload.banner_url = updates.bannerUrl;

    if (updates.avatarUrl !== undefined || updates.bannerUrl !== undefined) {
      saveLocalMeta(id, { avatarUrl: updates.avatarUrl, bannerUrl: updates.bannerUrl });
    }

    try {
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('users').update(payload).eq('id', id);
        if (error) throw error;
      }
      
      setUsers(prev => prev.map(u => String(u.id) === String(id) ? { 
        ...u, 
        ...updates,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : u.avatarUrl,
        bannerUrl: updates.bannerUrl !== undefined ? updates.bannerUrl : u.bannerUrl,
        assignedSectionIds: updates.assignedSectionIds ? sanitizeSectionIds(updates.assignedSectionIds) : u.assignedSectionIds
      } : u));
    } catch (e: any) {
      console.error("Erro ao salvar usuário:", e);
      setUsers(prev => prev.map(u => String(u.id) === String(id) ? { ...u, ...updates } : u));
    }
  };

  const removeUser = async (id: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      setUsers(prev => prev.filter(u => String(u.id) !== String(id)));
    } catch (e: any) { console.error(e); }
  };

  const findUserByEmail = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data && data.length > 0) ? mapUser(data[0]) : null;
    } catch (e: any) { throw e; }
  };

  const findUserByPhone = async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '').trim();
    if (!cleanPhone) return null;

    let searchFilter = `phone.eq.${cleanPhone}`;
    
    // Tenta formato com 55 se tiver 10 ou 11 digitos
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
       searchFilter += `,phone.eq.55${cleanPhone}`;
    }
    // Tenta formato sem 55 se começar com 55
    if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
       searchFilter += `,phone.eq.${cleanPhone.substring(2)}`;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(searchFilter)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data && data.length > 0) ? mapUser(data[0]) : null;
    } catch (e: any) { throw e; }
  };

  return { users, loading, createUser, fetchUsersByWorkspace, findUserByEmail, findUserByPhone, findUserById, removeUser, updateUser };
};
