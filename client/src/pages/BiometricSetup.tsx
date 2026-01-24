import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Fingerprint, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/_core/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export default function BiometricSetup() {
  const { user } = useAuth();
  const {
    isSupported,
    isRegistering,
    checkSupport,
    register,
    hasCredentials,
    clearCredentials,
  } = useBiometricAuth();
  
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    checkSupport();
    setIsRegistered(hasCredentials());
  }, [checkSupport, hasCredentials]);

  const handleRegister = async () => {
    if (!user) return;
    
    const result = await register(user.openId, user.name || user.email || 'User');
    if (result) {
      setIsRegistered(true);
    }
  };

  const handleRemove = () => {
    clearCredentials();
    setIsRegistered(false);
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Biometric Authentication</h1>
        <p className="text-muted-foreground mt-2">
          Enable fingerprint or Face ID for faster, more secure login
        </p>
      </div>

      {/* Support Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Device Compatibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isSupported ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Biometric authentication is supported</p>
                  <p className="text-sm text-muted-foreground">
                    Your device supports fingerprint or Face ID authentication
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium">Biometric authentication is not available</p>
                  <p className="text-sm text-muted-foreground">
                    Your device or browser doesn't support biometric authentication
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registration Status */}
      {isSupported && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Biometric Login Status
            </CardTitle>
            <CardDescription>
              {isRegistered
                ? 'Biometric authentication is enabled for your account'
                : 'Set up biometric authentication for quick and secure login'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isRegistered ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      You can now sign in using your fingerprint or Face ID
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleRemove}
                  >
                    Remove Biometric Login
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Click the button below to register your biometric credentials. You'll be prompted
                    to use your device's fingerprint sensor or Face ID.
                  </p>
                  <Button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="w-full sm:w-auto"
                  >
                    <Fingerprint className="mr-2 h-4 w-4" />
                    {isRegistering ? 'Setting up...' : 'Enable Biometric Login'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-1">1. One-Time Setup</h4>
              <p className="text-muted-foreground">
                Register your biometric credentials once. Your fingerprint or face data never leaves your device.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">2. Quick Login</h4>
              <p className="text-muted-foreground">
                On future visits, simply use your fingerprint or Face ID instead of typing your password.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">3. Secure & Private</h4>
              <p className="text-muted-foreground">
                Uses industry-standard WebAuthn protocol. Your biometric data is stored securely on your device only.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">4. Fallback Available</h4>
              <p className="text-muted-foreground">
                You can always use your regular password if biometric authentication is unavailable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
