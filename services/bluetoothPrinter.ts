
/// <reference types="web-bluetooth" />

/**
 * Bluetooth Thermal Printer Service
 */

export interface BluetoothPrinter {
  name: string;
  device: BluetoothDevice;
}

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<string> {
    try {
      // Filter for common thermal printer services
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common Generic Access
          { services: ['e7e11101-4966-4a5a-a972-467144c433c0'] }  // Common Printer Service
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7e11101-4966-4a5a-a972-467144c433c0']
      });

      if (!this.device) throw new Error("Nenhum dispositivo selecionado.");

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("Falha ao conectar ao servidor GATT.");

      // Try to find the characteristic for writing
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            break;
          }
        }
        if (this.characteristic) break;
      }

      if (!this.characteristic) throw new Error("Não foi possível encontrar a característica de escrita.");

      return this.device.name || "Impressora Bluetooth";
    } catch (error) {
      console.error("Bluetooth Connection Error:", error);
      throw error;
    }
  }

  async print(text: string) {
    if (!this.characteristic) throw new Error("Impressora não conectada.");

    // Basic ESC/POS commands
    const encoder = new TextEncoder();
    const init = new Uint8Array([0x1B, 0x40]); // ESC @ (Initialize)
    const cut = new Uint8Array([0x1D, 0x56, 0x41, 0x03]); // GS V A 3 (Partial cut)
    
    // Convert text to Uint8Array (assuming UTF-8, though some printers need specific encoding)
    const data = encoder.encode(text + "\n\n\n");
    
    const fullData = new Uint8Array(init.length + data.length + cut.length);
    fullData.set(init);
    fullData.set(data, init.length);
    fullData.set(cut, init.length + data.length);

    // Write in chunks (MTU limit is usually 20 bytes for some devices)
    const chunkSize = 20;
    for (let i = 0; i < fullData.length; i += chunkSize) {
      const chunk = fullData.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
    }
  }

  isConnected() {
    return !!this.characteristic;
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();
