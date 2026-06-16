"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/Dropdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Sparkles,
  Clock,
  CreditCard,
  Menu,
  X,
  Globe,
  Zap,
  ChevronDown,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Download", icon: Download },
  { href: "/analyze", label: "Analyze", icon: Sparkles },
  { href: "/history", label: "History", icon: Clock },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

const languages = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "hi", label: "हिन्दी" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "glass-strong border-b border-klipio-border/50 shadow-lg shadow-black/10"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <motion.div
                className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-klipio-primary to-klipio-secondary flex items-center justify-center shadow-glow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Zap className="w-5 h-5 text-white" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-klipio-primary to-klipio-secondary opacity-0 group-hover:opacity-50 blur-lg transition-opacity" />
              </motion.div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-klipio-text">klip</span>
                <span className="gradient-text">io</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors",
                        isActive
                          ? "text-klipio-text"
                          : "text-klipio-muted hover:text-klipio-text"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 bg-klipio-surface rounded-xl"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <Icon className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">{item.label}</span>
                    </motion.div>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Language Selector - Desktop */}
              <div className="hidden sm:block">
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-klipio-muted hover:text-klipio-text rounded-xl hover:bg-klipio-surface transition-colors">
                      <Globe className="w-4 h-4" />
                      <span className="hidden xl:inline uppercase text-xs font-medium">
                        {currentLang}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  }
                >
                  <DropdownLabel>Select Language</DropdownLabel>
                  <DropdownSeparator />
                  {languages.map((lang) => (
                    <DropdownItem
                      key={lang.code}
                      onClick={() => setCurrentLang(lang.code)}
                      rightIcon={
                        currentLang === lang.code ? (
                          <div className="w-2 h-2 rounded-full bg-klipio-primary" />
                        ) : undefined
                      }
                    >
                      {lang.label}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>

              {/* Auth Buttons - Desktop */}
              <div className="hidden lg:flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
                <Button variant="accent" size="sm">
                  Get Started
                </Button>
              </div>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-40 lg:hidden glass-strong border-b border-klipio-border"
          >
            <nav className="flex flex-col p-4 gap-1">
              {navItems.map((item, i) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                        isActive
                          ? "bg-klipio-primary/20 text-klipio-accent"
                          : "text-klipio-muted hover:bg-klipio-surface hover:text-klipio-text"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
              <div className="border-t border-klipio-border my-2" />
              <div className="flex gap-2 px-4">
                <Button variant="ghost" size="sm" fullWidth>
                  Sign In
                </Button>
                <Button variant="accent" size="sm" fullWidth>
                  Get Started
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
