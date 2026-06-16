"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn, formatDuration, detectPlatform } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Sparkles,
  CheckCircle2,
  FileVideo,
  Music,
  Monitor,
  Loader2,
  ArrowLeft,
  Share2,
  Bookmark,
  Play,
  Pause,
  Volume2,
  Clock,
  User,
  Eye,
  Heart,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

// ─── Mock Data ───
const mockVideo = {
  id: "vid_123",
  title: "Amazing Street Food Tour in Bangkok — Pad Thai & Mango Sticky Rice",
  thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop",
  platform: "TikTok",
  duration: 184,
  author: "@FoodieTraveler",
  views: "2.4M",
  likes: "156K",
  comments: "3.2K",
  uploaded: "3 days ago",
  qualities: [
    { label: "4K Ultra HD", value: "4k", size: "128 MB", format: "MP4", icon: Monitor },
    { label: "1080p HD", value: "1080p", size: "64 MB", format: "MP4", icon: Monitor },
    { label: "720p HD", value: "720p", size: "32 MB", format: "MP4", icon: Monitor },
    { label: "Audio Only", value: "audio", size: "8 MB", format: "MP3", icon: Music },
  ],
};

const relatedVideos = [
  {
    id: "rel_1",
    thumbnail: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=225&fit=crop",
    title: "Authentic Thai Green Curry Recipe — Step by Step",
    platform: "YouTube",
    duration: 312,
  },
  {
    id: "rel_2",
    thumbnail: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=225&fit=crop",
    title: "Japanese Street Food — Takoyaki in Osaka",
    platform: "TikTok",
    duration: 58,
  },
  {
    id: "rel_3",
    thumbnail: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=225&fit=crop",
    title: "Best Vegan Restaurants in Bali 2024",
    platform: "Instagram",
    duration: 124,
  },
];

function DownloadContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const [selectedQuality, setSelectedQuality] = useState("1080p");
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = async () => {
    setDownloadState("downloading");
    setProgress(0);
    // Simulate download progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadState("complete");
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 300);
  };

  const selectedOption = mockVideo.qualities.find((q) => q.value === selectedQuality);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <Skeleton variant="rounded" height={400} className="mb-6" />
          <Skeleton variant="text" width="60%" height={24} className="mb-3" />
          <Skeleton variant="text" width="40%" height={16} className="mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={80} />
            ))}
          </div>
        </div>
      </div>
    );
  }

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Video Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative aspect-video rounded-2xl overflow-hidden bg-klipio-surface border border-klipio-border group"
            >
              <Image
                src={mockVideo.thumbnail}
                alt={mockVideo.title}
                fill
                className="object-cover"
                priority
              />
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-white fill-white" />
                  ) : (
                    <Play className="w-7 h-7 text-white fill-white ml-1" />
                  )}
                </motion.div>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-xs font-medium text-white">
                {formatDuration(mockVideo.duration)}
              </div>

              {/* Platform badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-klipio-primary text-white text-xs font-bold">
                {mockVideo.platform}
              </div>
            </motion.div>

            {/* Video Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-xl sm:text-2xl font-bold text-klipio-text mb-3 leading-tight">
                {mockVideo.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-klipio-muted">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {mockVideo.author}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  {mockVideo.views} views
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4" />
                  {mockVideo.likes}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {mockVideo.uploaded}
                </span>
              </div>
            </motion.div>

            {/* Quality Selector */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-lg font-semibold mb-4">Select Quality</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mockVideo.qualities.map((quality) => {
                  const Icon = quality.icon;
                  const isSelected = selectedQuality === quality.value;
                  return (
                    <motion.button
                      key={quality.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedQuality(quality.value)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 text-left transition-all",
                        isSelected
                          ? "border-klipio-primary bg-klipio-primary/10"
                          : "border-klipio-border bg-klipio-surface hover:border-klipio-border-hover"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-klipio-primary" />
                        </div>
                      )}
                      <Icon
                        className={cn(
                          "w-5 h-5 mb-2",
                          isSelected ? "text-klipio-primary" : "text-klipio-muted"
                        )}
                      />
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-klipio-text" : "text-klipio-muted"
                        )}
                      >
                        {quality.label}
                      </p>
                      <p className="text-xs text-klipio-muted mt-0.5">
                        {quality.size}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Download Progress */}
            <AnimatePresence>
              {downloadState === "downloading" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Card className="border-klipio-primary/30 bg-klipio-primary/5">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 text-klipio-primary animate-spin" />
                      <span className="text-sm font-medium">
                        Downloading... {Math.round(Math.min(progress, 100))}%
                      </span>
                    </div>
                    <div className="h-2 bg-klipio-surface rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-klipio-primary to-klipio-accent rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                      />
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {downloadState === "complete" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-klipio-success/30 bg-klipio-success/10">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-klipio-success" />
                      <span className="text-sm font-medium text-klipio-success">
                        Download complete! File saved to your device.
                      </span>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Related Videos */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-lg font-semibold mb-4">You Might Also Like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedVideos.map((video, i) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                  >
                    <Card hover className="cursor-pointer" padding="none">
                      <div className="relative aspect-video">
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          className="object-cover rounded-t-2xl"
                        />
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-xs text-white">
                          {formatDuration(video.duration)}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">
                          {video.title}
                        </p>
                        <span className="text-xs text-klipio-muted mt-1">
                          {video.platform}
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: Actions Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {/* Download Card */}
            <Card className="sticky top-24" padding="lg">
              <h3 className="font-semibold mb-4">Download Options</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-klipio-muted">Quality</span>
                  <span className="font-medium">{selectedOption?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-klipio-muted">Format</span>
                  <span className="font-medium">{selectedOption?.format}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-klipio-muted">Size</span>
                  <span className="font-medium">{selectedOption?.size}</span>
                </div>
                <div className="border-t border-klipio-border pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-klipio-muted">Speed</span>
                    <span className="font-medium text-klipio-success">
                      Unlimited
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="accent"
                size="lg"
                fullWidth
                leftIcon={<Download className="w-5 h-5" />}
                isLoading={downloadState === "downloading"}
                onClick={handleDownload}
                disabled={downloadState === "complete"}
              >
                {downloadState === "complete"
                  ? "Downloaded"
                  : downloadState === "downloading"
                  ? "Downloading..."
                  : "Download Now"}
              </Button>

              <div className="mt-4">
                <Link href={`/analyze?url=${encodeURIComponent(url || "")}`}>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    leftIcon={<Sparkles className="w-5 h-5" />}
                  >
                    Analyze with AI
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card padding="md">
              <div className="flex flex-col gap-2">
                <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface transition-colors">
                  <Bookmark className="w-4 h-4" />
                  Save to Collection
                </button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for static generation
export default function DownloadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-klipio-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-klipio-primary" /></div>}>
      <DownloadContent />
    </Suspense>
  );
}


