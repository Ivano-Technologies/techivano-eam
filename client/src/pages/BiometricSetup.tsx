import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Fingerprint, Shield, Smartphone, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function BiometricSetup() {
  const [, setLocation] = useLocation();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    // Check if WebAuthn is supported
    const supported = window.PublicKeyCredential !== undefined;
    setIsSupported(supported);

    // Check if user has enrolled
    const enrolled = localStorage.getItem('biometric_enrolled') === 'true';
    setIsEnrolled(enrolled);
  }, []);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      // Create WebAuthn credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32), // In production, get from server
          rp: {
            name: "NRCS EAM",
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16),
            name: "user@nrcs.org",
            displayName: "NRCS User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },  // ES256
            { alg: -257, type: "public-key" } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
          attestation: "none"
        }
      });

      if (credential) {
        localStorage.setItem('biometric_enrolled', 'true');
        setIsEnrolled(true);
        toast.success("Biometric authentication enabled successfully!");
      } else {
        toast.error("Failed to enable biometric authentication");
      }
    } catch (error: any) {
      console.error('Biometric enrollment error:', error);
      toast.error(error.message || "Enrollment failed");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemove = async () => {
    try {
      localStorage.removeItem('biometric_enrolled');
      setIsEnrolled(false);
      toast.success("Biometric authentication disabled");
    } catch (error: any) {
      toast.error(error.message || "Failed to disable biometric authentication");
    }
  };

  if (!isSupported) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              Biometric Authentication Not Supported
            </CardTitle>
            <CardDescription>
              Your device or browser does not support biometric authentication (WebAuthn).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              To use biometric authentication, you need:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>A modern browser (Chrome, Safari, Edge, Firefox)</li>
              <li>HTTPS connection (secure connection)</li>
              <li>A device with biometric hardware (fingerprint scanner, Face ID, etc.)</li>
            </ul>
            <Button onClick={() => setLocation("/profile")} className="mt-6">
              Back to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Biometric Authentication</h1>
        <p className="text-muted-foreground mt-2">
          Secure your account with fingerprint or Face ID
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEnrolled ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Biometric Authentication Enabled
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                Biometric Authentication Disabled
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isEnrolled
              ? "You can now log in using your fingerprint or Face ID"
              : "Enable biometric authentication for faster and more secure login"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEnrolled ? (
            <Button variant="destructive" onClick={handleRemove}>
              Disable Biometric Authentication
            </Button>
          ) : (
            <Button onClick={handleEnroll} disabled={isEnrolling}>
              <Fingerprint className="mr-2 h-4 w-4" />
              {isEnrolling ? "Enrolling..." : "Enable Biometric Authentication"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Benefits Card */}
      <Card>
        <CardHeader>
          <CardTitle>Why Use Biometric Authentication?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Enhanced Security</h3>
              <p className="text-sm text-muted-foreground">
                Your biometric data never leaves your device and cannot be stolen or guessed
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Faster Login</h3>
              <p className="text-sm text-muted-foreground">
                No need to remember or type passwords - just use your fingerprint or face
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Privacy Protected</h3>
              <p className="text-sm text-muted-foreground">
                Biometric authentication uses industry-standard WebAuthn protocol
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => setLocation("/profile")}>
        Back to Profile
      </Button>
    </div>
  );
}
