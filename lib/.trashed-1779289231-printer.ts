
/// <reference types="web-bluetooth" />
import { supabase } from './supabase';

/**
 * Utility for Thermal Printer (ESC/POS) via Web Bluetooth
 */

export class ThermalPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        throw new Error("IOS_NOT_SUPPORTED");
      }

      if (!navigator || !navigator.bluetooth) {
        throw new Error("Web Bluetooth não suportado neste navegador. Use Chrome/Edge no Android ou PC.");
      }

      if (typeof navigator.bluetooth.getAvailability === 'function') {
        const isAvailable = await navigator.bluetooth.getAvailability();
        if (!isAvailable) {
          throw new Error("Bluetooth desativado ou adaptador não encontrado no dispositivo.");
        }
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("Falha ao conectar servidor GATT.");
      
      const services = await server.getPrimaryServices();
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            break;
          }
        }
        if (this.characteristic) break;
      }
      return true;
    } catch (error: any) {
      console.error('Printer connection error:', error);
      throw error;
    }
  }

  async printReceipt(sectionName: string, items: any[], total: number, customerName?: string, workspaceId?: string) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error('Impressora não conectada');
    }

    // Fetch Business Profile Information
    let companyName = sectionName;
    let cnpj = '';
    let address = '';
    let whatsapp = '';
    let instagram = '';

    if (workspaceId) {
      try {
        const { data } = await supabase.from('store_profiles').select('*').eq('workspace_id', workspaceId).single();
        if (data) {
          if (data.name) companyName = data.name;
          if (data.cnpj) cnpj = data.cnpj;
          if (data.address) address = data.address;
          if (data.whatsapp) whatsapp = data.whatsapp;
          if (data.instagram) instagram = data.instagram;
        }
      } catch (err) {
        console.warn("Could not fetch store_profiles for printing", err);
      }
    }

    const encoder = new TextEncoder();
    const esc = {
      init: [0x1b, 0x40],
      center: [0x1b, 0x61, 0x01],
      left: [0x1b, 0x61, 0x00],
      right: [0x1b, 0x61, 0x02],
      boldOn: [0x1b, 0x45, 0x01],
      boldOff: [0x1b, 0x45, 0x00],
      feed: [0x0a],
      cut: [0x1d, 0x56, 0x00]
    };

    let commands: number[] = [];
    commands.push(...esc.init);
    
    // Formatting Helpers
    const sanitize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    // ----------------------------------------------------
    // HEADER (Professional Franchise Layout)
    // ----------------------------------------------------
    commands.push(...esc.center);
    commands.push(...esc.boldOn);
    commands.push(...Array.from(encoder.encode(sanitize(companyName) + '\n')));
    commands.push(...esc.boldOff);
    
    if (cnpj) {
      commands.push(...Array.from(encoder.encode(`CNPJ: ${cnpj}\n`)));
    }
    if (address) {
      const addrSanitized = sanitize(address);
      if (addrSanitized.length > 32) {
        commands.push(...Array.from(encoder.encode(`${addrSanitized.substring(0, 32)}\n`)));
        commands.push(...Array.from(encoder.encode(`${addrSanitized.substring(32, 64)}\n`)));
      } else {
         commands.push(...Array.from(encoder.encode(`${addrSanitized}\n`)));
      }
    }
    if (whatsapp) {
      commands.push(...Array.from(encoder.encode(`WHATSAPP: ${whatsapp}\n`)));
    }

    commands.push(...Array.from(encoder.encode('--------------------------------\n')));
    
    // Receipt Details
    commands.push(...esc.boldOn);
    commands.push(...Array.from(encoder.encode('RECIBO DE VENDA\n')));
    commands.push(...esc.boldOff);
    commands.push(...Array.from(encoder.encode(`SETOR: ${sanitize(sectionName)}\n`)));

    if (customerName) {
      const sanitizedCustomer = sanitize(customerName);
      let truncatedCustomer = sanitizedCustomer.length > 23 ? sanitizedCustomer.substring(0, 23) : sanitizedCustomer;
      commands.push(...Array.from(encoder.encode(`CLIENTE: ${truncatedCustomer}\n`)));
    }
    
    commands.push(...esc.left);
    commands.push(...Array.from(encoder.encode(`DATA: ${new Date().toLocaleString('pt-BR')}\n`)));
    commands.push(...Array.from(encoder.encode('--------------------------------\n')));

    // Column Headers
    commands.push(...esc.left);
    commands.push(...Array.from(encoder.encode('QTD  ITEM                VALOR\n')));
    commands.push(...Array.from(encoder.encode('--------------------------------\n')));

    items.forEach(item => {
      const qtyStr = String(item.qty || item.quantity || 1).substring(0, 3).padEnd(4);
      const nameStr = sanitize(item.name).substring(0, 18).padEnd(19);
      const valStr = (item.value || 0).toFixed(2).substring(0, 8).padStart(8);
      
      const line = `${qtyStr}${nameStr}${valStr}\n`;
      commands.push(...Array.from(encoder.encode(line)));
    });

    commands.push(...Array.from(encoder.encode('--------------------------------\n')));
    
    // Total
    commands.push(...esc.right);
    commands.push(...esc.boldOn);
    commands.push(...Array.from(encoder.encode(`TOTAL: R$ ${total.toFixed(2)}\n`)));
    commands.push(...esc.boldOff);
    
    // FOOTER
    commands.push(...esc.center);
    commands.push(...Array.from(encoder.encode('\nOBRIGADO PELA PREFERENCIA!\n')));
    
    if (instagram) {
      commands.push(...Array.from(encoder.encode(`SIGA-NOS: @${sanitize(instagram)}\n`)));
    }
    
    commands.push(...esc.feed, ...esc.feed, ...esc.feed);
    commands.push(...esc.cut);

    // Send in chunks with throttling to prevent GATT overflow
    // BLE DEFAULT MTU IS 20 BYTES. Do NOT increase above 20 unless MTU negotiation is guaranteed.
    // Over 20 throws: "GATT operation failed for unknown reason".
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const chunkSize = 20; 
    
    for (let i = 0; i < commands.length; i += chunkSize) {
      const chunk = new Uint8Array(commands.slice(i, i + chunkSize));
      
      if (this.characteristic) {
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      }
      
      await sleep(40); // 40ms delay gives the printer time to digest the buffer
    }
  }
}

export const printer = new ThermalPrinter();
