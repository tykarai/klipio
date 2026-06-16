import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Download,
  Globe2,
  Layers3,
  ListChecks,
  MapPin,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Utensils,
} from "lucide-react";
import { KlipioLogo } from "@/components/KlipioLogo";
import { UrlInput } from "@/components/UrlInput";
import { Button } from "@/components/ui/Button";

const supportedPlatforms = [
  "TikTok",
  "Instagram",
  "YouTube",
  "Facebook",
  "X",
  "Reddit",
  "Pinterest",
];

const productModes = [
  {
    icon: Download,
    title: "Download clean videos",
    description:
      "Paste a public video URL and get the best available MP4 without a slow, ad-heavy downloader flow.",
    detail: "HD and 4K when the source allows it",
  },
  {
    icon: Brain,
    title: "Understand what is inside",
    description:
      "Klipio reads the clip across transcript, frames, OCR, and metadata, then returns structured results you can actually use.",
    detail: "Recipes, places, products, summaries, and tags",
  },
];

const intelligenceTypes = [
  {
    icon: Utensils,
    title: "Recipes",
    text: "Ingredients, steps, prep time, calories, and shopping cues.",
  },
  {
    icon: MapPin,
    title: "Travel",
    text: "Destination clues, landmarks, nearby stops, and itinerary notes.",
  },
  {
    icon: Tags,
    title: "Products",
    text: "Brands, items, buying intent, and affiliate-ready matches.",
  },
  {
    icon: ListChecks,
    title: "Key Points",
    text: "Lessons, takeaways, timestamps, and reusable notes.",
  },
];

