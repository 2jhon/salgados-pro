
import { supabase } from './supabase';
import { toast } from 'sonner';

export interface ShareItem {
  name: string;
  value: number;
  quantity?: number;
}

export const shareReceipt = async (
  sectionName: string,
  items: ShareItem[],
  total: number,
  customerName?: string,
  workspaceId?: string
) => {
  // Fetch Business Profile Information
  let companyName = sectionName;
  let whatsapp = '';
  let instagram = '';

  if (workspaceId) {
    try {
      const { data } = await supabase.from('store_profiles').select('*').eq('workspace_id', workspaceId).single();
      if (data) {
        if (data.name) companyName = data.name;
        if (data.whatsapp) whatsapp = data.whatsapp;
        if (data.instagram) instagram = data.instagram;
      }
    } catch (err) {
      console.warn("Could not fetch store_profiles for sharing", err);
    }
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  const header = `*${companyName.toUpperCase()}*\n`;
  const subheader = `*RECIBO DE VENDA*\nSETOR: ${sectionName.toUpperCase()}\n`;
  const client = customerName ? `CLIENTE: ${customerName.toUpperCase()}\n` : '';
  const date = `DATA: ${new Date().toLocaleString('pt-BR')}\n`;
  const divider = `--------------------------------\n`;
  
  let itemsList = `*ITENS:*\n`;
  items.forEach(item => {
    const qty = item.quantity || 1;
    itemsList += `• ${qty}x ${item.name} - ${fmt(item.value)}\n`;
  });
  
  const footer = `${divider}*TOTAL: ${fmt(total)}*\n${divider}`;
  const social = [];
  if (whatsapp) social.push(`WhatsApp: ${whatsapp}`);
  if (instagram) social.push(`Instagram: @${instagram}`);
  
  const finalMessage = `${header}${subheader}${client}${date}${divider}${itemsList}${footer}\n${social.join('\n')}\n\nObrigado pela preferência!`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Recibo - ${companyName}`,
        text: finalMessage,
      });
      toast.success("Recibo compartilhado!");
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        copyToClipboard(finalMessage);
      }
    }
  } else {
    copyToClipboard(finalMessage);
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("Recibo copiado para a área de transferência!");
  }).catch(() => {
    toast.error("Erro ao copiar recibo.");
  });
};
