export const site = {
  name: "Techivano",
  tagline: "Operational Intelligence for National Infrastructure",
  taglineAlt: "Digitizing Infrastructure Operations",
  domain: "techivano.com",
  description:
    "Government-grade Infrastructure Operations Intelligence Platform. Asset management, predictive maintenance, and operations intelligence for federal agencies, state governments, and regulators.",
} as const;

export const nav = [
  { label: "Infrastructure Intelligence", href: "/intelligence" },
  { label: "Platform", href: "/platform" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pilot Program", href: "/pilot" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
] as const;

export const cta = {
  pilot: "Request Pilot",
  pilotHref: "/pilot#request",
  contact: "Contact Sales",
  getStarted: "Get Started",
} as const;
