"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      leftIcon,
      rightIcon,
      error,
      label,
      helperText,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-klipio-text mb-1.5">
            {label}
          </label>
        )}
        <motion.div
          className={cn(
            "relative flex items-center rounded-xl border bg-klipio-bg transition-all duration-200",
            "border-klipio-border focus-within:border-klipio-primary focus-within:ring-2 focus-within:ring-klipio-primary/20",
            error && "border-klipio-danger focus-within:border-klipio-danger focus-within:ring-klipio-danger/20"
          )}
          whileFocus={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {leftIcon && (
            <div className="absolute left-4 text-klipio-muted pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "flex-1 bg-transparent px-4 py-3 text-sm text-klipio-text placeholder:text-klipio-muted",
              "outline-none disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon && "pl-12",
              rightIcon && "pr-12",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-klipio-muted">
              {rightIcon}
            </div>
          )}
        </motion.div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-klipio-danger mt-1"
          >
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className="text-xs text-klipio-muted mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
