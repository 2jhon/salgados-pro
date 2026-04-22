
import { useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { supabase, withRetry, safeStringifyError, isNetworkError, isTimeoutError } from '../lib/supabase';

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
  // Using new RegExp to avoid potential tokenizer issues with /["']/g in some environments
  const quoteRegex = new RegExp('["\']', 'g');
  return Array.from(new Set(result.map(id => id.replace(quoteRegex, '').trim()).filter(id => id.length > 3)));
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const nexusReport = useCallback((msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string, data?: any) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId, data);
  }, []);

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
      bannerUrl: u.banner_url || localMeta.bannerUrl,
      lastSeen: u.last_seen,
      isBlocked: !!u.is_blocked,
      totalSpent: u.total_spent || 0,
      planActivations: u.plan_activations || 0
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
  }, [mapUser, nexusReport]);

  // REALTIME & REVALIDATION
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const channel = supabase
      .channel(`users_changes_${activeWorkspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `workspace_id=eq.${activeWorkspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newUser = mapUser(payload.new);
            setUsers(prev => {
              if (prev.some(u => String(u.id) === String(newUser.id))) return prev;
              return [...prev, newUser];
            });
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

  const createUser = useCallback(async (userData: Omit<User, 'id'>) => {
    const cleanSections = sanitizeSectionIds(userData.assignedSectionIds);
    const phoneClean = userData.phone?.replace(/\D/g, '');
    const payload = {
      workspace_id: userData.workspaceId,
      name: userData.name,
      email: userData.email,
      phone: phoneClean,
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
      // 1. Check if user already exists in public.users by phone or email
      const orFilters: string[] = [];
      if (phoneClean && phoneClean.trim() !== '') {
        orFilters.push(`phone.eq.${phoneClean}`);
      }
      if (userData.email && userData.email.trim() !== '') {
        orFilters.push(`email.eq.${userData.email.toLowerCase().trim()}`);
      }

      let existingUsers: any[] = [];
      
      if (orFilters.length > 0) {
        const existingUsersResult = await withRetry(async () => await supabase
          .from('users')
          .select('*')
          .or(orFilters.join(',')));
        existingUsers = (existingUsersResult as any).data || [];
      }

      if (existingUsers && existingUsers.length > 0) {
        const sameType = existingUsers.find(u => u.user_type === (userData.userType || 'COMPANY'));
        if (sameType) {
          throw new Error("Já existe um contato com esse E-mail ou WhatsApp no sistema. Mude os dados e tente novamente.");
        }
        
        const existingAuthId = existingUsers.find(u => u.auth_id)?.auth_id;
        if (existingAuthId) {
          const linkedResult = await withRetry(async () => await supabase
            .from('users')
            .insert([{ ...payload, auth_id: existingAuthId }])
            .select());
          
          const { data: linkedData, error: linkError } = linkedResult as any;
          if (!linkError && linkedData) return mapUser(linkedData[0]);
        }
      }

      let authUserId = null;
      const finalPayload = { ...payload, auth_id: authUserId };

      const insertResult = await withRetry(async () => await supabase.from('users').insert([finalPayload]).select());
      const { data, error } = insertResult as any;
      if (error) throw error;
      if (data) {
        const created = mapUser(data[0]);
        if (userData.avatarUrl || userData.bannerUrl) {
           saveLocalMeta(created.id, { avatarUrl: userData.avatarUrl, bannerUrl: userData.bannerUrl });
        }
        setUsers(prev => {
          if (prev.some(u => String(u.id) === String(created.id))) return prev;
          return [...prev, created];
        });
        return created;
      }
    } catch (e: any) { 
      if (e instanceof Error) throw e;
      throw new Error(safeStringifyError(e)); 
    }
    return null;
  }, [mapUser, nexusReport]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
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
    if (updates.lastSeen !== undefined) payload.last_seen = updates.lastSeen;

    if (updates.avatarUrl !== undefined || updates.bannerUrl !== undefined) {
      saveLocalMeta(id, { avatarUrl: updates.avatarUrl, bannerUrl: updates.bannerUrl });
    }

    try {
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('users').update(payload).eq('id', id);
        if (error) throw error;

        // Se o PIN foi alterado, sincroniza com o Supabase Auth (Opcional, não deve travar o salvamento)
        if (updates.accessCode !== undefined) {
          try {
            await supabase.rpc('sync_user_auth', { p_user_id: id });
          } catch (rpcErr) {
            console.warn("[Auth Sync] Falha não-bloqueante na sincronização de PIN:", rpcErr);
          }
        }
      }
      
      setUsers(prev => prev.map(u => String(u.id) === String(id) ? { 
        ...u, 
        ...updates,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : u.avatarUrl,
        bannerUrl: updates.bannerUrl !== undefined ? updates.bannerUrl : u.bannerUrl,
        lastSeen: updates.lastSeen !== undefined ? updates.lastSeen : u.lastSeen,
        assignedSectionIds: updates.assignedSectionIds ? sanitizeSectionIds(updates.assignedSectionIds) : u.assignedSectionIds
      } : u));
    } catch (e: any) {
      console.error("Erro ao salvar usuário:", e);
      // Removed the erroneous setUsers call in the catch block
      throw e;
    }
  }, []);

  const removeUser = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      setUsers(prev => prev.filter(u => String(u.id) !== String(id)));
    } catch (e: any) { console.error(e); }
  }, []);

  const findUserByEmail = useCallback(async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const sorted = [...data].sort((a, b) => {
        const score = (u: any) => u.role === 'OWNER' ? 3 : (u.role && u.role.includes('MANAGER') ? 2 : 1);
        return score(b) - score(a);
      });
      
      return mapUser(sorted[0]);
    } catch (e: any) { throw e; }
  }, [mapUser]);

  const findUserByPhone = useCallback(async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '').trim();
    if (!cleanPhone) return null;

    let searchFilter = `phone.eq.${cleanPhone}`;
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
       searchFilter += `,phone.eq.55${cleanPhone}`;
    }
    if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
       searchFilter += `,phone.eq.${cleanPhone.substring(2)}`;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(searchFilter)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const sorted = [...data].sort((a, b) => {
        const score = (u: any) => u.role === 'OWNER' ? 3 : (u.role && u.role.includes('MANAGER') ? 2 : 1);
        return score(b) - score(a);
      });

      return mapUser(sorted[0]);
    } catch (e: any) { throw e; }
  }, [mapUser]);

  const authenticateUser = useCallback(async (identifier: string, pin: string, type: 'COMPANY' | 'EMPLOYEE' | 'CUSTOMER') => {
    console.log('[Auth] Iniciando autenticação para:', identifier, 'Tipo:', type);
    try {
      let cleanIdentifier = identifier.trim();
      let searchEmail = '';
      let isPhone = !cleanIdentifier.includes('@') && !/[a-zA-Z]/.test(cleanIdentifier);
      
      if (type === 'COMPANY' && !isPhone) {
        const user = await withRetry(() => findUserByEmail(cleanIdentifier)) as User | null;
        searchEmail = user?.email || cleanIdentifier.toLowerCase();
      } else {
        const phone = cleanIdentifier.replace(/\D/g, '');
        const user = await withRetry(() => findUserByPhone(phone)) as User | null;
        searchEmail = user?.email || (phone ? `${phone}@salgados.app` : cleanIdentifier.toLowerCase());
      }

      let authResult = await withRetry(() => supabase.auth.signInWithPassword({
        email: searchEmail,
        password: pin,
      }));

      if (authResult.error) {
        const phone = cleanIdentifier.replace(/\D/g, '');
        if (phone.length >= 8) {
          const altEmail = `${phone}@salgados.app`;
          if (altEmail !== searchEmail) {
            const altResult = await withRetry(() => supabase.auth.signInWithPassword({
              email: altEmail,
              password: pin,
            }));
            if (!altResult.error) authResult = altResult;
          }
        }
      }

      if (authResult.error && (authResult.error.message.includes('Invalid login credentials') || authResult.error.message.includes('invalid email') || authResult.error.message.includes('schema') || authResult.error.message.includes('finding user'))) {
        const lowC = cleanIdentifier.toLowerCase();
        const isActuallyEmail = cleanIdentifier.includes('@');
        const phoneC = isActuallyEmail ? '' : cleanIdentifier.replace(/\D/g, '');
        
        const { data: rpcSearch } = await supabase.rpc('find_user_bypass_rls', {
           p_email: isActuallyEmail ? lowC : '',
           p_phone: phoneC
        });
        
        let searchData = Array.isArray(rpcSearch) ? rpcSearch : (rpcSearch ? [rpcSearch] : []);
        if (searchData.length === 0) {
           try {
              const { data: q1 } = await supabase.from('users').select('*').eq('email', lowC);
              if (q1) searchData = [...searchData, ...q1];
              if (phoneC && searchData.length === 0) {
                const { data: q2 } = await supabase.from('users').select('*').eq('phone', phoneC);
                if (q2) searchData = [...searchData, ...q2];
              }
           } catch(e) {}
        }
        
        let publicUser = null;
        if (searchData && searchData.length > 0) {
           const sorted = [...searchData].sort((a, b) => {
              const score = (u: any) => u.role === 'OWNER' ? 3 : (u.role && u.role.includes('MANAGER') ? 2 : 1);
              return score(b) - score(a);
           });
           const targetRecord = type === 'COMPANY' 
                ? (sorted.find(u => (u.user_type === 'COMPANY' || u.user_type === 'EMPLOYEE') && u.role !== 'CUSTOMER') || sorted[0])
                : (sorted.find(u => u.user_type === 'CUSTOMER' || u.role === 'CUSTOMER') || sorted[0]);
           publicUser = mapUser(targetRecord);
        }

        if (!publicUser) throw new Error(`Nenhuma conta encontrada com a identificação: ${cleanIdentifier}`);
        if (String(publicUser.accessCode).trim() !== pin.trim()) throw new Error(`PIN incorreto para ${publicUser.name}.`);

        let syncedEmailResult: any = null;
        try {
          const { data: syncedEmail } = await supabase.rpc('sync_user_auth', { p_user_id: publicUser.id });
          syncedEmailResult = syncedEmail;
        } catch (rpcErr) {
          console.warn("[Auth Sync] Falha na sincronização de email durante login:", rpcErr);
        }
        const targetEmail = (syncedEmailResult || publicUser.email || `${publicUser.phone}@salgados.app`).toLowerCase();

        let forcedAuth = await withRetry(() => supabase.auth.signInWithPassword({ email: targetEmail, password: pin }));
        if (forcedAuth.error) {
           forcedAuth = await withRetry(() => supabase.auth.signUp({ email: targetEmail, password: pin }));
           if (forcedAuth.data?.user) {
              await supabase.rpc('relink_user_auth', { p_user_id: publicUser.id, p_auth_id: forcedAuth.data.user.id, p_pin: pin.trim() });
           }
        }
        if (forcedAuth.error) throw new Error(`Erro Crítico Auth: ${forcedAuth.error.message}`);
        authResult = forcedAuth;
      } else if (authResult.error) throw authResult.error;

      if (authResult.data?.user) {
         let validTypes = type === 'COMPANY' ? ['COMPANY', 'EMPLOYEE'] : ['CUSTOMER'];
         const { data: searchDataResults } = await withRetry(async () => await supabase
            .from('users')
            .select('*')
            .eq('auth_id', authResult.data.user!.id)) as any;
          
         if (searchDataResults && searchDataResults.length > 0) {
            const sorted = [...searchDataResults].sort((a, b) => {
               const score = (u: any) => u.role === 'OWNER' ? 3 : (u.role && u.role.includes('MANAGER') ? 2 : 1);
               return score(b) - score(a);
            });
            const filtered = type === 'COMPANY' 
               ? sorted.filter(u => validTypes.includes(u.user_type) && u.role !== 'CUSTOMER')
               : sorted.filter(u => u.user_type === 'CUSTOMER' || u.role === 'CUSTOMER');
            
            const target = filtered.length > 0 ? filtered[0] : sorted[0];
            return mapUser(target);
         } else {
            const lowC = cleanIdentifier.toLowerCase();
            const phoneC = cleanIdentifier.replace(/\D/g, '');
            const { data: rpcSearch } = await supabase.rpc('find_user_bypass_rls', { p_email: lowC, p_phone: phoneC });
            let searchData = Array.isArray(rpcSearch) ? rpcSearch : (rpcSearch ? [rpcSearch] : []);
            if (searchData.length > 0) {
               const sorted = [...searchData].sort((a, b) => {
                  const score = (u: any) => u.role === 'OWNER' ? 3 : (u.role && u.role.includes('MANAGER') ? 2 : 1);
                  return score(b) - score(a);
               });
               const orphan = type === 'COMPANY'
                  ? (sorted.find(u => (u.user_type === 'COMPANY' || u.user_type === 'EMPLOYEE') && u.role !== 'CUSTOMER') || sorted[0])
                  : (sorted.find(u => u.user_type === 'CUSTOMER' || u.role === 'CUSTOMER') || sorted[0]);

               if (orphan && String(orphan.access_code).trim() === pin.trim()) {
                  await supabase.rpc('relink_user_auth', { p_user_id: orphan.id, p_auth_id: authResult.data!.user!.id, p_pin: pin.trim() });
                  return mapUser(orphan);
               }
            }
         }
      }
      throw new Error(`ERRO FATAL: O Sistema não autorizou nem localizou os dados.`);
    } catch (e: any) {
      console.error("[Auth System] Falha:", e.message || e);
      throw e;
    }
  }, [findUserByEmail, findUserByPhone, mapUser, nexusReport]);

  return { users, loading, createUser, fetchUsersByWorkspace, findUserByEmail, findUserByPhone, findUserById, removeUser, updateUser, authenticateUser };
};
