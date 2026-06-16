"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn, formatDuration, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Clock,
  FileVideo,
  Music,
  Trash2,
  ExternalLink,
  MoreVertical,
  Monitor,
} from "lucide-react";

interface VideoCardProps {
  video: {
    id: string;
    thumbnail: string;
    title: string;
    platform: string;
    duration: number;
    quality?: string;
    downloadedAt?: string;
    author?: string;
  };
  variant?: "download" | "history" | "trending";
  onDownload?: (id: string, quality: string) => void;
  onAnalyze?: (id: string) => void;
  onDelete?: (id: string) => void;
  index?: number;
}

const platformColors: Record<string, string> = {
  tiktok: "#FE2C55",
  instagram: "#E4405F",
  youtube: "#FF0000",
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  reddit: "#FF4500",
  pinterest: "#E60023",
};

export function VideoCard({
  video,
  variant = "download",
  onDownload,
  onAnalyze,
  onDelete,
  index = 0,
}: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const platformColor = platformColors[video.platform.toLowerCase()] || "#6B6B7B";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card
        hover
        className="overflow-hidden group"
        padding="none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-klipio-surface-elevated overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 shimmer" />
          )}
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            className={cn(
              "object-cover transition-transform duration-500",
              isHovered && "scale-110"
            )}
            onLoad={() => setImageLoaded(true)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </div>

          {/* Platform badge */}
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase tracking-wider"
            style={{ backgroundColor: platformColor }}
          >
            {video.platform}
          </div>

          {/* Play overlay on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer"
                onClick={() => setIsPlaying(true)}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                >
                  <Play className="w-6 h-6 text-white fill-white ml-1" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="text-sm font-medium text-klipio-text leading-snug line-clamp-2">
            {truncate(video.title, 80)}
          </h3>

          {/* Meta info */}
          <div className="flex items-center gap-2 text-xs text-klipio-muted">
            {video.author && (
              <span className="truncate max-w-[120px]">{video.author}</span>
            )}
            {video.downloadedAt && (
              <>
                <span className="w-1 h-1 rounded-full bg-klipio-muted" />
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.downloadedAt}
                </span>
              </>
            )}
          </div>

          {/* Quality badge */}
          {video.quality && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-klipio-success/10 text-klipio-success text-xs font-medium">
              <Monitor className="w-3 h-3" />
              {video.quality}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {variant !== "history" && onDownload && (
              <Dropdown
                trigger={
                  <Button
                    variant="default"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    fullWidth
                  >
                    Download
                  </Button>
                }
              >
                <DropdownItem leftIcon={<FileVideo className="w-4 h-4" />}>
                  HD Video (1080p)
                </DropdownItem>
                <DropdownItem leftIcon={<FileVideo className="w-4 h-4" />}>
                  SD Video (720p)
                </DropdownItem>
                <DropdownItem leftIcon={<Music className="w-4 h-4" />}>
                  Audio Only (MP3)
                </DropdownItem>
              </Dropdown>
            )}

            {variant === "history" && onDownload && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => onDownload(video.id, "hd")}
                fullWidth
              >
                Download Again
              </Button>
            )}

            {onAnalyze && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onAnalyze(video.id)}
                className="shrink-0"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            )}

            {variant === "history" && onDelete && (
              <Dropdown
                trigger={
                  <Button variant="ghost" size="icon-sm" className="shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                }
                align="right"
              >
                <DropdownItem leftIcon={<ExternalLink className="w-4 h-4" />}>
                  Open Source
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  danger
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => onDelete(video.id)}
                >
                  Delete
                </DropdownItem>
              </Dropdown>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
