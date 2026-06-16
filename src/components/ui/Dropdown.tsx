"use client";

import { useState, useRef, useEffect, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  trigger,
  children,
  align = "left",
  className,
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setOpen]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 mt-2 min-w-[200px] rounded-xl border border-klipio-border bg-klipio-surface shadow-xl shadow-black/30 overflow-hidden",
              align === "right" && "right-0",
              align === "left" && "left-0",
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  danger?: boolean;
}

export const DropdownItem = forwardRef<
  HTMLButtonElement,
  DropdownItemProps
>(({ className, leftIcon, rightIcon, danger, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-klipio-text hover:bg-klipio-surface-hover transition-colors",
      danger && "text-klipio-danger hover:bg-klipio-danger/10",
      className
    )}
    {...props}
  >
    {leftIcon && <span className="text-klipio-muted">{leftIcon}</span>}
    <span className="flex-1 text-left">{children}</span>
    {rightIcon}
  </button>
));
DropdownItem.displayName = "DropdownItem";

export function DropdownSeparator({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("my-1 border-t border-klipio-border", className)} />
  );
}

export function DropdownLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-4 py-2 text-xs font-medium text-klipio-muted",
        className
      )}
    >
      {children}
    </div>
  );
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full gap-3 px-4 py-2.5 rounded-xl border border-klipio-border bg-klipio-bg text-sm text-klipio-text hover:border-klipio-border-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          {selected?.icon}
          {selected?.label || placeholder}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-klipio-muted" />
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-xl border border-klipio-border bg-klipio-surface shadow-xl overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-colors",
                  value === option.value
                    ? "bg-klipio-primary/20 text-klipio-accent"
                    : "text-klipio-text hover:bg-klipio-surface-hover"
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
