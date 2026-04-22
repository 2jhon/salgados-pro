export function generatePixPayload(
  pixKey: string,
  merchantName: string,
  merchantCity: string,
  amount?: number,
  txid: string = '***'
): string {
  const formatLength = (val: string) => val.length.toString().padStart(2, '0');
  
  const payloadFormat = '000201';
  
  const gui = '0014br.gov.bcb.pix';
  const key = `01${formatLength(pixKey)}${pixKey}`;
  const merchantAccount = `26${formatLength(gui + key)}${gui}${key}`;
  
  const merchantCategory = '52040000';
  const currency = '5303986';
  
  let amountStr = '';
  if (amount && amount > 0) {
    const amt = amount.toFixed(2);
    amountStr = `54${formatLength(amt)}${amt}`;
  }
  
  const country = '5802BR';
  
  const name = merchantName.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const merchantNameStr = `59${formatLength(name)}${name}`;
  
  const city = merchantCity.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const merchantCityStr = `60${formatLength(city)}${city}`;
  
  const txidStr = `05${formatLength(txid)}${txid}`;
  const additionalData = `62${formatLength(txidStr)}${txidStr}`;
  
  const payload = `${payloadFormat}${merchantAccount}${merchantCategory}${currency}${amountStr}${country}${merchantNameStr}${merchantCityStr}${additionalData}6304`;
  
  // Calculate CRC16
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  const crcStr = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  
  return `${payload}${crcStr}`;
}
