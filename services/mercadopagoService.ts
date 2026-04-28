export interface MPItem {
  id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
  description?: string;
  picture_url?: string;
}

export interface MPPreferenceResponse {
  id: string;
  init_point: string;
}

/**
 * Cria uma preferência de pagamento no Mercado Pago através do nosso backend.
 * O Checkout Pro redireciona o usuário para o ambiente seguro do Mercado Pago.
 */
export const createMPPreference = async (
  items: MPItem[],
  workspaceId: string,
  externalReference?: string
): Promise<MPPreferenceResponse> => {
  try {
    const response = await fetch('/api/mercadopago/create-preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items,
        workspace_id: workspaceId,
        external_reference: externalReference,
        returnUrl: typeof window !== 'undefined' ? window.location.origin : undefined
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error details:', errorData);
      
      let errorMessage = errorData.error || `Erro ${response.status}: Falha ao criar preferência`;
      if (errorData.details) errorMessage += `\nDetalhes: ${errorData.details}`;
      if (errorData.code) errorMessage += `\nCódigo: ${errorData.code}`;
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na integração Mercado Pago:', error);
    throw error;
  }
};

/**
 * Redireciona o usuário para o Checkout Pro do Mercado Pago
 */
export const redirectToMPCheckout = (initPoint: string) => {
  window.location.href = initPoint;
};

/**
 * Obtém a URL de autorização OAuth do Mercado Pago
 */
export const getMPAuthUrl = async (workspaceId: string): Promise<string> => {
  const response = await fetch(`/api/mercadopago/auth-url?workspaceId=${workspaceId}`);
  if (!response.ok) throw new Error("Falha ao obter URL de autenticação");
  const data = await response.json();
  return data.url;
};
