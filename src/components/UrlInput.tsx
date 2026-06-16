"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, detectPlatform } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  ClipboardPaste,
  X,
  Loader2,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const platformIcons: Record<string, { color: string; label: string }> = {
  tiktok: { color: "#FE2C55", label: "TikTok" },
  instagram: { color: "#E4405F", label: "Instagram" },
  youtube: { color: "#FF0000", label: "YouTube" },
  facebook: { color: "#1877F2", label: "Facebook" },
  twitter: { color: "#1DA1F2", label: "X" },
  reddit: { color: "#FF4500", label: "Reddit" },
  pinterest: { color: "#E60023", label: "Pinterest" },
};

type InputState = "idle" | "detecting" | "loading" | "error" | "success";

interface UrlInputProps {
  size?: "default" | "hero";
  onSubmit?: (url: string, mode: "download" | "analyze") => void;
  className?: string;
}

export function UrlInput({
  size = "default",
  onSubmit,
  className,
}: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [state, setState] = useState<InputState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isHero = size === "hero";

  // Detect platform from URL
  useEffect(() => {
    if (!url.trim()) {
      setDetectedPlatform(null);
      return;
    }
    const platform = detectPlatform(url);
    setDetectedPlatform(platform);
  }, [url]);

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      inputRef.current?.focus();
    } catch {
      // Fallback for browsers that don't support clipboard API
      setErrorMessage("Please paste manually (Ctrl+V)");
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, []);

  // Simulate progress
  const simulateProgress = useCallback(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);
    return interval;
  }, []);

  const handleSubmit = useCallback(
    async (mode: "download" | "analyze") => {
      if (!url.trim()) {
        setErrorMessage("Please enter a video URL");
        setState("error");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      // Basic URL validation
      const urlPattern = /^(https?:\/\/)?(www\.)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
      if (!urlPattern.test(url.trim())) {
        setErrorMessage("Please enter a valid URL");
        setState("error");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      setState("loading");
      setErrorMessage("");
      const progressInterval = simulateProgress();

      if (onSubmit) {
        onSubmit(url, mode);
      } else {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => {
          setState("success");
          setTimeout(() => {
            if (mode === "download") {
              router.push(`/download?url=${encodeURIComponent(url)}`);
            } else {
              router.push(`/analyze?url=${encodeURIComponent(url)}`);
            }
          }, 500);
        }, 500);
      }
    },
    [url, onSubmit, router, simulateProgress]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (droppedUrl) {
      setUrl(droppedUrl);
    }
  }, []);

  // Keyboard shortcut (Ctrl+V when focused on window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && document.activeElement === document.body) {
        handlePaste();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePaste]);

  const platform = detectedPlatform ? platformIcons[detectedPlatform] : null;

  return (
    <div className={cn("w-full", className)}>
      <motion.div
        className={cn(
          "relative rounded-2xl border-2 transition-all duration-300 overflow-hidden",
          isDragging
            ? "border-klipio-primary bg-klipio-primary/5 shadow-glow"
            : state === "error"
            ? "border-klipio-danger"
            : state === "success"
            ? "border-klipio-success"
            : detectedPlatform
            ? "border-klipio-primary/50 bg-klipio-surface/50"
            : "border-klipio-border bg-klipio-surface/30",
          isHero ? "p-2 sm:p-3" : "p-1.5 sm:p-2"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={
          isDragging
            ? { scale: 1.02 }
            : state === "error"
            ? { x: [0, -10, 10, -10, 10, 0] }
            : { scale: 1 }
        }
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Platform indicator */}
        <AnimatePresence>
          {platform && state === "idle" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-0 right-0 -mt-2 -mr-2 z-10"
            >
              <div
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-lg"
                style={{ backgroundColor: platform.color }}
              >
                {platform.label}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input container */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Left icon */}
          <div className="shrink-0 pl-2 sm:pl-3">
            {state === "loading" ? (
              <Loader2 className="w-5 h-5 text-klipio-primary animate-spin" />
            ) : state === "error" ? (
              <AlertCircle className="w-5 h-5 text-klipio-danger" />
            ) : state === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-klipio-success" />
            ) : (
              <Link2
                className={cn(
                  "w-5 h-5 transition-colors",
                  detectedPlatform ? "text-klipio-primary" : "text-klipio-muted"
                )}
              />
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (state === "error") setState("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit("download");
            }}
            placeholder={
              isDragging
                ? "Drop your link here..."
                : isHero
                ? "Paste any video link from TikTok, Instagram, YouTube..."
                : "Paste video URL..."
            }
            className={cn(
              "flex-1 bg-transparent text-klipio-text placeholder:text-klipio-muted outline-none",
              isHero
                ? "text-base sm:text-lg py-3 sm:py-4"
                : "text-sm py-2.5 sm:py-3"
            )}
            disabled={state === "loading"}
          />

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-1">
            {/* Clear button */}
            <AnimatePresence>
              {url && state === "idle" && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => {
                    setUrl("");
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-lg text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Paste button */}
            <AnimatePresence>
              {!url && state === "idle" && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handlePaste}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-klipio-muted hover:text-klipio-text bg-klipio-surface hover:bg-klipio-surface-hover border border-klipio-border transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Progress bar */}
        <AnimatePresence>
          {state === "loading" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 3 }}
              exit={{ opacity: 0, height: 0 }}
              className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-b-2xl"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-klipio-primary via-klipio-accent to-klipio-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {state === "error" && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 text-sm text-klipio-danger flex items-center gap-1.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <motion.div
        className={cn(
          "flex gap-2 sm:gap-3 mt-3 sm:mt-4",
          isHero ? "flex-col sm:flex-row" : "flex-row"
        )}
      >
        <Button
          variant="accent"
          size={isHero ? "lg" : "default"}
          fullWidth={isHero}
          leftIcon={<Download className="w-5 h-5" />}
          isLoading={state === "loading"}
          onClick={() => handleSubmit("download")}
          className="flex-1"
        >
          {state === "loading" ? "Processing..." : "Download Video"}
        </Button>
        <Button
          variant="secondary"
          size={isHero ? "lg" : "default"}
          fullWidth={isHero}
          leftIcon={<Sparkles className="w-5 h-5" />}
          onClick={() => handleSubmit("analyze")}
          disabled={state === "loading"}
          className="flex-1"
        >
          Analyze with AI
        </Button>
      </motion.div>
    </div>
  );
}
