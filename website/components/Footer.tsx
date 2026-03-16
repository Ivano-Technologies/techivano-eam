import Link from "next/link";
import { site, nav, cta } from "@/content/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="font-semibold text-lg text-primary">
              {site.name}
            </Link>
            <p className="mt-2 text-sm text-muted max-w-md">
              {site.description}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-sm text-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/platform" className="text-sm text-muted hover:text-foreground">
                  Platform
                </Link>
              </li>
              <li>
                <Link href="/intelligence" className="text-sm text-muted hover:text-foreground">
                  Intelligence
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-sm text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/solutions" className="text-sm text-muted hover:text-foreground">
                  Solutions
                </Link>
              </li>
              <li>
                <Link href="/pilot" className="text-sm text-muted hover:text-foreground">
                  Pilot Program
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted hover:text-foreground">
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/pilot#request" className="text-sm text-muted hover:text-foreground">
              {cta.pilot}
            </Link>
            <Link href="/about" className="text-sm text-muted hover:text-foreground">
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