const pipeline = [
  "Paste a social video link",
  "Klipio extracts source media",
  "AI fuses audio, frames, and text",
  "Save, download, or organize the result",
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden bg-klipio-bg text-klipio-text">
      <section className="relative overflow-hidden px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-8 hidden items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-klipio-muted sm:flex">
              <KlipioLogo size="sm" />
              <span className="hidden h-px w-14 bg-klipio-border sm:block" />
              <span>Paste it. Klip it. Keep it.</span>
            </div>

            <h1 className="text-5xl font-black leading-[0.95] tracking-normal text-klipio-text sm:text-7xl lg:text-8xl">
              Klipio
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-klipio-muted sm:text-xl">
              Paste a public social video link to download it or turn it into
              structured notes, recipes, destinations, product finds, and key
              takeaways.
            </p>

            <div id="paste" className="mt-8 max-w-2xl">
              <UrlInput size="hero" />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2 text-sm text-klipio-muted">
              <span className="font-semibold text-klipio-text">Works with</span>
              {supportedPlatforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-klipio-border bg-klipio-surface px-3 py-1"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="rounded-[1.5rem] border border-klipio-border bg-white p-5 shadow-[0_18px_50px_rgba(20,18,33,0.1)] md:hidden">
              <div className="mb-4 flex items-center justify-between border-b border-klipio-border pb-4">
                <div className="flex items-center gap-3">
                  <KlipioLogo size="sm" markOnly />
                  <div>
                    <p className="text-sm font-bold text-klipio-text">
                      klipio.io
                    </p>
                    <p className="text-xs text-klipio-muted">analysis sheet</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#DFF7EA] px-3 py-1 text-xs font-semibold text-[#257A4A]">
                  Ready
                </span>
              </div>
              <div className="aspect-video overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#141221_0%,#3A2DE0_58%,#9B7BFF_100%)] p-4 text-white">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold">
                      TikTok recipe clip
                    </span>
                    <Play className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/72">Detected topic</p>
                    <p className="text-xl font-black">Pad thai in 90 sec</p>
                  </div>
                </div>
              </div>
            </div>

          <div className="relative hidden min-h-[520px] min-w-0 overflow-hidden md:block lg:min-h-[600px]">
            <div className="absolute left-0 top-0 w-[78%] rounded-[2rem] border border-klipio-border bg-white p-5 shadow-[0_28px_80px_rgba(20,18,33,0.12)]">
              <div className="flex items-center justify-between border-b border-klipio-border pb-4">
                <div className="flex items-center gap-3">
                  <KlipioLogo size="sm" markOnly />
                  <div>
                    <p className="text-sm font-bold text-klipio-text">
                      klipio.io
                    </p>
                    <p className="text-xs text-klipio-muted">analysis sheet</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#DFF7EA] px-3 py-1 text-xs font-semibold text-[#257A4A]">
                  Ready
                </span>
              </div>

              <div className="py-5">
                <div className="aspect-video overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#141221_0%,#3A2DE0_58%,#9B7BFF_100%)] p-4 text-white">
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold">
                        TikTok recipe clip
                      </span>
                      <Play className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-white/72">Detected topic</p>
                      <p className="text-2xl font-black">Pad thai in 90 sec</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  ["Ingredients", "11 found"],
                  ["Steps", "7 extracted"],
                  ["Calories", "est. 540"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-klipio-border bg-klipio-bg px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-klipio-text">
                      {label}
                    </span>
                    <span className="text-sm text-klipio-muted">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-2 right-0 w-[72%] rounded-[2rem] border border-klipio-border bg-klipio-text p-5 text-white shadow-[0_28px_80px_rgba(20,18,33,0.22)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold">Download panel</p>
                <Download className="h-5 w-5 text-[#9B7BFF]" />
              </div>
              <div className="space-y-3">
                <div className="h-3 rounded-full bg-white/20">
                  <div className="h-3 w-[84%] rounded-full bg-[linear-gradient(90deg,#3A2DE0,#9B7BFF)]" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <span className="rounded-full bg-white/10 py-2">MP4</span>
                  <span className="rounded-full bg-white/10 py-2">1080p</span>
                  <span className="rounded-full bg-white/10 py-2">No mark</span>
                </div>
              </div>
            </div>

            <div className="absolute right-8 top-28 hidden rounded-full border border-klipio-border bg-klipio-surface px-4 py-2 text-sm font-semibold text-klipio-text shadow-[0_16px_40px_rgba(20,18,33,0.08)] sm:flex">
              <Sparkles className="mr-2 h-4 w-4 text-klipio-primary" />
              AI understands the clip
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="border-y border-klipio-border bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {productModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <article
                key={mode.title}
                className="rounded-2xl border border-klipio-border bg-klipio-bg p-6"
              >
                <Icon className="mb-6 h-7 w-7 text-klipio-primary" />
                <h2 className="text-2xl font-black tracking-normal">
                  {mode.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-klipio-muted">
                  {mode.description}
                </p>
                <p className="mt-5 text-sm font-bold text-klipio-text">
                  {mode.detail}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-klipio-muted">
                Content intelligence
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-normal text-klipio-text">
                Not a recipe app. A video understanding layer.
              </h2>
              <p className="mt-5 text-base leading-7 text-klipio-muted">
                Recipes are one vertical. Klipio’s actual product is broader:
                it turns saved social videos into organized, searchable,
                reusable knowledge.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {intelligenceTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-klipio-border bg-white p-5"
                  >
                    <Icon className="h-6 w-6 text-klipio-primary" />
                    <h3 className="mt-5 text-xl font-black tracking-normal">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-klipio-muted">
                      {item.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-klipio-muted">
                Architecture promise
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-normal text-klipio-text">
                Built for downloader traffic, designed for AI value.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  [ShieldCheck, "Private by default", "Temporary files, guarded API routes, and clear deletion rules."],
                  [Globe2, "Global sources", "Designed around the platforms people already save from."],
                  [Layers3, "Queue based", "Heavy video work belongs off the request path."],
                  [Search, "Searchable library", "Every analyzed clip becomes structured data, not a dead bookmark."],
                ].map(([Icon, title, text]) => {
                  const LucideIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={title as string} className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-klipio-surface text-klipio-primary">
                        <LucideIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black tracking-normal">
                          {title as string}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-klipio-muted">
                          {text as string}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] bg-klipio-text p-6 text-white">
              <div className="mb-6 flex items-center gap-3">
                <KlipioLogo size="sm" markOnly />
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">
                  Pipeline
                </p>
              </div>
              <div className="space-y-4">
                {pipeline.map((step, index) => (
                  <div key={step} className="flex items-center gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-white/90">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 border-t border-klipio-border pt-12 md:flex-row md:items-center">
          <div>
            <BadgeCheck className="mb-4 h-7 w-7 text-klipio-primary" />
            <h2 className="text-3xl font-black tracking-normal">
              Start with the paste box.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-klipio-muted">
              The homepage is now aligned to the real product: fast video
              capture first, AI understanding immediately after.
            </p>
          </div>
          <Link href="#paste">
            <Button
              variant="accent"
              size="lg"
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              Paste a link
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
