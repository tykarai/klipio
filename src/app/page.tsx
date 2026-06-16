"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { UrlInput } from "@/components/UrlInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  Zap,
  Download,
  Sparkles,
  Shield,
  Lock,
  Clock,
  Eye,
  Trash2,
  Globe,
  Star,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Play,
  Pause,
  FileVideo,
  Monitor,
  Music,
  Brain,
  Utensils,
  MapPin,
  Tag,
  ListChecks,
  ChevronRight,
  Loader2,
  Smartphone,
  Tablet,
  Link as LinkIcon,
} from "lucide-react";

// ─── Animated Counter ───
function AnimatedCounter({
  target,
  suffix = "",
  duration = 2,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime: number;
    let animationFrame: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Particle Background ───
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(123, 109, 141, ${p.opacity})`;
        ctx.fill();

        // Draw connections
        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(123, 109, 141, ${0.1 * (1 - dist / 150)})`;
            ctx.stroke();
          }
        });
      });

      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}

// ─── Platform Icons ───
const platforms = [
  { name: "TikTok", icon: "tiktok", color: "#FE2C55" },
  { name: "Instagram", icon: "instagram", color: "#E4405F" },
  { name: "YouTube", icon: "youtube", color: "#FF0000" },
  { name: "Facebook", icon: "facebook", color: "#1877F2" },
  { name: "X / Twitter", icon: "twitter", color: "#1DA1F2" },
];

// ─── How It Works Steps ───
const steps = [
  {
    icon: Link2Icon,
    title: "Paste the Link",
    description:
      "Copy any video URL from TikTok, Instagram, YouTube, Facebook, or X. Paste it into the box above.",
    color: "#7B6D8D",
  },
  {
    icon: DownloadIcon,
    title: "Download or Analyze",
    description:
      "Hit Download for instant HD/4K video. Or tap Analyze to let AI extract insights from the content.",
    color: "#5B8C5A",
  },
  {
    icon: SparklesIcon,
    title: "Get Results",
    description:
      "Your video is ready in seconds. AI analysis gives you recipes, destinations, brands, and key takeaways.",
    color: "#B8A9C9",
  },
];

function Link2Icon(props: any) {
  return <LinkIcon {...props} />;
}
function DownloadIcon(props: any) {
  return <Download {...props} />;
}
function SparklesIcon(props: any) {
  return <Sparkles {...props} />;
}


const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Downloads start in under 2 seconds. No waiting, no throttling, no queues.",
    highlight: "< 2s start",
  },
  {
    icon: Monitor,
    title: "HD & 4K Quality",
    description: "Download in the highest available quality. Up to 4K resolution with crisp audio.",
    highlight: "Up to 4K",
  },
  {
    icon: Brain,
    title: "AI Understanding",
    description: "Extract recipes, travel destinations, brands, and key insights from any video automatically.",
    highlight: "Powered by AI",
  },
  {
    icon: Shield,
    title: "No Watermark",
    description: "Clean downloads without any watermarks. Get the original video, perfectly clean.",
    highlight: "100% Clean",
  },
  {
    icon: Lock,
    title: "Private & Secure",
    description: "Your downloads are encrypted. Files auto-delete after 24 hours. We keep zero logs.",
    highlight: "Auto-delete 24h",
  },
  {
    icon: Globe,
    title: "All Platforms",
    description: "Works with TikTok, Instagram, YouTube, Facebook, X, Reddit, and Pinterest.",
    highlight: "7+ platforms",
  },
];

// ─── Stats ───
const stats = [
  { value: 50000000, suffix: "+", label: "Videos Downloaded" },
  { value: 2000000, suffix: "+", label: "Monthly Users" },
  { value: 99.9, suffix: "%", label: "Uptime", isDecimal: true },
  { value: 4.9, suffix: "/5", label: "User Rating", isDecimal: true },
];

// ─── Trust Badges ───
const trustBadges = [
  "No registration required",
  "HTTPS encrypted",
  "Malware free",
  "Open source",
];

