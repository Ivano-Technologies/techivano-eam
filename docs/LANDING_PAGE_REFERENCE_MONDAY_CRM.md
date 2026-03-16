# Landing Page Reference: Monday CRM SMB (for Techivano EAM)

Scraped via Firecrawl from [monday.com CRM for SMB](https://monday.com/ap/crm/smb). Use this to model the Techivano EAM SaaS marketing/landing experience.

---

## 1. Page structure (content order)

| Section | Purpose | Monday CRM content |
|--------|---------|---------------------|
| **Nav** | Logo, primary CTA, secondary link | Logo, "Contact sales", "Get Started" |
| **Hero** | Headline + value prop + CTA | "Small businesses grow faster with monday CRM" + one-liner + industry selector + "Get Started" / "No credit card required" |
| **Social proof** | Trust | "Trusted by 250,000+ startups and enterprises" + logo strip |
| **Social proof (visual)** | Funnel / product shot | Hero image / product screenshot |
| **Outcomes** | Metrics + case studies | 60% improvement, 15% conversion, x18 ROI, $250K saved, 6K hours, 25% efficiency + "Watch/See case study" links |
| **Features** | Product value | "Everything you need to win, and keep customers" — cards: Unified CRM, Lead & pipeline, Automations & AI, Reports & dashboards, Mobile app |
| **Integrations** | Ecosystem | "Integrate all your tools" + integration logos (LinkedIn, Zoom, Gmail, etc.) |
| **Customer management** | Deeper feature | "Connect your entire customer journey" + CTA |
| **Testimonials** | Social proof | "Small businesses love us" + multiple quotes with bold highlights |
| **FAQ** | Objection handling | "Questions? We've got answers" — accordion-style Q&A (setup, SMB fit, training, AI, automations, mobile, scaling) |
| **Final CTA** | Conversion | "Try monday CRM for 14 days free" + "No credit card needed • Set up in minutes" + "Start my free trial" |
| **Footer** | Links + legal | Pricing, 24/7 support, Contact sales, Integrations, About, Customer stories, Enterprise, Templates + GDPR/ISO/SOC2/HIPAA + social links |

---

## 2. Branding & design tokens (from Firecrawl)

Use these as a reference for a modern SaaS landing page. Adapt to Techivano EAM brand (e.g. keep your existing red/NRCS or pivot to a similar professional palette).

### Colors

| Token | Hex | Usage |
|-------|-----|--------|
| Primary | `#6161FF` | Brand accent |
| Accent / CTA | `#0173EA` | Buttons, links |
| Background | `#FFFFFF` | Page background |
| Text primary | `#000000` | Body/headings |
| Link | `#0173EA` | Links |

### Typography

- **Font family:** Poppins (heading + body).
- **Sizes:** h1 64px, h2 18px (likely section titles), body 18px.
- **Stacks:** `Poppins, sans-serif` for heading and body.

### Spacing & shape

- **Base unit:** 4px.
- **Border radius:** 16px (cards/containers); buttons 160px (pill).

### Buttons

- **Primary:** background `#0173EA`, text white, border same as background, pill radius, no shadow.
- **Secondary:** background `#00D2D2`, text black, 0px radius (or alternate style).

### Personality (from scraper)

- Tone: modern.  
- Energy: high.  
- Target: small businesses.

---

## 3. Content patterns to reuse for Techivano EAM

- **Hero:** One clear headline (e.g. "Asset-heavy teams run better with Techivano EAM") + one sentence value prop + primary CTA + "No credit card" or "Free trial" line.
- **Industry/use-case selector:** Optional dropdown or chips (e.g. "Manufacturing", "Healthcare", "Facilities", "Fleet") to tailor message.
- **Metric cards:** 3–6 outcome stats with short labels and optional "See case study" (e.g. % uptime, hours saved, cost avoided).
- **Feature grid:** 4–6 cards with icon/image, title, short description, optional "Learn more" or "Get started".
- **Integrations strip:** Logos of key integrations (accounting, CMMS, ERP, etc.) with optional "Integrate your stack" headline.
- **Testimonials:** 3–8 short quotes with bold key phrases and attribution (role/company).
- **FAQ:** 5–8 questions (setup, who it’s for, training, AI/automation, mobile, scaling).
- **Footer CTA:** Repeated trial/signup CTA + trust (security/compliance badges) + main nav links.

---

## 4. Raw markdown (full page content)

<details>
<summary>Expand scraped markdown</summary>

The full markdown from the scrape is available in the Firecrawl response. Key text elements:

- **Headline:** Small businesses grow faster with monday CRM  
- **Subhead:** Run sales and customer relationships in one place, with built-in AI and no-code automations that help teams move faster and close more deals.  
- **CTA:** Get Started — Get full access. No credit card required.  
- **Trust:** Trusted by 250,000+ startups and enterprises  
- **Outcomes:** 60% improvement in sales tracking, 15% increase in conversion rate, x18 ROI, $250K saved yearly, 6K hours saved per year, 25% increase in efficiency  
- **Features:** Unified CRM platform, Lead & pipeline management, Automations & AI, Reports & dashboards, Mobile app, Customer management  
- **Testimonials:** Multiple quotes re: efficiency, reporting, ease of use, automation, integrations, training  
- **FAQ:** Setup, SMB fit, training, AI, automations, mobile, scaling  

</details>

---

## 5. How to use this for Techivano EAM

1. **Landing/marketing site:** Reuse the section order (hero → social proof → outcomes → features → integrations → testimonials → FAQ → CTA) and adapt copy to EAM (assets, work orders, maintenance, compliance, multi-tenant).
2. **Design system:** Optionally adopt or adapt the color palette, Poppins, spacing, and button styles in your CSS/Tailwind or design tokens; keep Techivano/NRCS identity where needed.
3. **Copy:** Replace CRM/sales language with EAM language (e.g. "Run assets and maintenance in one place", "Track every asset from install to retire", "Built-in compliance and reporting").
4. **CTAs:** Map "Get Started" / "Start my free trial" to your signup or "Request demo" flow (e.g. `/signup`, `/demo`, or tenant onboarding).

---

*Source: Firecrawl scrape of https://monday.com/ap/crm/smb. Scrape ID and metadata in Firecrawl response.*
