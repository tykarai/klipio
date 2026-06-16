"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Github, Twitter, MessageCircle, Heart } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Download Video", href: "/" },
    { label: "AI Analysis", href: "/analyze" },
    { label: "History", href: "/history" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "DMCA", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
  Support: [
    { label: "Help Center", href: "#" },
    { label: "API Docs", href: "#" },
    { label: "Status", href: "#" },
    { label: "Feedback", href: "#" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com/klipio", label: "Twitter" },
  { icon: Github, href: "https://github.com/klipio", label: "GitHub" },
  {
    icon: MessageCircle,
    href: "https://discord.gg/klipio",
    label: "Discord",
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-klipio-border/50 bg-klipio-bg">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-klipio-primary/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-klipio-primary to-klipio-secondary flex items-center justify-center shadow-glow-sm">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                <span className="text-klipio-text">klip</span>
                <span className="gradient-text">io</span>
              </span>
            </Link>
            <p className="text-sm text-klipio-muted leading-relaxed mb-6 max-w-xs">
              Download videos in HD/4K and unlock AI-powered insights. The
              modern way to save and understand video content.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-klipio-surface text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface-hover border border-klipio-border transition-colors"
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={social.label}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.a>
                );
              })}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-klipio-text mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-klipio-muted hover:text-klipio-accent transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-klipio-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-klipio-muted">
            &copy; {new Date().getFullYear()} Klipio. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-klipio-surface border border-klipio-border text-xs text-klipio-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-klipio-success opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-klipio-success" />
              </span>
              All systems operational
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-klipio-muted">
              Made with <Heart className="w-3 h-3 text-klipio-danger fill-klipio-danger" /> and AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
