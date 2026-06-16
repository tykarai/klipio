"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Zap,
  Check,
  X,
  Crown,
  Rocket,
  Sparkles,
  Download,
  Brain,
  Shield,
  Clock,
  Globe,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Star,
  Infinity,
} from "lucide-react";

// ─── Pricing Plans ───
const plans = [
  {
    id: "free",
    name: "Free",
    icon: Zap,
    description: "Perfect for casual users",
    monthlyPrice: 0,
    yearlyPrice: 0,
    popular: false,
    features: [
      { text: "10 downloads per day", included: true },
      { text: "Up to 1080p quality", included: true },
      { text: "All platforms supported", included: true },
      { text: "Basic AI analysis (3/day)", included: true },
      { text: "24h file storage", included: true },
      { text: "Community support", included: true },
      { text: "4K downloads", included: false },
      { text: "No watermark removal", included: false },
      { text: "Batch downloads", included: false },
      { text: "Priority processing", included: false },
    ],
    cta: "Get Started Free",
    variant: "secondary" as const,
  },
  {
    id: "pro",
    name: "Pro",
    icon: Rocket,
    description: "For power users & creators",
    monthlyPrice: 4.99,
    yearlyPrice: 3.99,
    popular: true,
    badge: "Most Popular",
    features: [
      { text: "Unlimited downloads", included: true, highlight: true },
      { text: "Up to 4K Ultra HD", included: true, highlight: true },
      { text: "All platforms supported", included: true },
      { text: "Advanced AI analysis (50/day)", included: true },
      { text: "7-day file storage", included: true },
      { text: "Priority email support", included: true },
      { text: "No watermark removal", included: true },
      { text: "Batch downloads (10 at once)", included: true },
      { text: "Priority processing", included: true },
      { text: "API access", included: false },
    ],
    cta: "Start Pro Trial",
    variant: "accent" as const,
  },
  {
    id: "premium",
    name: "Premium",
    icon: Crown,
    description: "For professionals & teams",
    monthlyPrice: 9.99,
    yearlyPrice: 7.99,
    popular: false,
    badge: "Best Value",
    features: [
      { text: "Unlimited downloads", included: true, highlight: true },
      { text: "Up to 4K Ultra HD", included: true },
      { text: "All platforms supported", included: true },
      { text: "Unlimited AI analysis", included: true, highlight: true },
      { text: "30-day file storage", included: true },
      { text: "Priority chat support", included: true },
      { text: "No watermark removal", included: true },
      { text: "Batch downloads (unlimited)", included: true },
      { text: "Priority processing", included: true },
      { text: "Full API access", included: true, highlight: true },
    ],
    cta: "Go Premium",
    variant: "default" as const,
  },
];

// ─── FAQ Data ───
const faqs = [
  {
    question: "Can I really use Klipio for free?",
    answer:
      "Absolutely! Our free tier gives you 10 downloads per day at up to 1080p quality with basic AI analysis. It's perfect for casual users who just need to download videos occasionally.",
  },
  {
    question: "What happens to my downloaded files?",
    answer:
      "Files are stored securely on our servers for the duration of your plan (24h for Free, 7 days for Pro, 30 days for Premium). After that, they're permanently deleted. You can always re-download them.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period. No questions asked.",
  },
  {
    question: "What platforms are supported?",
    answer:
      "We support TikTok, Instagram, YouTube, Facebook, X (Twitter), Reddit, and Pinterest. We're constantly adding more platforms based on user requests.",
  },
  {
    question: "How does AI video analysis work?",
    answer:
      "Our AI analyzes the video content to extract recipes (ingredients, steps, calories), travel destinations (attractions, booking links), brands (with shopping links), key points, and full transcripts. It's like having a research assistant for every video.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "Our website is fully optimized for mobile and works like a native app. You can also add it to your home screen for quick access. iOS and Android apps are coming soon!",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a 7-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team within 7 days of your purchase for a full refund.",
  },
  {
    question: "Is my data private?",
    answer:
      "100%. We use HTTPS encryption for all transfers. We don't log your download history, don't sell your data, and files are automatically deleted. We're privacy-first by design.",
  },
];

