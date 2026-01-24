import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useEffect } from 'react';

interface BiometricLoginButtonProps {
  onSuccess: (userId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Biometric login button component
 * Provides fingerprint/Face ID authentication
 */
export function BiometricLoginButton({ onSuccess, onError }: BiometricLoginButtonProps) {
  const {
    isSupported,
    isAuthenticating,
    authenticate,
    hasCredentials,
    checkSupport,
  } = useBiometricAuth();

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  const handleBiometricLogin = async () => {
    const credential = await authenticate();
    
    if (credential) {
      onSuccess(credential.userId);
    } else if (onError) {
      onError('Biometric authentication failed');
    }
  };

  // Don't show button if not supported or no credentials registered
  if (!isSupported || !hasCredentials()) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleBiometricLogin}
      disabled={isAuthenticating}
      className="w-full gap-2"
    >
      <Fingerprint className="h-5 w-5" />
      {isAuthenticating ? 'Authenticating...' : 'Sign in with Biometrics'}
    </Button>
  );
}
