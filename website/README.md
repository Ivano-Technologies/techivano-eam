# Techivano Marketing Website (techivano.com)

Next.js 14 marketing site for Techivano EAM — Infrastructure Operations Intelligence Platform. Design reference: Monday.com CRM (structure and patterns); style: enterprise GovTech (Palantir, Stripe, Vercel, Datadog).

## Stack

- **Next.js 14** (App Router, React Server Components)
- **TailwindCSS**
- **TypeScript**
- **Lucide React** (icons)

## Structure

```
/app
  layout.tsx      # Root layout, metadata, Header, Footer
  page.tsx        # Homepage
  platform/       # Product / Platform page
  intelligence/   # Intelligence modules page
  solutions/      # Solutions (Federal, State, Regulators)
  pricing/        # Pricing + contract structure + ROI
  pilot/          # Pilot program + request form
  about/          # About Techivano
/components
  Header, Footer
  Hero, FeatureGrid, StatsSection, CTASection
  ProductModule, PricingTable, GovernmentUseCases
/content
  site.ts         # Site name, tagline, nav, CTA labels
/lib
  utils.ts        # cn() for classnames
```

## Run locally

```bash
cd website
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build for production

```bash
pnpm build
pnpm start
```

## SEO

Metadata and keywords target:

- Enterprise Asset Management
- Infrastructure Asset Management
- Predictive Maintenance Platform
- Government Infrastructure Management

## Deploy

Configure the `website` directory as the root for Vercel (or your host). Domain: techivano.com.
