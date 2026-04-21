export const isWebAuthnSupported = () => {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
};

function generateChallenge() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge;
}

export const registerBiometryLocal = async (userId: string, identifier: string, pin: string, userType: string) => {
  if (!isWebAuthnSupported()) throw new Error('Biometria não suportada neste dispositivo.');

  if (window.self !== window.top) {
     throw new Error('DICA: Para usar a biometria, por favor, clique com o botão direito para enviar o App para a tela inicial do celular ou abra-o em uma ABA NOVA (fora do Studio). Os navegadores bloqueiam biometria em visualizações embutidas.');
  }

  const challenge = generateChallenge();
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge,
      rp: {
        name: "Salgados Manager",
        id: window.location.hostname
      },
      user: {
        id: window.crypto.getRandomValues(new Uint8Array(16)),
        name: identifier,
        displayName: identifier
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
        requireResidentKey: true
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  if (!credential) {
    throw new Error('Falha ao registrar biometria.');
  }

  localStorage.setItem('biometry_auth_data', JSON.stringify({ identifier, pin, userId, userType }));
  return true;
};

export const verifyBiometryLocal = async () => {
  if (!isWebAuthnSupported()) throw new Error('Biometria não suportada.');

  if (window.self !== window.top) {
     throw new Error('DICA: Abra o App em nova aba ou instale na tela inicial para a digital funcionar (bloqueio do navegador em visualizador).');
  }

  const challenge = generateChallenge();
  
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge,
      rpId: window.location.hostname,
      userVerification: "required",
      timeout: 60000
    }
  });

  if (!assertion) {
    throw new Error('Autenticação biométrica falhou.');
  }

  const stored = localStorage.getItem('biometry_auth_data');
  if (!stored) throw new Error('Nenhuma biometria cadastrada neste aparelho.');

  return JSON.parse(stored);
};

export const hasBiometryConfigured = () => {
  // Try to parse just to be safe
  try {
     const val = localStorage.getItem('biometry_auth_data');
     if (val) { JSON.parse(val); return true; }
  } catch {}
  return false;
};

export const removeBiometryLocal = () => {
  localStorage.removeItem('biometry_auth_data');
};
