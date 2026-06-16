"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonGrid } from "@/components/ui/Skeleton";
import { VideoCard } from "@/components/VideoCard";
import { cn, detectPlatform } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Clock,
  Trash2,
  Filter,
  Search,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";

// ─── Mock History Data ───
const generateMockHistory = () => {
  const platforms = ["TikTok", "YouTube", "Instagram", "Facebook", "Twitter"];
  const titles = [
    "Amazing Street Food Tour in Bangkok",
    "10 Minute Ab Workout — No Equipment",
    "DIY Home Decor on a Budget",
    "iPhone 16 Pro Max Review — 1 Month Later",
    "How to Make Perfect Sourdough Bread",
    "Tokyo Travel Guide 2024",
    "React 19 New Features Explained",
    "Easy Keto Dinner Recipes",
    "Minecraft Building Tutorial — Castle",
    "ASMR Relaxing Spa Sounds",
    "Best Free AI Tools for Creators",
    "Minimalist Desk Setup Tour",
  ];

  return Array.from({ length: 24 }, (_, i) => ({
    id: `hist_${i + 1}`,
    thumbnail: `https://picsum.photos/seed/${i + 100}/400/225`,
    title: titles[i % titles.length],
    platform: platforms[i % platforms.length],
    duration: [58, 184, 312, 420, 95, 245, 180, 150, 300, 600, 120, 200][i % 12],
    quality: ["4K", "1080p", "1080p", "720p", "4K", "1080p", "720p", "1080p", "4K", "1080p", "720p", "1080p"][i % 12],
    downloadedAt: `${Math.floor(i / 3) + 1}d ago`,
    author: `@user_${i + 1}`,
  }));
};

const ITEMS_PER_PAGE = 9;

export default function HistoryPage() {
  const [videos, setVideos] = useState(generateMockHistory());
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filter videos
  const filteredVideos = videos.filter((video) => {
    const matchesFilter =
      filter === "all" ||
      video.platform.toLowerCase() === filter.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
  const paginatedVideos = filteredVideos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      setVideos([]);
    }
  };

  const platformFilters = [
    { value: "all", label: "All" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "twitter", label: "X" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={100} height={36} />
          </div>
          <SkeletonGrid count={9} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-klipio-surface border border-klipio-border flex items-center justify-center">
                <Clock className="w-5 h-5 text-klipio-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">History</h1>
                <p className="text-sm text-klipio-muted">
                  {filteredVideos.length} videos downloaded
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={handleClearAll}
                disabled={videos.length === 0}
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-klipio-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search videos..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-klipio-surface border border-klipio-border text-sm text-klipio-text placeholder:text-klipio-muted outline-none focus:border-klipio-primary focus:ring-2 focus:ring-klipio-primary/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-klipio-muted hover:text-klipio-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Platform Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {platformFilters.map((pf) => (
                <button
                  key={pf.value}
                  onClick={() => {
                    setFilter(pf.value);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                    filter === pf.value
                      ? "bg-klipio-primary text-white"
                      : "bg-klipio-surface text-klipio-muted hover:text-klipio-text border border-klipio-border"
                  )}
                >
                  {pf.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Videos Grid */}
        {paginatedVideos.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {paginatedVideos.map((video, i) => (
              <VideoCard
                key={video.id}
                video={video}
                variant="history"
                onDownload={() => {}}
                onAnalyze={() => {}}
                onDelete={handleDelete}
                index={i}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-klipio-surface border border-klipio-border flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-klipio-muted" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No results found" : "No download history"}
            </h3>
            <p className="text-sm text-klipio-muted mb-6 max-w-sm mx-auto">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Videos you download will appear here. Start by pasting a link!"}
            </p>
            {!searchQuery && (
              <Link href="/">
                <Button variant="accent">
                  <Download className="w-4 h-4" />
                  Start Downloading
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 mt-10"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Prev
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1
                )
                .map((p, i, arr) => (
                  <div key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && (
                      <span className="px-2 text-klipio-muted">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                        currentPage === p
                          ? "bg-klipio-primary text-white"
                          : "text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface"
                      )}
                    >
                      {p}
                    </button>
                  </div>
                ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
