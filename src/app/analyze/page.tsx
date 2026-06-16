"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Utensils,
  MapPin,
  Tag,
  ListChecks,
  FileText,
  Clock,
  Flame,
  ShoppingCart,
  ExternalLink,
  Bookmark,
  Share2,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Star,
  Navigation,
  Ticket,
  Bed,
  Camera,
  Info,
  Play,
  Pause,
  Download,
} from "lucide-react";

// ─── Mock AI Analysis Data ───
const mockAnalysis = {
  video: {
    id: "vid_123",
    title: "Amazing Street Food Tour in Bangkok — Pad Thai & Mango Sticky Rice",
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop",
    platform: "TikTok",
    duration: 184,
    author: "@FoodieTraveler",
  },
  recipe: {
    name: "Authentic Pad Thai",
    description:
      "A classic Thai stir-fried rice noodle dish with shrimp, tofu, bean sprouts, and crushed peanuts.",
    prepTime: "15 min",
    cookTime: "10 min",
    servings: 2,
    calories: "480 kcal",
    difficulty: "Medium",
    rating: 4.8,
    ingredients: [
      { name: "Rice noodles (pad thai)", amount: "200g", checked: false },
      { name: "Shrimp, peeled", amount: "150g", checked: false },
      { name: "Firm tofu, cubed", amount: "100g", checked: false },
      { name: "Eggs", amount: "2", checked: false },
      { name: "Bean sprouts", amount: "1 cup", checked: false },
      { name: "Garlic chives", amount: "4 stalks", checked: false },
      { name: "Crushed peanuts", amount: "3 tbsp", checked: false },
      { name: "Tamarind paste", amount: "2 tbsp", checked: false },
      { name: "Fish sauce", amount: "2 tbsp", checked: false },
      { name: "Palm sugar", amount: "1 tbsp", checked: false },
      { name: "Lime", amount: "1", checked: false },
      { name: "Vegetable oil", amount: "2 tbsp", checked: false },
    ],
    steps: [
      "Soak rice noodles in warm water for 30 minutes until pliable but not soft.",
      "Mix tamarind paste, fish sauce, and palm sugar in a small bowl to make the sauce.",
      "Heat oil in a wok over high heat. Add shrimp and cook for 1-2 minutes until pink.",
      "Push shrimp to the side, add tofu and cook until golden, about 2 minutes.",
      "Add eggs to the wok, scramble quickly, then mix with shrimp and tofu.",
      "Drain noodles and add to the wok along with the sauce. Stir-fry for 2-3 minutes.",
      "Add bean sprouts and garlic chives. Toss quickly for 30 seconds.",
      "Serve immediately with lime wedges and crushed peanuts on top.",
    ],
    shoppingLinks: [
      {
        name: "Tamarind Paste",
        price: "$5.99",
        source: "Amazon",
        url: "#",
      },
      {
        name: "Rice Noodles",
        price: "$3.49",
        source: "Walmart",
        url: "#",
      },
      {
        name: "Fish Sauce",
        price: "$4.29",
        source: "Target",
        url: "#",
      },
    ],
  },
  travel: {
    destination: "Bangkok, Thailand",
    description:
      "Bangkok is Thailand's vibrant capital, known for its ornate shrines, bustling street life, and world-famous street food scene.",
    bestTime: "November to February",
    budget: "$30-50/day",
    rating: 4.7,
    attractions: [
      {
        name: "Chatuchak Weekend Market",
        type: "Market",
        description: "One of the world's largest weekend markets with 15,000+ stalls.",
      },
      {
        name: "Wat Arun (Temple of Dawn)",
        type: "Temple",
        description: "Iconic riverside temple with stunning Khmer-style spire.",
      },
      {
        name: "Yaowarat (Chinatown)",
        type: "Food",
        description: "Famous street food district with Michelin-recommended stalls.",
      },
      {
        name: "Khao San Road",
        type: "Nightlife",
        description: "Backpacker hub with street food, bars, and night markets.",
      },
    ],
    bookingLinks: [
      { name: "Flights to Bangkok", price: "From $450", source: "Skyscanner", url: "#" },
      { name: "Hotels near Khao San", price: "From $25/night", source: "Booking.com", url: "#" },
      { name: "Street Food Tour", price: "$35/person", source: "GetYourGuide", url: "#" },
    ],
  },
  brands: [
    { name: "Thai Kitchen", category: "Food", confidence: 94 },
    { name: "Mama Noodles", category: "Food", confidence: 88 },
    { name: "Chang Beer", category: "Beverage", confidence: 82 },
    { name: "Samsung", category: "Electronics", confidence: 76 },
    { name: "Coca-Cola", category: "Beverage", confidence: 91 },
  ],
  keyPoints: [
    {
      category: "Cooking Tips",
      icon: Utensils,
      points: [
        "Soak noodles until pliable but not mushy — they cook more in the wok.",
        "High heat is essential for authentic wok hei (breath of the wok) flavor.",
        "Prepare all ingredients before starting — pad thai cooks very quickly.",
      ],
    },
    {
      category: "Location Info",
      icon: MapPin,
      points: [
        "Video filmed in Bangkok's Chinatown (Yaowarat) district.",
        "Street food stalls open from 6 PM to midnight.",
        "Best time to visit is November-February (cool season).",
      ],
    },
    {
      category: "Nutrition",
      icon: Info,
      points: [
        "Pad Thai is naturally gluten-free when using rice noodles.",
        "One serving provides ~25g of protein from shrimp and tofu.",
        "Can be made vegetarian by substituting fish sauce with soy sauce.",
      ],
    },
  ],
  transcript: [
    { time: "0:00", text: "Hey everyone, welcome back to my food tour! Today we're in Bangkok." },
    { time: "0:08", text: "This street vendor has been making pad thai for over 30 years." },
    { time: "0:15", text: "First, she soaks the rice noodles until they're just right — not too soft." },
    { time: "0:24", text: "The secret is in the sauce — tamarind, fish sauce, and palm sugar." },
    { time: "0:35", text: "Look at that wok technique! High heat is absolutely essential." },
    { time: "0:48", text: "She adds the shrimp first, then tofu, then pushes everything aside for the eggs." },
    { time: "1:05", text: "Bean sprouts go in last — you want them to stay crispy." },
    { time: "1:18", text: "And there it is — authentic Bangkok street-style pad thai!" },
    { time: "1:30", text: "Let's try it... wow, the balance of sweet, sour, and salty is perfect." },
    { time: "1:45", text: "If you come to Bangkok, this stall is on Yaowarat Road, open every evening." },
    { time: "2:00", text: "Don't forget to squeeze fresh lime and add extra crushed peanuts on top!" },
  ],
};

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const [activeTab, setActiveTab] = useState("recipe");
  const [isLoading, setIsLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [isSaved, setIsSaved] = useState(false);

  // Simulate AI analysis loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton variant="circular" width={48} height={48} />
            <div>
              <Skeleton variant="text" width={200} height={20} />
              <Skeleton variant="text" width={120} height={14} />
            </div>
          </div>
          <Skeleton variant="rounded" height={400} className="mb-6" />
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="text" width={80} height={36} />
            ))}
          </div>
          <Skeleton variant="rounded" height={300} />
        </div>
      </div>
    );
  }

  const analysis = mockAnalysis;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-klipio-muted hover:text-klipio-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-klipio-primary to-klipio-secondary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">AI Analysis</h1>
              <p className="text-sm text-klipio-muted">
                Powered by multimodal AI understanding
              </p>
            </div>
          </div>

          {/* Video Preview */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-klipio-surface border border-klipio-border">
            <Image
              src={analysis.video.thumbnail}
              alt={analysis.video.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-white font-semibold text-lg">
                {analysis.video.title}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-white/80 text-sm">
                <span>{analysis.video.author}</span>
                <span>{analysis.video.platform}</span>
                <span>{Math.floor(analysis.video.duration / 60)}m {analysis.video.duration % 60}s</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <Button
            variant={isSaved ? "success" : "secondary"}
            size="sm"
            leftIcon={
              isSaved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )
            }
            onClick={() => setIsSaved(!isSaved)}
          >
            {isSaved ? "Saved" : "Save to Collection"}
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Share2 className="w-4 h-4" />}>
            Share
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Download Video
          </Button>
        </motion.div>

        {/* Analysis Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="recipe" onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="recipe">
                <Utensils className="w-4 h-4" />
                Recipe
              </TabsTrigger>
              <TabsTrigger value="travel">
                <MapPin className="w-4 h-4" />
                Travel
              </TabsTrigger>
              <TabsTrigger value="brands">
                <Tag className="w-4 h-4" />
                Brands
              </TabsTrigger>
              <TabsTrigger value="keypoints">
                <ListChecks className="w-4 h-4" />
                Key Points
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="w-4 h-4" />
                Transcript
              </TabsTrigger>
            </TabsList>

            {/* ─── RECIPE TAB ─── */}
            <TabsContent value="recipe">
              <div className="space-y-6">
                {/* Recipe Header */}
                <Card>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {analysis.recipe.name}
                      </h2>
                      <p className="text-sm text-klipio-muted mt-1">
                        {analysis.recipe.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-klipio-primary/10 text-klipio-accent text-sm font-medium shrink-0 self-start">
                      <Star className="w-4 h-4 fill-klipio-warning text-klipio-warning" />
                      {analysis.recipe.rating}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {[
                      {
                        icon: Clock,
                        label: "Prep",
                        value: analysis.recipe.prepTime,
                      },
                      {
                        icon: Flame,
                        label: "Cook",
                        value: analysis.recipe.cookTime,
                      },
                      {
                        icon: Utensils,
                        label: "Servings",
                        value: `${analysis.recipe.servings}`,
                      },
                      {
                        icon: Info,
                        label: "Calories",
                        value: analysis.recipe.calories,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-klipio-surface border border-klipio-border"
                      >
                        <item.icon className="w-4 h-4 text-klipio-primary" />
                        <span className="text-xs text-klipio-muted">
                          {item.label}
                        </span>
                        <span className="text-sm font-medium">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ingredients */}
                  <Card>
                    <h3 className="font-semibold mb-4">
                      Ingredients ({analysis.recipe.ingredients.length})
                    </h3>
                    <div className="space-y-2">
                      {analysis.recipe.ingredients.map((ing, i) => (
                        <motion.button
                          key={i}
                          onClick={() => toggleIngredient(i)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                            checkedIngredients.has(i)
                              ? "bg-klipio-success/10 opacity-60"
                              : "hover:bg-klipio-surface-hover"
                          )}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                              checkedIngredients.has(i)
                                ? "bg-klipio-success border-klipio-success"
                                : "border-klipio-border"
                            )}
                          >
                            {checkedIngredients.has(i) && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "flex-1 text-sm",
                              checkedIngredients.has(i) &&
                                "line-through text-klipio-muted"
                            )}
                          >
                            {ing.name}
                          </span>
                          <span className="text-sm text-klipio-muted shrink-0">
                            {ing.amount}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </Card>

                  {/* Steps */}
                  <Card>
                    <h3 className="font-semibold mb-4">
                      Instructions ({analysis.recipe.steps.length} steps)
                    </h3>
                    <div className="space-y-4">
                      {analysis.recipe.steps.map((step, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex gap-3"
                        >
                          <div className="shrink-0 w-7 h-7 rounded-full bg-klipio-primary/20 flex items-center justify-center text-xs font-bold text-klipio-accent">
                            {i + 1}
                          </div>
                          <p className="text-sm text-klipio-text leading-relaxed pt-0.5">
                            {step}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Shopping Links */}
                <Card>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-klipio-primary" />
                    Shop Ingredients
                  </h3>
                  <div className="space-y-2">
                    {analysis.recipe.shoppingLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-klipio-surface hover:bg-klipio-surface-hover border border-klipio-border hover:border-klipio-border-hover transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-klipio-primary/10 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-klipio-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{link.name}</p>
                            <p className="text-xs text-klipio-muted">
                              {link.source}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-klipio-accent">
                            {link.price}
                          </span>
                          <ExternalLink className="w-4 h-4 text-klipio-muted group-hover:text-klipio-text transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* ─── TRAVEL TAB ─── */}
            <TabsContent value="travel">
              <div className="space-y-6">
                <Card>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {analysis.travel.destination}
                      </h2>
                      <p className="text-sm text-klipio-muted mt-1">
                        {analysis.travel.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-klipio-primary/10 text-klipio-accent text-sm font-medium shrink-0">
                      <Star className="w-4 h-4 fill-klipio-warning text-klipio-warning" />
                      {analysis.travel.rating}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-klipio-surface border border-klipio-border">
                      <Clock className="w-4 h-4 text-klipio-primary" />
                      <span className="text-xs text-klipio-muted">Best Time</span>
                      <span className="text-sm font-medium">
                        {analysis.travel.bestTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-klipio-surface border border-klipio-border">
                      <Ticket className="w-4 h-4 text-klipio-primary" />
                      <span className="text-xs text-klipio-muted">Budget</span>
                      <span className="text-sm font-medium">
                        {analysis.travel.budget}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Attractions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {analysis.travel.attractions.map((attr, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card hover className="h-full">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-10 h-10 rounded-xl bg-klipio-primary/10 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-klipio-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm">
                                {attr.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full bg-klipio-accent/10 text-[10px] font-medium text-klipio-accent">
                                {attr.type}
                              </span>
                            </div>
                            <p className="text-xs text-klipio-muted leading-relaxed">
                              {attr.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Booking Links */}
                <Card>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Bed className="w-5 h-5 text-klipio-primary" />
                    Book Your Trip
                  </h3>
                  <div className="space-y-2">
                    {analysis.travel.bookingLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-klipio-surface hover:bg-klipio-surface-hover border border-klipio-border hover:border-klipio-border-hover transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-klipio-primary/10 flex items-center justify-center">
                            <Navigation className="w-4 h-4 text-klipio-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{link.name}</p>
                            <p className="text-xs text-klipio-muted">
                              {link.source}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-klipio-accent">
                            {link.price}
                          </span>
                          <ExternalLink className="w-4 h-4 text-klipio-muted group-hover:text-klipio-text transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* ─── BRANDS TAB ─── */}
            <TabsContent value="brands">
              <div className="space-y-4">
                {analysis.brands.map((brand, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-klipio-primary/10 flex items-center justify-center shrink-0">
                          <Tag className="w-5 h-5 text-klipio-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{brand.name}</h3>
                            <span className="px-2 py-0.5 rounded-full bg-klipio-accent/10 text-[10px] font-medium text-klipio-accent">
                              {brand.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-klipio-surface rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-klipio-primary to-klipio-accent rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${brand.confidence}%` }}
                                transition={{
                                  delay: i * 0.1 + 0.3,
                                  duration: 0.8,
                                  ease: "easeOut",
                                }}
                              />
                            </div>
                            <span className="text-xs text-klipio-muted shrink-0">
                              {brand.confidence}%
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* ─── KEY POINTS TAB ─── */}
            <TabsContent value="keypoints">
              <div className="space-y-6">
                {analysis.keyPoints.map((section, i) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.category}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-lg bg-klipio-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-klipio-primary" />
                          </div>
                          <h3 className="font-semibold">{section.category}</h3>
                        </div>
                        <ul className="space-y-3">
                          {section.points.map((point, j) => (
                            <motion.li
                              key={j}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 + j * 0.05 }}
                              className="flex items-start gap-3"
                            >
                              <CheckCircle2 className="w-4 h-4 text-klipio-success shrink-0 mt-0.5" />
                              <span className="text-sm text-klipio-text leading-relaxed">
                                {point}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ─── TRANSCRIPT TAB ─── */}
            <TabsContent value="transcript">
              <Card>
                <div className="space-y-1">
                  {analysis.transcript.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex gap-4 p-2.5 rounded-xl hover:bg-klipio-surface/50 transition-colors group cursor-pointer"
                    >
                      <span className="text-xs text-klipio-muted font-mono shrink-0 pt-0.5">
                        {line.time}
                      </span>
                      <p className="text-sm text-klipio-text leading-relaxed">
                        {line.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

// Wrap in Suspense for static generation
export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-klipio-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-klipio-primary" /></div>}>
      <AnalyzeContent />
    </Suspense>
  );
}


