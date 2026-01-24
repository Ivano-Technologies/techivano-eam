import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface BiometricCredential {
  id: string;
  publicKey: string;
  userId: string;
  createdAt: number;
}

const CREDENTIALS_STORAGE_KEY = 'biometric_credentials';

/**
 * Hook for biometric authentication using WebAuthn API
 * Supports fingerprint, Face ID, and other platform authenticators
 */
export function useBiometricAuth() {
  const [isSupported, setIsSupported] = useState(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    navigator.credentials !== undefined
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  /**
   * Check if biometric authentication is available
   */
  const checkSupport = useCallback(async () => {
    if (!window.PublicKeyCredential) {
      setIsSupported(false);
      return false;
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setIsSupported(available);
      return available;
    } catch (error) {
      console.error('Failed to check biometric support:', error);
      setIsSupported(false);
      return false;
    }
  }, []);

  /**
   * Register biometric credentials for a user
   */
  const register = useCallback(async (userId: string, userName: string) => {
    if (!isSupported) {
      toast.error('Biometric authentication is not supported on this device');
      return null;
    }

    setIsRegistering(true);

    try {
      // Generate challenge (in production, this should come from server)
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'NRCS EAM',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Store credential info (in production, send to server)
      const credentialData: BiometricCredential = {
        id: credential.id,
        publicKey: arrayBufferToBase64(credential.rawId),
        userId,
        createdAt: Date.now(),
      };

      saveCredential(credentialData);

      toast.success('Biometric authentication enabled');
      return credentialData;
    } catch (error: any) {
      console.error('Biometric registration failed:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Biometric registration cancelled');
      } else {
        toast.error('Failed to register biometric authentication');
      }
      
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [isSupported]);

  /**
   * Authenticate using biometric credentials
   */
  const authenticate = useCallback(async () => {
    if (!isSupported) {
      toast.error('Biometric authentication is not supported');
      return null;
    }

    const credentials = getStoredCredentials();
    if (credentials.length === 0) {
      toast.error('No biometric credentials found. Please register first.');
      return null;
    }

    setIsAuthenticating(true);

    try {
      // Generate challenge (in production, this should come from server)
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: credentials.map(cred => ({
          id: base64ToArrayBuffer(cred.publicKey),
          type: 'public-key',
          transports: ['internal'],
        })),
        timeout: 60000,
        userVerification: 'required',
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Authentication failed');
      }

      // Find matching credential
      const matchedCredential = credentials.find(
        cred => cred.id === assertion.id
      );

      if (!matchedCredential) {
        throw new Error('Credential not found');
      }

      toast.success('Biometric authentication successful');
      return matchedCredential;
    } catch (error: any) {
      console.error('Biometric authentication failed:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Authentication cancelled');
      } else {
        toast.error('Biometric authentication failed');
      }
      
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isSupported]);

  /**
   * Check if user has registered biometric credentials
   */
  const hasCredentials = useCallback(() => {
    return getStoredCredentials().length > 0;
  }, []);

  /**
   * Remove all biometric credentials
   */
  const clearCredentials = useCallback(() => {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    toast.success('Biometric credentials removed');
  }, []);

  return {
    isSupported,
    isRegistering,
    isAuthenticating,
    checkSupport,
    register,
    authenticate,
    hasCredentials,
    clearCredentials,
  };
}

// Helper functions
function saveCredential(credential: BiometricCredential) {
  const existing = getStoredCredentials();
  const updated = [...existing.filter(c => c.userId !== credential.userId), credential];
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(updated));
}

function getStoredCredentials(): BiometricCredential[] {
  try {
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load credentials:', error);
    return [];
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
