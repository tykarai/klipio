import Link from "next/link";
import { KlipioLogo } from "@/components/KlipioLogo";

const footerLinks = {
  Product: [
    { label: "Download", href: "/" },
    { label: "Analyze", href: "/analyze" },
    { label: "Library", href: "/history" },
    { label: "Pricing", href: "/pricing" },
  ],
  Use: [
    { label: "Recipes", href: "/#paste" },
    { label: "Travel", href: "/#paste" },
    { label: "Products", href: "/#paste" },
    { label: "Key points", href: "/#paste" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "DMCA", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-klipio-border bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-8 lg:py-16">
        <div>
          <Link href="/" aria-label="Klipio home">
            <KlipioLogo size="sm" />
          </Link>
          <p className="mt-5 max-w-md text-sm leading-6 text-klipio-muted">
            Paste a social video link. Download the media or let Klipio turn it
            into structured, searchable knowledge.
          </p>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-klipio-muted">
            Klipio.io
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-sm font-black text-klipio-text">{group}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-klipio-muted hover:text-klipio-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-klipio-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs font-medium text-klipio-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>&copy; {new Date().getFullYear()} Klipio. All rights reserved.</span>
          <span>Download responsibly. Respect creator rights and platform rules.</span>
        </div>
      </div>
    </footer>
  );
}
