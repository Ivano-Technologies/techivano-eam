import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { toast } from "sonner";

type Theme = "light" | "dark" | "system";

export default function ThemeSettings() {
  const [selectedTheme, setSelectedTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Load saved theme preference
    const savedTheme = (localStorage.getItem("theme") as Theme) || "system";
    setSelectedTheme(savedTheme);
    applyTheme(savedTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
      if (selectedTheme === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [selectedTheme]);

  const applyTheme = (theme: Theme) => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  };

  const handleThemeChange = (theme: Theme) => {
    setSelectedTheme(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success(`Theme changed to ${theme}`);
  };

  const themeOptions = [
    {
      value: "light" as Theme,
      label: "Light",
      description: "Clean slate canvas with Sovereign Navy accents",
      icon: Sun,
      preview: "bg-slate-50 border-slate-200",
    },
    {
      value: "dark" as Theme,
      label: "Dark",
      description: "Deep navy background for reduced eye strain",
      icon: Moon,
      preview: "bg-slate-900 border-slate-700",
    },
    {
      value: "system" as Theme,
      label: "System",
      description: `Follows your device settings (currently ${systemTheme})`,
      icon: Monitor,
      preview: systemTheme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Theme Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize the appearance of your application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose your preferred color scheme. The Sophisticated Utility design system adapts to your choice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedTheme} onValueChange={(value) => handleThemeChange(value as Theme)}>
            <div className="grid gap-4">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedTheme === option.value;
                
                return (
                  <div key={option.value} className="relative">
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                      }`}
                    >
                      <div className={`flex-shrink-0 p-3 rounded-lg ${option.preview} border-2`}>
                        <Icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{option.label}</span>
                          {isSelected && (
                            <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Design System</CardTitle>
          <CardDescription>
            Current theme: Sophisticated Utility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Typography</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-display font-semibold">Plus Jakarta Sans</span> - Headings</p>
                <p><span className="font-body">Inter</span> - UI Text</p>
                <p><span className="font-mono">JetBrains Mono</span> - Numbers</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Color Palette</p>
              <div className="flex gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary border" title="Sovereign Navy" />
                <div className="h-10 w-10 rounded-lg bg-destructive border" title="Error Crimson" />
                <div className="h-10 w-10 rounded-lg bg-secondary border" title="Secondary Slate" />
                <div className="h-10 w-10 rounded-lg bg-accent border" title="Accent" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              The Sophisticated Utility design features 150ms micro-interactions, shimmer loading states, 
              and check animations for a premium EAM experience.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