// ─── Main Page ───
export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -50]);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      <ParticleBackground />

      {/* ═══════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════ */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4"
      >
        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-klipio-primary/20 to-transparent rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-klipio-accent/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-klipio-surface border border-klipio-border text-sm text-klipio-muted mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-klipio-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-klipio-success" />
            </span>
            Now with AI Video Analysis — try it free
            <ArrowRight className="w-4 h-4 text-klipio-primary" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          >
            Download & Understand{" "}
            <span className="gradient-text">Any Video</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg sm:text-xl text-klipio-muted max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Paste a link. Get your video in HD/4K. Or let AI extract recipes,
            destinations, brands, and key insights.
          </motion.p>

          {/* URL Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <UrlInput size="hero" />
          </motion.div>

          {/* Platform icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 sm:gap-6 mb-12"
          >
            <span className="text-xs text-klipio-muted">Supports:</span>
            {platforms.map((platform) => (
              <motion.div
                key={platform.name}
                className="group relative"
                whileHover={{ scale: 1.15, y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border border-klipio-border bg-klipio-surface/50 backdrop-blur-sm"
                  style={{ boxShadow: `0 0 20px ${platform.color}20` }}
                >
                  <PlatformIcon name={platform.icon} color={platform.color} />
                </div>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-klipio-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {platform.name}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-1.5 text-xs text-klipio-muted"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-klipio-success" />
                {badge}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-klipio-muted max-w-lg mx-auto">
              Three simple steps from link to video or AI-powered insights.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-1/3 left-[15%] right-[15%] h-px bg-gradient-to-r from-klipio-primary/30 via-klipio-border to-klipio-primary/30" />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15 }}
              >
                <Card
                  hover
                  glow
                  className="text-center h-full"
                  padding="lg"
                >
                  {/* Step number */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: `${step.color}20` }}
                  >
                    <step.icon
                      className="w-6 h-6"
                      style={{ color: step.color }}
                    />
                  </div>
                  <div
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white mb-4"
                    style={{ backgroundColor: step.color }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-klipio-muted leading-relaxed">
                    {step.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURES GRID
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-klipio-surface/30 to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You <span className="gradient-text">Need</span>
            </h2>
            <p className="text-klipio-muted max-w-lg mx-auto">
              Built for speed, privacy, and AI-powered content understanding.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card hover className="h-full" padding="lg">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-11 h-11 rounded-xl bg-klipio-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-klipio-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-klipio-text">
                            {feature.title}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-klipio-primary/10 text-[10px] font-medium text-klipio-accent">
                            {feature.highlight}
                          </span>
                        </div>
                        <p className="text-sm text-klipio-muted leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SOCIAL PROOF / STATS
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl sm:text-5xl font-bold gradient-text mb-2">
                  {stat.isDecimal ? (
                    <AnimatedCounter
                      target={Math.floor(stat.value)}
                      suffix={stat.suffix}
                    />
                  ) : (
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  )}
                </div>
                <p className="text-sm text-klipio-muted">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Testimonials preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {[
              {
                text: "The AI recipe extraction is mind-blowing. I cook TikTok recipes daily now.",
                author: "Sarah M.",
                role: "Home Cook",
                rating: 5,
              },
              {
                text: "Fastest downloader I've used. 4K quality with no watermark. Perfect.",
                author: "Raj K.",
                role: "Content Creator",
                rating: 5,
              },
              {
                text: "I use it to save travel videos and the AI gives me full itineraries. Genius!",
                author: "Maria L.",
                role: "Travel Blogger",
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full" padding="lg">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 text-klipio-warning fill-klipio-warning"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-klipio-text leading-relaxed mb-4">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-klipio-primary to-klipio-secondary flex items-center justify-center text-white text-xs font-bold">
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {testimonial.author}
                      </p>
                      <p className="text-xs text-klipio-muted">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA SECTION
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-klipio-primary/20 via-klipio-secondary/20 to-klipio-primary/10" />
            <div className="absolute inset-0 bg-gradient-to-br from-klipio-surface/80 to-klipio-bg/80 backdrop-blur-xl" />
            <div
              className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[120px] opacity-30"
              style={{ backgroundColor: "#7B6D8D" }}
            />

            <div className="relative p-8 sm:p-12 lg:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to <span className="gradient-text">Get Started</span>?
              </h2>
              <p className="text-klipio-muted max-w-lg mx-auto mb-8">
                Join millions of users who trust Klipio for fast, private video
                downloads and AI-powered content understanding.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/" className="w-full sm:w-auto">
                  <Button variant="accent" size="lg" fullWidth className="sm:w-auto">
                    <Download className="w-5 h-5" />
                    Start Downloading
                  </Button>
                </Link>
                <Link href="/pricing" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" fullWidth className="sm:w-auto">
                    View Pricing
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-xs text-klipio-muted">
                Free forever. No credit card required.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

// ─── Platform Icon Component ───
function PlatformIcon({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const icons: Record<string, JSX.Element> = {
    tiktok: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.83a8.28 8.28 0 0 0 4.83 1.54v-3.5a4.85 4.85 0 0 1-1.07-.18z" />
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
    youtube: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    twitter: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  };

  return (
    <div style={{ color }} className="flex items-center justify-center">
      {icons[name] || <Globe className="w-5 h-5" />}
    </div>
  );
}
