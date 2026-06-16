import { cn } from "@/lib/utils";

type KlipioLogoProps = {
  size?: "sm" | "md" | "lg";
  markOnly?: boolean;
  reversed?: boolean;
  className?: string;
};

const sizes = {
  sm: {
    mark: "h-8 w-8 rounded-[10px]",
    letter: "text-2xl",
    word: "text-2xl",
  },
  md: {
    mark: "h-11 w-11 rounded-2xl",
    letter: "text-[2rem]",
    word: "text-[2rem]",
  },
  lg: {
    mark: "h-16 w-16 rounded-[1.35rem]",
    letter: "text-5xl",
    word: "text-5xl",
  },
};

export function KlipioLogo({
  size = "md",
  markOnly = false,
  reversed = false,
  className,
}: KlipioLogoProps) {
  const scale = sizes[size];

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "relative isolate flex shrink-0 items-center justify-center overflow-hidden bg-[linear-gradient(155deg,#3A2DE0_0%,#2E37E8_46%,#9B7BFF_100%)] shadow-[0_16px_40px_rgba(58,45,224,0.18)]",
          scale.mark
        )}
        aria-hidden="true"
      >
        <span className="absolute inset-x-[-18%] bottom-[-7%] h-[48%] rotate-[-6deg] rounded-[50%] bg-[#9B7BFF]/85" />
        <span className="absolute inset-x-[-12%] bottom-[28%] h-[28%] rotate-[-5deg] rounded-[50%] bg-[#F7F6FB]/12" />
        <span
          className={cn(
            "relative z-10 font-black leading-none text-white",
            scale.letter
          )}
        >
          K
        </span>
      </span>
      {!markOnly && (
        <span
          className={cn(
            "font-black leading-none tracking-normal",
            scale.word,
            reversed ? "text-white" : "text-klipio-text"
          )}
        >
          Klipio
        </span>
      )}
    </span>
  );
}
