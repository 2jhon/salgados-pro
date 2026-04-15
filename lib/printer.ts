
/// <reference types="web-bluetooth" />

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
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();
      this.characteristic = characteristics?.[0] || null;

      return true;
    } catch (error: any) {
      console.error('Printer connection error:', error);
      throw error;
    }
  }

  async printReceipt(companyName: string, items: any[], total: number, customerName?: string) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error('Impressora não conectada');
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
    
    // Header
    commands.push(...esc.center);
    commands.push(...esc.boldOn);
    commands.push(...Array.from(encoder.encode(companyName.toUpperCase() + '\n')));
    commands.push(...esc.boldOff);
    commands.push(...Array.from(encoder.encode('--------------------------------\n')));
    
    if (customerName) {
      commands.push(...esc.left);
      commands.push(...Array.from(encoder.encode(`CLIENTE: ${customerName.toUpperCase()}\n`)));
    }
    
    commands.push(...esc.left);
    commands.push(...Array.from(encoder.encode(`DATA: ${new Date().toLocaleString('pt-BR')}\n`)));
    commands.push(...Array.from(encoder.encode('--------------------------------\n')));

    // Column Headers
    commands.push(...esc.left);
    commands.push(...Array.from(encoder.encode('QTD  ITEM                VALOR\n')));
    commands.push(...Array.from(encoder.encode('--------------------------------\n')));

    items.forEach(item => {
      const qty = String(item.qty || item.quantity || 1).substring(0, 3).padEnd(4);
      const name = item.name.substring(0, 18).toUpperCase().padEnd(19);
      const value = (item.value || 0).toFixed(2).substring(0, 8).padStart(8);
      
      const line = `${qty}${name}${value}\n`;
      commands.push(...Array.from(encoder.encode(line)));
    });

    commands.push(...Array.from(encoder.encode('--------------------------------\n')));
    
    // Total
    commands.push(...esc.right);
    commands.push(...esc.boldOn);
    commands.push(...Array.from(encoder.encode(`TOTAL: R$ ${total.toFixed(2)}\n`)));
    commands.push(...esc.boldOff);
    
    commands.push(...esc.center);
    commands.push(...Array.from(encoder.encode('\nOBRIGADO PELA PREFERENCIA!\n')));
    
    commands.push(...esc.feed, ...esc.feed, ...esc.feed);
    commands.push(...esc.cut);

    // Send in chunks
    const chunkSize = 20;
    for (let i = 0; i < commands.length; i += chunkSize) {
      const chunk = new Uint8Array(commands.slice(i, i + chunkSize));
      await this.characteristic?.writeValue(chunk);
    }
  }
}

export const printer = new ThermalPrinter();
