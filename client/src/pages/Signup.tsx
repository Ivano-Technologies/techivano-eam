import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { ButtonLoader } from "@/components/ButtonLoader";
import { AuthPageLayout, AuthIconCircle } from "@/components/AuthPageLayout";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT Abuja"
];

const AGENCIES = [
  "Nigerian Red Cross Society",
  "International Red Cross",
  "Government Agency",
  "NGO/Non-Profit",
  "Private Sector",
  "Other"
];

const REGISTRATION_PURPOSES = [
  "Asset Management",
  "Work Order Management",
  "Inventory Control",
  "Financial Tracking",
  "Compliance Reporting",
  "System Administration",
  "Read-Only Access"
];

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    confirmEmail: "",
    password: "",
    jobTitle: "",
    phoneNumber: "",
    phoneCountryCode: "+234",
    agency: "",
    geographicalArea: "",
    registrationPurpose: "",
    employeeId: "",
    department: "",
    supervisorName: "",
    supervisorEmail: "",
  });
  
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const signupMutation = trpc.auth.signupWithPassword.useMutation({
    onSuccess: (data) => {
      setMessage({ 
        type: "success", 
        text: "Registration submitted successfully! An administrator will review your request and you'll receive an email once approved." 
      });
      // Reset form
      setFormData({
        name: "",
        email: "",
        confirmEmail: "",
        password: "",
        jobTitle: "",
        phoneNumber: "",
        phoneCountryCode: "+234",
        agency: "",
        geographicalArea: "",
        registrationPurpose: "",
        employeeId: "",
        department: "",
        supervisorName: "",
        supervisorEmail: "",
      });
      setAgreedToTerms(false);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message || "Registration failed. Please try again." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.jobTitle || 
        !formData.phoneNumber || !formData.agency || !formData.geographicalArea || 
        !formData.registrationPurpose) {
      setMessage({ type: "error", text: "Please fill in all required fields marked with *" });
      return;
    }
    
    if (formData.email !== formData.confirmEmail) {
      setMessage({ type: "error", text: "Email addresses do not match" });
      return;
    }
    
    if (formData.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    
    if (!agreedToTerms) {
      setMessage({ type: "error", text: "You must agree to the Terms of Use and Privacy Policy" });
      return;
    }

    signupMutation.mutate({
      email: formData.email,
      name: formData.name,
      password: formData.password,
      jobTitle: formData.jobTitle,
      phoneNumber: formData.phoneNumber,
      phoneCountryCode: formData.phoneCountryCode,
      agency: formData.agency,
      geographicalArea: formData.geographicalArea,
      registrationPurpose: formData.registrationPurpose,
      employeeId: formData.employeeId,
      department: formData.department,
      supervisorName: formData.supervisorName,
      supervisorEmail: formData.supervisorEmail,
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AuthPageLayout
      maxWidth="lg"
      icon={
        <AuthIconCircle>
          <span className="text-sm font-bold text-white">NR</span>
        </AuthIconCircle>
      }
      title="Register for NRCS EAM"
      description={
        <>
          Nigerian Red Cross Society — Enterprise Asset Management
          <br />
          <span className="text-xs mt-1 block">Please complete this form to request access. Your registration will be reviewed by an administrator.</span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    disabled={signupMutation.isPending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    type="text"
                    placeholder="e.g., Asset Manager"
                    value={formData.jobTitle}
                    onChange={(e) => updateField("jobTitle", e.target.value)}
                    disabled={signupMutation.isPending}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Mobile Phone *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.phoneCountryCode}
                    onValueChange={(value) => updateField("phoneCountryCode", value)}
                    disabled={signupMutation.isPending}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+234">🇳🇬 +234</SelectItem>
                      <SelectItem value="+1">🇺🇸 +1</SelectItem>
                      <SelectItem value="+44">🇬🇧 +44</SelectItem>
                      <SelectItem value="+27">🇿🇦 +27</SelectItem>
                      <SelectItem value="+254">🇰🇪 +254</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="8012345678"
                    value={formData.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                    disabled={signupMutation.isPending}
                    required
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  disabled={signupMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmEmail">Confirm Email Address *</Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={formData.confirmEmail}
                  onChange={(e) => updateField("confirmEmail", e.target.value)}
                  disabled={signupMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  disabled={signupMutation.isPending}
                  required
                  minLength={8}
                />
              </div>
            </div>

            {/* Organizational Information */}
            <div className="space-y-4 pt-4">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Organizational Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="agency">Agency/Organization *</Label>
                <Select
                  value={formData.agency}
                  onValueChange={(value) => updateField("agency", value)}
                  disabled={signupMutation.isPending}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENCIES.map(agency => (
                      <SelectItem key={agency} value={agency}>{agency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geographicalArea">Geographical Area/State *</Label>
                <Select
                  value={formData.geographicalArea}
                  onValueChange={(value) => updateField("geographicalArea", value)}
                  disabled={signupMutation.isPending}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National HQ">National HQ</SelectItem>
                    {NIGERIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationPurpose">You are registering on NRCS EAM to: *</Label>
                <Select
                  value={formData.registrationPurpose}
                  onValueChange={(value) => updateField("registrationPurpose", value)}
                  disabled={signupMutation.isPending}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your primary purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_PURPOSES.map(purpose => (
                      <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID (Optional)</Label>
                  <Input
                    id="employeeId"
                    type="text"
                    placeholder="EMP-12345"
                    value={formData.employeeId}
                    onChange={(e) => updateField("employeeId", e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input
                    id="department"
                    type="text"
                    placeholder="e.g., Operations"
                    value={formData.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supervisorName">Supervisor Name (Optional)</Label>
                  <Input
                    id="supervisorName"
                    type="text"
                    placeholder="Jane Smith"
                    value={formData.supervisorName}
                    onChange={(e) => updateField("supervisorName", e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisorEmail">Supervisor Email (Optional)</Label>
                  <Input
                    id="supervisorEmail"
                    type="email"
                    placeholder="jane.smith@example.com"
                    value={formData.supervisorEmail}
                    onChange={(e) => updateField("supervisorEmail", e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start space-x-2 pt-4">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={signupMutation.isPending}
              />
              <label
                htmlFor="terms"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link href="/legal/terms" className="text-[#DC2626] hover:underline">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy" className="text-[#DC2626] hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => window.location.href = "/login"}
                disabled={signupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
                disabled={signupMutation.isPending}
              >
                {signupMutation.isPending ? (
                  <>
                    <ButtonLoader className="mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Register"
                )}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-[#DC2626] hover:underline font-medium">
                Sign In
              </Link>
            </div>
          </form>

      <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
        <p className="font-medium">📋 Registration Process</p>
        <p className="mt-2">1. Submit your registration form</p>
        <p>2. Admin reviews your request</p>
        <p>3. You receive email notification of approval/rejection</p>
        <p className="mt-2">Questions? Contact admin@nrcs.org.ng</p>
      </div>
    </AuthPageLayout>
  );
}
