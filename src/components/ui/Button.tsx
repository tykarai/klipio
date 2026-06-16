"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klipio-primary focus-visible:ring-offset-2 focus-visible:ring-offset-klipio-bg disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-klipio-primary text-white hover:bg-klipio-primary-hover hover:shadow-glow-sm active:scale-[0.98]",
        secondary:
          "bg-klipio-surface text-klipio-text border border-klipio-border hover:bg-klipio-surface-hover hover:border-klipio-border-hover active:scale-[0.98]",
        accent:
          "bg-gradient-to-r from-klipio-primary to-klipio-secondary text-white hover:shadow-glow active:scale-[0.98]",
        outline:
          "border-2 border-klipio-primary text-klipio-accent bg-transparent hover:bg-klipio-primary/10 active:scale-[0.98]",
        ghost:
          "text-klipio-muted hover:text-klipio-text hover:bg-klipio-surface active:scale-[0.98]",
        link: "text-klipio-accent underline-offset-4 hover:underline",
        destructive:
          "bg-klipio-danger text-white hover:bg-klipio-danger-light active:scale-[0.98]",
        success:
          "bg-klipio-success text-white hover:bg-klipio-success-light active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-6 py-2 text-sm",
        sm: "h-9 px-4 py-2 text-xs rounded-lg",
        lg: "h-14 px-8 py-3 text-base rounded-2xl",
        xl: "h-16 px-10 py-4 text-lg rounded-2xl",
        icon: "h-11 w-11 p-0",
        "icon-sm": "h-9 w-9 p-0 rounded-lg",
        "icon-lg": "h-14 w-14 p-0 rounded-2xl",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ripple?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...(props as any)}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
