
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

        // Se o PIN foi alterado, sincroniza com o Supabase Auth
        if (updates.accessCode !== undefined) {
          await supabase.rpc('sync_user_auth', { p_user_id: id });
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
        .ilike('email', `%${email.toLowerCase().trim()}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data && data.length > 0) ? mapUser(data[0]) : null;
    } catch (e: any) { throw e; }
  }, [mapUser]);

  const findUserByPhone = useCallback(async (phone: string) => {
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
  }, [mapUser]);

  const authenticateUser = useCallback(async (identifier: string, pin: string, type: 'COMPANY' | 'EMPLOYEE' | 'CUSTOMER') => {
    console.log('[Auth] Iniciando autenticação para:', identifier, 'Tipo:', type);
    try {
      let cleanIdentifier = identifier.trim();
      let searchEmail = '';
      let isPhone = !cleanIdentifier.includes('@') && !/[a-zA-Z]/.test(cleanIdentifier);
      
      if (type === 'COMPANY' && !isPhone) {
        console.log('[Auth] Identificado como E-mail');
        const user = await withRetry(() => findUserByEmail(cleanIdentifier)) as User | null;
        searchEmail = user?.email || cleanIdentifier.toLowerCase();
      } else {
        console.log('[Auth] Identificado como Telefone');
        const phone = cleanIdentifier.replace(/\D/g, '');
        const user = await withRetry(() => findUserByPhone(phone)) as User | null;
        if (user) {
          searchEmail = user.email || `${phone}@salgados.app`;
        } else {
          searchEmail = `${phone}@salgados.app`;
        }
      }

      console.log('[Auth] Email de busca Auth:', searchEmail);

      // 1. Try to sign in with Supabase Auth
      console.log('[Auth] Tentando signInWithPassword...');
      let authResult = await withRetry(() => supabase.auth.signInWithPassword({
        email: searchEmail,
        password: pin,
      }));

      // 2. If it fails, try the alternative
      if (authResult.error) {
        console.warn('[Auth] Falha no primeiro login Auth:', authResult.error.message);
        const phone = cleanIdentifier.replace(/\D/g, '');
        if (phone.length >= 8) {
          const altEmail = `${phone}@salgados.app`;
          if (altEmail !== searchEmail) {
            console.log('[Auth] Tentando login alternativo:', altEmail);
            const altResult = await withRetry(() => supabase.auth.signInWithPassword({
              email: altEmail,
              password: pin,
            }));
            if (!altResult.error) {
              console.log('[Auth] Login alternativo ok!');
              authResult = altResult;
            }
          }
        }
      }

      // 3. Fallback Ironclad / Mestre da Sincronização
      if (authResult.error && (authResult.error.message.includes('Invalid login credentials') || authResult.error.message.includes('invalid email') || authResult.error.message.includes('not a valid email') || authResult.error.message.includes('schema') || authResult.error.message.includes('finding user'))) {
        console.log('[Auth] Credenciais Auth falharam. Executando check na base de dados (Bypass RLS)...');
        nexusReport(`Credenciais Auth falharam. Executando check principal na base de dados...`, 'START', 'PROCESS');
        
        // BUSCA EXTREMA PRINCIPAL (VIA RPC PARA IGNORAR RLS)
        const lowC = cleanIdentifier.toLowerCase();
        const isActuallyEmail = cleanIdentifier.includes('@');
        const phoneC = isActuallyEmail ? '' : cleanIdentifier.replace(/\D/g, '');
        
        console.log('[Auth] Chamando RPC find_user_bypass_rls...');
        const { data: rpcSearch, error: rpcSearchError } = await supabase.rpc('find_user_bypass_rls', {
           p_email: isActuallyEmail ? lowC : '',
           p_phone: phoneC
        });
        
        let searchData: any[] = [];
        if (!rpcSearchError && rpcSearch) {
           searchData = Array.isArray(rpcSearch) ? rpcSearch : [rpcSearch];
        }

        if (searchData.length === 0) {
           console.warn("[Auth] RPC Bypass falhou ou retornou vazio. Erro:", rpcSearchError);
           try {
              const { data: q1 } = await supabase.from('users').select('*').ilike('email', `%${lowC}%`).order('user_type', { ascending: true });
              if (q1 && q1.length > 0) searchData = [...searchData, ...q1];
              
              if (phoneC && phoneC.length > 5 && searchData.length === 0) {
                const { data: q2 } = await supabase.from('users').select('*').ilike('phone', `%${phoneC}%`);
                if (q2 && q2.length > 0) searchData = [...searchData, ...q2];
              }
           } catch(e) {}
        }
        
        let publicUser = null;
        if (searchData && searchData.length > 0) {
           const targetRecord = type === 'COMPANY' 
                ? (searchData.find(u => u.user_type === 'COMPANY' || u.user_type === 'EMPLOYEE') || searchData[0])
                : (searchData.find(u => u.user_type === 'CUSTOMER') || searchData[0]);
           publicUser = mapUser(targetRecord);
        }

        if (!publicUser) {
           console.error('[Auth] Usuário não encontrado nem via Bypass');
           if (authResult.error.message.includes('schema')) {
               throw new Error(`Erro Crítico na API do Supabase (Database error querying schema). O banco de dados perdeu o sincronismo. SOLUÇÃO: Vá no painel do Supabase -> Settings -> API -> e clique no botão 'Reload' (Recarregar Schema).`);
           }
           throw new Error(`Nenhuma conta encontrada com a identificação: ${cleanIdentifier}. Se você é funcionário, tente digitar apenas o seu WHATSAPP.`);
        }
        
        console.log('[Auth] Usuário encontrado na base:', publicUser.name, 'Comparando PIN...');
        if (String(publicUser.accessCode).trim() !== pin.trim()) {
           throw new Error(`O usuário foi encontrado (${publicUser.name}), mas o PIN digitado está incorreto. Use o PIN gravado no sistema.`);
        }

        console.log('[Auth] PIN confere! Forçando sincronização...');
        const { data: syncedEmail, error: syncError } = await supabase.rpc('sync_user_auth', { p_user_id: publicUser.id });
        if (syncError) console.warn('[Auth] Erro na RPC sync_user_auth:', syncError);

        let rawTarget = syncedEmail || publicUser.email || `${publicUser.phone}@salgados.app`;
        const targetEmail = rawTarget.trim().toLowerCase();

        console.log('[Auth] Forçando novo signIn pós-sync:', targetEmail);
        let forcedAuth = await withRetry(() => supabase.auth.signInWithPassword({
          email: targetEmail,
          password: pin,
        }));

        if (forcedAuth.error) {
           console.warn('[Auth] Segundo signIn falhou. Tentando signUp (auto-registro)...');
           forcedAuth = await withRetry(() => supabase.auth.signUp({
             email: targetEmail,
             password: pin,
           }));

           if (forcedAuth.data?.user) {
             console.log('[Auth] SignUp bem sucedido (Auth ID:', forcedAuth.data.user.id, '). Vinculando...');
             const { error: relinkError } = await supabase.rpc('relink_user_auth', { 
               p_user_id: publicUser.id, 
               p_auth_id: forcedAuth.data.user.id, 
               p_pin: pin.trim() 
             });
             if (relinkError) throw new Error(`Trava de Banco de Dados: Não foi possível reconectar a conta. Detalhe: ${relinkError.message}`);
           }
        }

        if (forcedAuth.error) {
           if (forcedAuth.error.message.includes('schema')) {
               throw new Error(`O login falhou devido a um erro de esquema no banco. SOLUÇÃO: Vá no painel do Supabase -> 'Settings' > 'API' > clique em 'Reload' schema. (Detalhe: ${forcedAuth.error.message})`);
           }
           if (forcedAuth.error.message.includes('finding user')) {
               throw new Error(`Erro do Supabase: "Database error finding user". A plataforma que gerencia suas senhas está com erro interno ou gatilhos (triggers) defeituosos. Reinicie seu banco no painel da Supabase.`);
           }
           throw new Error(`Erro Crítico Auth: A conexão bloqueou definitivamente: ${forcedAuth.error.message}`);
        }

        authResult = forcedAuth;
        console.log('[Auth] Acesso restabelecido via Bypass');
        
      } else if (authResult.error) {
         console.error('[Auth] Erro terminal no login Auth:', authResult.error.message);
         if (authResult.error.message.includes('schema')) {
             throw new Error(`Supabase API Error: "Database error querying schema". Isso é um erro interno do servidor Supabase, causado por falha no cache do banco. SOLUÇÃO OBRIGATÓRIA: Vá no Painel da Supabase -> Configurações (Settings) -> API -> Clique no botão verde "Reload" para limpar o cache do PostgREST.`);
         }
         if (authResult.error.message.includes('finding user')) {
             throw new Error(`Erro Crítico do Servidor de Autenticação Supabase (Database error finding user). Verifique se você não deletou tabelas de sistema acidentalmente, e tente pausar e despausar o seu projeto no painel da Supabase.`);
         }
         throw authResult.error;
      }

      // 4. Fetch public.users record
      if (authResult.data?.user) {
         console.log('[Auth] Login Auth OK, buscando registro na tabela users...');
         let validTypes = type === 'COMPANY' ? ['COMPANY', 'EMPLOYEE'] : ['CUSTOMER'];
         
         const userResult = await withRetry(async () => await supabase
           .from('users')
           .select('*')
           .eq('auth_id', authResult.data.user!.id)
           .in('user_type', validTypes)
           .order('user_type', { ascending: true })
           .limit(1)
           .maybeSingle());
         
         const { data: userData } = userResult as any;
         
         if (userData) {
            console.log('[Auth] Usuário encontrado e validado:', userData.name);
            return mapUser(userData);
         } else {
            console.log('[Auth] Registro não encontrado com Auth ID, procurando orfãos...');
            const lowC = cleanIdentifier.toLowerCase();
            const phoneC = cleanIdentifier.replace(/\D/g, '');
            
            const { data: rpcSearch } = await supabase.rpc('find_user_bypass_rls', {
               p_email: lowC,
               p_phone: phoneC
            });

            let orphanRecord = null;
            let searchData = Array.isArray(rpcSearch) ? rpcSearch : (rpcSearch ? [rpcSearch] : []);
            
            if (searchData.length > 0) {
               orphanRecord = searchData.find(u => u.user_type === 'COMPANY' || u.user_type === 'EMPLOYEE') || 
                              searchData.find(u => u.user_type === 'CUSTOMER') || 
                              searchData[0];
            }

            if (orphanRecord && String(orphanRecord.access_code).trim() === pin.trim()) {
               console.log('[Auth] Vinculando conta orfã encontrada:', orphanRecord.name);
               const { error: relinkError } = await supabase.rpc('relink_user_auth', { 
                 p_user_id: orphanRecord.id, 
                 p_auth_id: authResult.data!.user!.id, 
                 p_pin: pin.trim() 
               });
               if (relinkError) throw new Error(`Trava de BD: Falha na revinculação de órfão. ${relinkError.message}`);
               
               return mapUser(orphanRecord);
            } else {
               throw new Error(`Cadastro não localizado ou corrompido. Peça ao ADM para excluir o seu perfil na equipe e recriar.`);
            }
         }
      }

      throw new Error(`ERRO FATAL: O Sistema não autorizou nem localizou os dados.`);
    } catch (e: any) {
      console.error("[Auth System] Falha crítica:", e.message || e);
      // Re-throw if it's already a clean error message
      if (e.message && e.message.length < 200 && !e.message.includes('AuthApiError')) {
        throw e;
      }
      throw new Error(safeStringifyError(e));
    }
  }, [findUserByEmail, findUserByPhone, mapUser, nexusReport]);

  return { users, loading, createUser, fetchUsersByWorkspace, findUserByEmail, findUserByPhone, findUserById, removeUser, updateUser, authenticateUser };
};
