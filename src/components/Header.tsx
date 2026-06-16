"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, CreditCard, Download, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { KlipioLogo } from "@/components/KlipioLogo";

const navItems = [
  { href: "/", label: "Download", icon: Download },
  { href: "/analyze", label: "Analyze", icon: Brain },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-200",
        isScrolled
          ? "border-klipio-border bg-klipio-bg/92 shadow-[0_12px_40px_rgba(20,18,33,0.08)] backdrop-blur-xl"
          : "border-transparent bg-klipio-bg/80 backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Klipio home">
          <KlipioLogo size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-klipio-text text-white"
                    : "text-klipio-muted hover:bg-klipio-surface hover:text-klipio-text"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/history" className="text-sm font-bold text-klipio-muted hover:text-klipio-text">
            Library
          </Link>
          <Link href="/#paste">
            <Button variant="accent" size="sm">
              Paste Link
            </Button>
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-klipio-border bg-klipio-bg px-4 py-4 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold",
                    isActive
                      ? "bg-klipio-text text-white"
                      : "text-klipio-muted hover:bg-klipio-surface hover:text-klipio-text"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/history"
              className="rounded-2xl px-4 py-3 text-sm font-bold text-klipio-muted hover:bg-klipio-surface hover:text-klipio-text"
            >
              Library
            </Link>
            <Link href="/#paste" className="pt-2">
              <Button variant="accent" fullWidth>
                Paste Link
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
