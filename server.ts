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
    // Forçamos a URL e a Service Key do projeto para garantir consistência total
    const supabaseUrl = 'https://vvxvwntjwjzalzjiwrmm.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eHZ3bnRqd2p6YWx6aml3cm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA5OTIyNywiZXhwIjoyMDgxNjc1MjI3fQ.KGjXwoLbnfycQOdHLSy564ujtnx2LopIgAGNg1Vo63E';

    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      console.log("[Kernel] Supabase Admin inicializado.");
    } catch (e) {
      console.error("[Kernel] Erro ao instanciar Supabase Client:", e);
      return null;
    }
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
    const { items, external_reference, workspace_id, returnUrl } = req.body;

    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
         return res.status(500).json({ error: "Serviço de banco de dados não configurado no servidor." });
      }

      console.log(`[MP] Criando preferência para workspace: ${workspace_id}`);

      if (!workspace_id) {
        console.error("[MP] workspace_id não fornecido");
        return res.status(400).json({ error: "Identificador da loja (workspace_id) não fornecido." });
      }

      // 1. Buscar configurações da loja no Supabase (comissão e token)
      // Forçamos a conversão para string e tratamos possíveis erros de conexão
      let storeProfile: any = null;
      let storeError: any = null;

      try {
        const response = await supabase
          .from('store_profiles')
          .select('*')
          .eq('workspace_id', String(workspace_id).trim())
          .limit(1);
        
        storeProfile = response.data?.[0] || null;
        storeError = response.error;
      } catch (err: any) {
        console.error("[MP] Exceção ao consultar Supabase:", err);
        return res.status(500).json({ 
          error: "Erro na comunicação com o banco de dados.",
          details: err.message || String(err)
        });
      }

      if (storeError) {
        console.error("[MP] Erro retornado pelo Supabase:", storeError);
        return res.status(500).json({ 
          error: "Erro interno no banco de dados ao buscar perfil da loja.", 
          details: storeError.message,
          code: storeError.code,
          hint: storeError.hint
        });
      }

      if (!storeProfile) {
        console.error("[MP] Perfil da loja não encontrado no DB para workspace_id:", workspace_id);
        return res.status(404).json({ error: "Configurações de pagamento da loja não encontradas. Verifique se o perfil da loja foi criado corretamente no painel." });
      }

      // 2. Determinar qual token usar (da loja ou do admin)
      // Se a loja não tem token próprio, tentamos usar o global (fallback)
      const sellerAccessToken = storeProfile.mp_access_token || process.env.MP_ACCESS_TOKEN;
      
      if (!sellerAccessToken) {
        console.error("[MP] Nenhum token disponível para workspace:", workspace_id);
        return res.status(400).json({ error: "Esta loja ainda não habilitou pagamentos ou o sistema global não está configurado." });
      }

      const client = new MercadoPagoConfig({ accessToken: sellerAccessToken });
      const preference = new Preference(client);
      
      const host = req.headers['x-forwarded-host'] || req.get('host');
      let baseUrl = returnUrl || `https://${host}`;
      
      if (!returnUrl && (host?.includes('localhost') || host?.includes('127.0.0.1'))) {
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
        payer: {
          email: "comprador_salgados@email.com",
          first_name: "Cliente",
          last_name: "Marketplace",
          identification: {
            type: "CPF",
            number: "19100000000"
          }
        },
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12,
        },
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

  // Rota para PAGAMENTO DE ANÚNCIOS (Vai para a conta do Administrador do Sistema)
  app.post("/api/mercadopago/create-ad-preference", async (req, res) => {
    const { adId, userId, adTitle, price, duration, returnUrl } = req.body;

    try {
      const adminAccessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
      
      if (!adminAccessToken) {
        return res.status(500).json({ error: "Configuração do sistema incompleta (Token Admin não encontrado)." });
      }

      const client = new MercadoPagoConfig({ accessToken: adminAccessToken });
      const preference = new Preference(client);
      
      const host = req.headers['x-forwarded-host'] || req.get('host');
      let baseUrl = returnUrl || `https://${host}`;
      if (!returnUrl && (host?.includes('localhost') || host?.includes('127.0.0.1'))) {
        baseUrl = `http://${host}`;
      }

      const totalPrice = Number(price);

      const body: any = {
        items: [
          {
            id: adId,
            title: `Impulsionamento: ${adTitle}`,
            quantity: 1,
            unit_price: Number(totalPrice),
            currency_id: 'BRL'
          }
        ],
        external_reference: `AD_BOOST|${userId}|${adId}|${Date.now()}`,
        back_urls: {
          success: `${baseUrl}/?status=approved&type=ad`,
          failure: `${baseUrl}/?status=failure&type=ad`,
          pending: `${baseUrl}/?status=pending&type=ad`,
        },
        auto_return: "approved",
        statement_descriptor: "SALGADOSPRO",
      };

      const result = await preference.create({ body });
      res.json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
      console.error("[MP Ad] Erro:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Erro desconhecido ao gerar checkout do anúncio." });
    }
  });

  // Rota para PAGAMENTO DE PLANOS (Vai para a conta do Administrador do Sistema)
  app.post("/api/mercadopago/create-plan-preference", async (req, res) => {
    const { planId, userId, planName, price, returnUrl } = req.body;

    try {
      // O token do ADMIN deve estar no .env como MP_ACCESS_TOKEN
      const adminAccessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
      
      if (!adminAccessToken) {
        return res.status(500).json({ error: "Configuração do sistema incompleta (Token Admin não encontrado)." });
      }

      const client = new MercadoPagoConfig({ accessToken: adminAccessToken });
      const preference = new Preference(client);
      
      const host = req.headers['x-forwarded-host'] || req.get('host');
      let baseUrl = returnUrl || `https://${host}`;
      if (!returnUrl && (host?.includes('localhost') || host?.includes('127.0.0.1'))) {
        baseUrl = `http://${host}`;
      }

      const body: any = {
        items: [
          {
            id: planId,
            title: `Assinatura: ${planName}`,
            quantity: 1,
            unit_price: Number(price),
            currency_id: 'BRL'
          }
        ],
        external_reference: `SUBSCRIPTION|${userId}|${planId}|${Date.now()}`,
        back_urls: {
          success: `${baseUrl}/?status=approved&type=plan`,
          failure: `${baseUrl}/?status=failure&type=plan`,
          pending: `${baseUrl}/?status=pending&type=plan`,
        },
        auto_return: "approved",
        statement_descriptor: "SALGADOSPRO",
      };

      const result = await preference.create({ body });
      res.json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
      console.error("[MP Plan] Erro:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Erro desconhecido ao assinar plano." });
    }
  });

  // Webhook para Assinaturas de Planos do Sistema (Admin)
  app.post("/api/mercadopago/plan-webhook", async (req, res) => {
    const { action, data, type } = req.body;
    
    // Mercado Pago envia 'topic=payment' em alguns casos
    const topic = req.query.topic || type;
    const resourceId = data?.id || req.query.id;

    console.log(`[MP Webhook] Recebido: ${action} | Topic: ${topic} | ID: ${resourceId}`);
    
    res.status(200).send("OK");

    if ((action === "payment.created" || action === "payment.updated" || topic === "payment") && resourceId) {
      try {
        const adminAccessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
          headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const payment = await response.json();

        if (payment.status === "approved" && payment.external_reference?.startsWith("SUBSCRIPTION|")) {
          const [_, userId, planId] = payment.external_reference.split("|");
          console.log(`[SUBSCRIPTION SUCCESS] Usuário: ${userId} | Plano: ${planId}`);

          const supabase = getSupabaseAdmin();
          if (supabase) {
            // Get the user's workspace
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('workspace_id, company_id')
              .eq('id', userId)
              .limit(1);
            
            const workspaceId = userProfile?.[0]?.company_id || userProfile?.[0]?.workspace_id;
            
            if (workspaceId) {
              const now = new Date();
              const expires = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString(); // 1 month

              await supabase
                .from('store_profiles')
                .update({ 
                  pro_expires_at: expires,
                  ad_free_expires_at: expires
                })
                .eq('workspace_id', workspaceId);
              console.log(`[SUBSCRIPTION ACTIVATED] Assinatura do workspace ${workspaceId} renovada até ${expires}`);
            }
          }
        }

        if (payment.status === "approved" && payment.external_reference?.startsWith("AD_BOOST|")) {
          const [_, userId, adId] = payment.external_reference.split("|");
          console.log(`[AD SUCCESS] Usuário: ${userId} | Anúncio: ${adId}`);
          
          const supabase = getSupabaseAdmin();
          if (supabase) {
            await supabase
              .from('app_banners')
              .update({ 
                payment_status: 'PAID',
                is_approved: true
              })
              .eq('id', adId);
            console.log(`[AD ACTIVATED] Anuncio ${adId} definido como PAID e is_approved=true`);
          }
        }
      } catch (err) {
        console.error("[Webhook Plan] Erro crítico:", err);
      }
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
      
      let baseUrl = '';
      if (parts.length > 1) {
        baseUrl = decodeURIComponent(parts[1]);
      } else {
        baseUrl = process.env.APP_URL || '';
        if (!baseUrl) {
          const host = req.headers['x-forwarded-host'] || req.get('host');
          baseUrl = `https://${host}`;
          if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
            baseUrl = `http://${host}`;
          }
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
      // Usamos upsert para o caso de o perfil não ter sido criado corretamente no registro
      const { error } = await supabase
        .from('store_profiles')
        .upsert({
          workspace_id: workspaceId,
          mp_access_token: response.access_token,
          mp_refresh_token: response.refresh_token,
          mp_user_id: String(response.user_id),
          mp_public_key: response.public_key,
          active: true // Forçamos ativação ao conectar pagamento
        }, { onConflict: 'workspace_id' });

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
                  const payloadRaw = encodeURIComponent(JSON.stringify({
                       mpAccessToken: "${response.access_token}",
                       mpRefreshToken: "${response.refresh_token}",
                       mpUserId: "${response.user_id}",
                       mpPublicKey: "${response.public_key}"
                  }));
                  
                  try {
                    if (window.opener && !window.opener.closed) {
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
                  } catch (e) {
                    console.error("Erro no proxy client-side", e);
                  }
                  
                  // Fallback visual caso window.close() falhe (cross origin isolado) ou aba tenha sido aberta em webview
                  setTimeout(() => {
                     window.location.href = '/?mp_auth=' + payloadRaw;
                  }, 1000);
                  
                }, 500);
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
              <p style="font-size: 14px; color: #334155; margin-bottom: 1rem; text-align: left; background: #f1f5f9; padding: 1rem; border-radius: 8px;">
                <strong>Atenção:</strong> Se você está no celular e houve recarregamento da página, a autorização expirou. Tente novamente.<br/><br/>
                Se o erro persistir, significa que o painel do Mercado Pago não reconheceu a URL de redirecionamento deste dispositivo.<br/>
                Certifique-se de acessar a aba <strong>Sistema &rarr; Vitrine</strong> e adicionar <strong>OBRIGATORIAMENTE</strong> o link exato gerado lá.
              </p>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 2rem;">Ou verifique suas chaves (Client ID e Secret).</p>
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
