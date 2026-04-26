import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { MercadoPagoConfig, Preference, OAuth } from 'mercadopago';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis de ambiente do arquivo .env ou .env.example
dotenv.config();

// Configuração do Supabase Admin para atualizar os tokens das lojas
let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    // Fallback to the same ones used in frontend if not provided in process.env
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vvxvwntjwjzalzjiwrmm.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eHZ3bnRqd2p6YWx6aml3cm1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTkyMjcsImV4cCI6MjA4MTY3NTIyN30.HrjArI3Mq5dvsYhQXTJw-cL691J7QMhj9ixh6mzz6sI';

    if (!supabaseUrl || !supabaseServiceKey) {
      // Retorna null em vez de crashar, permitindo o servidor subir
      return null;
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}

const app = express();
const PORT = 3000;

app.set('trust proxy', true);
app.use(express.json());

// Configuração do Mercado Pago (Super Admin Application)
let mpClient: MercadoPagoConfig | null = null;

function getMPClient() {
  if (!mpClient) {
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-dummy-token-for-oauth';
    mpClient = new MercadoPagoConfig({ accessToken });
  }
  return mpClient;
}

async function startServer() {
  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Rota para criar preferência de pagamento (Checkout Pro)
  app.post("/api/mercadopago/create-preference", async (req, res) => {
    const { items, external_reference, workspace_id } = req.body;

    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
         return res.status(500).json({ error: "Serviço de banco de dados não configurado no servidor." });
      }

      // 1. Buscar configurações da loja no Supabase (comissão e token)
      const { data: storeProfile, error: storeError } = await supabase
        .from('store_profiles')
        .select('mp_access_token, commission_active, commission_rate')
        .eq('workspace_id', workspace_id)
        .single();

      if (storeError || !storeProfile) {
        console.error("[MP] Perfil da loja não encontrado:", workspace_id);
        return res.status(404).json({ error: "Configurações de pagamento da loja não encontradas." });
      }

      // 2. Determinar qual token usar (da loja ou do admin)
      // Se a loja não tem token próprio, tentamos usar o global (fallback)
      const sellerAccessToken = storeProfile.mp_access_token || process.env.MP_ACCESS_TOKEN;
      
      if (!sellerAccessToken) {
        return res.status(500).json({ error: "Loja não está conectada ao Mercado Pago." });
      }

      const client = new MercadoPagoConfig({ accessToken: sellerAccessToken });
      const preference = new Preference(client);
      
      const host = req.headers['x-forwarded-host'] || req.get('host');
      let baseUrl = `https://${host}`;
      
      if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
        baseUrl = `http://${host}`;
      }

      // Calcular comissão se estiver ativa
      let marketplaceFee = 0;
      if (storeProfile.commission_active && storeProfile.commission_rate > 0) {
        const totalItems = items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
        marketplaceFee = totalItems * (storeProfile.commission_rate / 100);
        // Garantir 2 casas decimais
        marketplaceFee = Math.round(marketplaceFee * 100) / 100;
      }

      const body: any = {
        items,
        external_reference: external_reference || `REF_${Date.now()}`,
        back_urls: {
          success: `${baseUrl}/`,
          failure: `${baseUrl}/`,
          pending: `${baseUrl}/`,
        },
        auto_return: "approved",
        statement_descriptor: "SALGADOSPRO",
      };

      // Se houver comissão, adicionamos o marketplace_fee
      // Nota: Para marketplace_fee funcionar, o pagamento deve ser criado com o token do vendedor (OAuth)
      // e o Super Admin deve ser o dono da aplicação que gerou o token.
      if (marketplaceFee > 0 && storeProfile.mp_access_token) {
        body.marketplace_fee = marketplaceFee;
      }

      const result = await preference.create({ body });

      console.log(`[MP] Preferência criada. Vendedor: ${workspace_id}. Comissão: ${marketplaceFee}`);
      res.json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
      console.error("[MP] Erro detalhado:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Erro desconhecido ao criar preferência" });
    }
  });

  // ROIAS PARA OAUTH MERCADO PAGO
  app.get("/api/mercadopago/auth-url", (req, res) => {
    const workspaceId = req.query.workspaceId;

    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

    const clientId = process.env.MP_CLIENT_ID;
    
    // Default fallback
    let baseUrl = process.env.APP_URL || '';
    if (!baseUrl) {
      const host = req.headers['x-forwarded-host'] || req.get('host');
      baseUrl = `https://${host}`;
      if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
        baseUrl = `http://${host}`;
      }
    }
    
    // Normalize to ensure valid url
    try {
        const parsedBase = new URL(baseUrl);
        baseUrl = parsedBase.origin; // e.g. https://domain.com without trailing slashes
    } catch (e) {
        // Remove trailing slash if present
        baseUrl = baseUrl.replace(/\/+$/, '');
    }
    
    const redirectUri = `${baseUrl}/api/mercadopago/callback`;
    
    // Embed the baseUrl securely in the state parameters
    // Mercado Pago allows strings, we will use a separator '|'
    const state = `${workspaceId}|${encodeURIComponent(baseUrl)}`;
    
    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.json({ url: authUrl });
  });

  app.get("/api/mercadopago/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1.5rem; shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 2px solid #fee2e2;">
              <h2 style="color: #e11d48;">Erro na Conexão</h2>
              <p>Código de autorização ou Estado não fornecidos pelo Mercado Pago.</p>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 2rem;">A conexão foi cancelada ou estruturada incorretamente.</p>
              <a href="/" style="background: #e11d48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Voltar para o Painel</a>
            </div>
          </body>
        </html>
      `);
    }

    const stateStr = String(state);
    const parts = stateStr.split('|');
    const workspaceId = parts[0];

    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
         return res.status(500).send("Serviço de banco de dados não configurado.");
      }

      const oauth = new OAuth(getMPClient()!);
      
      let baseUrl = process.env.APP_URL || '';
      if (!baseUrl) {
        const host = req.headers['x-forwarded-host'] || req.get('host');
        baseUrl = `https://${host}`;
        if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
          baseUrl = `http://${host}`;
        }
      }
      
      try {
          const parsedBase = new URL(baseUrl);
          baseUrl = parsedBase.origin;
      } catch (e) {
          baseUrl = baseUrl.replace(/\/+$/, '');
      }
      
      const redirectUri = `${baseUrl}/api/mercadopago/callback`;

      const response = await oauth.create({
        body: {
          client_id: process.env.MP_CLIENT_ID || '',
          client_secret: process.env.MP_CLIENT_SECRET || '',
          code: String(code),
          redirect_uri: redirectUri
        }
      });

      // Atualizar o store_profile com os novos tokens
      const { error } = await supabase
        .from('store_profiles')
        .update({
          mp_access_token: response.access_token,
          mp_refresh_token: response.refresh_token,
          mp_user_id: String(response.user_id),
          mp_public_key: response.public_key
        })
        .eq('workspace_id', workspaceId);

      // Pode falhar silenciosamente se o servidor não tiver a SERVICE_ROLE_KEY
      if (error) console.error("Database update error:", error);

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1.5rem; shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
              <h2 style="color: #059669;">Conectado com Sucesso!</h2>
              <p>Sua loja agora está integrada ao Mercado Pago.</p>
              <p>Concluindo configuração... Aguarde.</p>
              <script>
                setTimeout(() => {
                  try {
                    if (window.opener) {
                      window.opener.postMessage({ 
                         type: 'MP_AUTH_SUCCESS', 
                         payload: {
                           mpAccessToken: "${response.access_token}",
                           mpRefreshToken: "${response.refresh_token}",
                           mpUserId: "${response.user_id}",
                           mpPublicKey: "${response.public_key}"
                         }
                      }, '*');
                      window.close();
                    }
                    
                    const payloadRaw = encodeURIComponent(JSON.stringify({
                       mpAccessToken: "${response.access_token}",
                       mpRefreshToken: "${response.refresh_token}",
                       mpUserId: "${response.user_id}",
                       mpPublicKey: "${response.public_key}"
                    }));
                    
                    // Fallback visual se não fechar a janela
                    setTimeout(() => {
                       document.body.innerHTML += '<div style="margin-top: 2rem;"><a href="/?mp_auth=' + payloadRaw + '" style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Voltar para o Painel</a></div>';
                    }, 1000);

                  } catch (e) {
                    console.error("Erro no proxy client-side", e);
                  }
                }, 1000);
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("[MP OAuth Error]:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1.5rem; shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 2px solid #fee2e2;">
              <h2 style="color: #e11d48;">Erro na Conexão</h2>
              <p>Ocorreu um erro ao processar a autorização do Mercado Pago.</p>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 2rem;">Verifique suas chaves (Client ID e Secret) nas configurações.</p>
              <a href="/" style="background: #e11d48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Voltar para o Painel</a>
            </div>
          </body>
        </html>
      `);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