// ─── Comparison Features ───
const comparisonFeatures = [
  { name: "Daily downloads", free: "10", pro: "Unlimited", premium: "Unlimited" },
  { name: "Max video quality", free: "1080p", pro: "4K", premium: "4K" },
  { name: "AI analysis / day", free: "3 basic", pro: "50 advanced", premium: "Unlimited" },
  { name: "File storage", free: "24 hours", pro: "7 days", premium: "30 days" },
  { name: "No watermark", free: false, pro: true, premium: true },
  { name: "Batch downloads", free: false, pro: "10 at once", premium: "Unlimited" },
  { name: "Priority processing", free: false, pro: true, premium: true },
  { name: "API access", free: false, pro: false, premium: true },
  { name: "Support", free: "Community", pro: "Email (priority)", premium: "Chat (priority)" },
  { name: "Platforms", free: "All 7+", pro: "All 7+", premium: "All 7+" },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-klipio-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-klipio-surface/50 transition-colors"
      >
        <span className="font-medium text-klipio-text pr-4">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-klipio-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-klipio-muted" />
          )}
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <p className="text-sm text-klipio-muted leading-relaxed">{answer}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12">
      {/* ─── Hero ─── */}
      <section className="px-4 mb-16">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-klipio-primary/10 border border-klipio-primary/20 text-sm text-klipio-accent mb-6">
              <Sparkles className="w-4 h-4" />
              Start free, upgrade when you need
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              Simple, <span className="gradient-text">Transparent</span> Pricing
            </h1>
            <p className="text-lg text-klipio-muted max-w-xl mx-auto mb-8">
              Choose the plan that fits your needs. All plans include core features.
              No hidden fees.
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-3 p-1.5 rounded-xl bg-klipio-surface border border-klipio-border"
          >
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                billingCycle === "monthly"
                  ? "bg-klipio-primary text-white"
                  : "text-klipio-muted hover:text-klipio-text"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                billingCycle === "yearly"
                  ? "bg-klipio-primary text-white"
                  : "text-klipio-muted hover:text-klipio-text"
              )}
            >
              Yearly
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  billingCycle === "yearly"
                    ? "bg-white/20 text-white"
                    : "bg-klipio-success/20 text-klipio-success"
                )}
              >
                Save 20%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── Pricing Cards ─── */}
      <section className="px-4 mb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const price =
              billingCycle === "monthly"
                ? plan.monthlyPrice
                : plan.yearlyPrice;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(plan.popular && "md:-mt-4 md:mb-4")}
              >
                <Card
                  className={cn(
                    "h-full flex flex-col relative",
                    plan.popular &&
                      "border-klipio-primary/50 shadow-glow-sm"
                  )}
                  padding="lg"
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full bg-gradient-to-r from-klipio-primary to-klipio-secondary text-white text-xs font-bold">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Plan icon & name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        plan.popular
                          ? "bg-klipio-primary/20"
                          : "bg-klipio-surface"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5",
                          plan.popular
                            ? "text-klipio-primary"
                            : "text-klipio-muted"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className="text-xs text-klipio-muted">
                        {plan.description}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ${price === 0 ? "0" : price}
                      </span>
                      {price > 0 && (
                        <span className="text-klipio-muted text-sm">
                          /{billingCycle === "monthly" ? "mo" : "mo, billed yearly"}
                        </span>
                      )}
                    </div>
                    {price === 0 && (
                      <span className="text-sm text-klipio-muted">
                        Forever free
                      </span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        {feature.included ? (
                          <Check className="w-4 h-4 text-klipio-success shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-klipio-muted shrink-0 mt-0.5" />
                        )}
                        <span
                          className={cn(
                            feature.included
                              ? feature.highlight
                                ? "text-klipio-text font-medium"
                                : "text-klipio-text"
                              : "text-klipio-muted line-through"
                          )}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={plan.variant}
                    size="lg"
                    fullWidth
                    className={cn(
                      plan.id === "premium" &&
                        "bg-gradient-to-r from-klipio-secondary to-klipio-primary hover:shadow-glow"
                    )}
                  >
                    {plan.cta}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── Feature Comparison ─── */}
      <section className="px-4 mb-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Feature <span className="gradient-text">Comparison</span>
            </h2>
            <p className="text-klipio-muted">
              A detailed breakdown of what's included in each plan.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-klipio-border">
                  <th className="text-left py-4 px-4 font-semibold text-klipio-text">
                    Feature
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-klipio-muted w-32">
                    Free
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-klipio-accent w-32 bg-klipio-primary/5 rounded-t-lg">
                    Pro
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-klipio-text w-32">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, i) => (
                  <motion.tr
                    key={feature.name}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-klipio-border/50 hover:bg-klipio-surface/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-sm text-klipio-text">
                      {feature.name}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {typeof feature.free === "boolean" ? (
                        feature.free ? (
                          <Check className="w-5 h-5 text-klipio-success mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-klipio-muted mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-klipio-muted">
                          {feature.free}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center bg-klipio-primary/5">
                      {typeof feature.pro === "boolean" ? (
                        feature.pro ? (
                          <Check className="w-5 h-5 text-klipio-success mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-klipio-muted mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-medium text-klipio-accent">
                          {feature.pro}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {typeof feature.premium === "boolean" ? (
                        feature.premium ? (
                          <Check className="w-5 h-5 text-klipio-success mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-klipio-muted mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-klipio-muted">
                          {feature.premium}
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="px-4 mb-20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
            <p className="text-klipio-muted">
              Everything you need to know about Klipio.
            </p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <FAQItem
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaq === i}
                  onToggle={() =>
                    setOpenFaq(openFaq === i ? null : i)
                  }
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-2xl mx-auto text-center"
        >
          <Card className="border-klipio-primary/30" padding="xl">
            <h2 className="text-2xl font-bold mb-3">
              Still have questions?
            </h2>
            <p className="text-klipio-muted mb-6">
              Our team is here to help. Reach out and we'll get back to you
              within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="accent" size="lg">
                Contact Support
              </Button>
              <Button variant="secondary" size="lg">
                View Documentation
              </Button>
            </div>
          </Card>
        </motion.div>
      </section>
    </div>
  );
}
