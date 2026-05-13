CREATE OR REPLACE FUNCTION hard_delete_workspace(p_workspace_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
    -- VERIFICAÇÃO DE SEGURANÇA: Apenas o Super Admin pode executar
    IF (current_setting('request.jwt.claims', true)::json ->> 'email') NOT IN ('hacker3d22@gmail.com', 'brasilanonymous66@gmail.com') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas o Super Admin pode excluir workspaces.';
    END IF;

    -- Deletar todos os dados associados a empresa
    -- Usa blocos try-catch internos independentes para as tabelas para não abortar tudo se uma tabela não existir
    
    BEGIN DELETE FROM public.transactions WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.inventory WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.notes WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.ads WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.app_banners WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.customers WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.reports WHERE reported_workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN DELETE FROM public.app_config WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.store_profiles WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN DELETE FROM public.users WHERE workspace_id = p_workspace_id; EXCEPTION WHEN OTHERS THEN END;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
