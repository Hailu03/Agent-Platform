"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  animate,
} from "framer-motion";
import { cn } from "@/lib/utils";

// ----------------------------------------------------
// 1. ANIMATED SECTION (VIEWPORT SLIDE-INS & SPRING JUMPS)
// ----------------------------------------------------
type Direction = "left" | "right" | "up" | "down" | "scale" | "none";
type BounceType = "stiff" | "gentle" | "bouncy" | "smooth";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  direction?: Direction;
  delay?: number;
  duration?: number;
  bounce?: BounceType;
  id?: string;
  style?: React.CSSProperties;
}

const bounceConfigs = {
  stiff: { type: "spring" as const, stiffness: 120, damping: 20 },
  gentle: { type: "spring" as const, stiffness: 60, damping: 18 },
  bouncy: { type: "spring" as const, stiffness: 80, damping: 10 }, // Higher rebound ("nhảy bên này, nhảy bên kia")
  smooth: { type: "tween" as const, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function AnimatedSection({
  children,
  className = "",
  direction = "up",
  delay = 0,
  duration = 0.5,
  bounce = "bouncy",
  id,
  style,
}: AnimatedSectionProps) {
  const getInitialStyles = () => {
    switch (direction) {
      case "left":
        return { x: -64, opacity: 0, scale: 0.96, filter: "blur(8px)" };
      case "right":
        return { x: 64, opacity: 0, scale: 0.96, filter: "blur(8px)" };
      case "up":
        return { y: 48, opacity: 0, scale: 0.98, filter: "blur(8px)" };
      case "down":
        return { y: -48, opacity: 0, scale: 0.98, filter: "blur(8px)" };
      case "scale":
        return { scale: 0.9, opacity: 0, filter: "blur(8px)" };
      case "none":
      default:
        return { opacity: 0 };
    }
  };

  const getTransition = () => {
    const config = bounceConfigs[bounce];
    return {
      ...config,
      delay,
      duration,
    };
  };

  return (
    <motion.div
      initial={getInitialStyles()}
      whileInView={{ x: 0, y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={getTransition()}
      className={className}
      id={id}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ----------------------------------------------------
// 2. SPOTLIGHT CARD (HOVER BORDER & BG COORDINATE GLOW)
// ----------------------------------------------------
interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
    setMouseY(e.clientY - rect.top);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300",
        className
      )}
    >
      {/* Background Spotlight Glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-0"
        style={{
          background: `radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(16,185,129,0.12), transparent 85%)`,
        }}
      />
      {/* Border Spotlight Glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-1"
        style={{
          background: `radial-gradient(130px circle at ${mouseX}px ${mouseY}px, rgba(110,231,183,0.38), transparent 80%)`,
          maskImage: "linear-gradient(black, black)",
          WebkitMaskImage: "linear-gradient(black, black)",
          maskClip: "content-box",
          WebkitMaskClip: "content-box",
          padding: "1px",
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

// ----------------------------------------------------
// 3. MAGNETIC BUTTON (SPRING CURSOR ATTRACTION)
// ----------------------------------------------------
interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  pullFactor?: number;
}

export function MagneticButton({
  children,
  className = "",
  pullFactor = 0.35,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 15, stiffness: 120, mass: 0.8 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;

    // Pull coordinates
    x.set(distanceX * pullFactor);
    y.set(distanceY * pullFactor);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ----------------------------------------------------
// 4. REVEAL TEXT (WORD-BY-WORD BLUR-TO-SHARP RENDER)
// ----------------------------------------------------
interface RevealTextProps {
  text: string;
  className?: string;
  delay?: number;
  highlightWords?: string[];
  highlightClassName?: string;
}

export function RevealText({
  text,
  className = "",
  delay = 0,
  highlightWords = [],
  highlightClassName = "",
}: RevealTextProps) {
  const words = text.split(" ");

  return (
    <span className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, idx) => {
        // Strip trailing punctuation to check highlight
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        const isHighlighted = highlightWords.some(
          (h) => h.toLowerCase() === cleanWord.toLowerCase()
        );

        return (
          <span key={idx} className="overflow-hidden mr-[0.22em] inline-block py-0.5">
            <motion.span
              className={`inline-block origin-bottom ${
                isHighlighted ? highlightClassName : ""
              }`}
              initial={{ y: "85%", opacity: 0, filter: "blur(8px)" }}
              whileInView={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                delay: delay + idx * 0.045,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {word}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

// ----------------------------------------------------
// 5. METRIC COUNTER (VIEWPORT SPRING COUNT-UP)
// ----------------------------------------------------
interface MetricCounterProps {
  value: string;
  className?: string;
  delay?: number;
}

export function MetricCounter({ value, className = "", delay = 0 }: MetricCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.floor(latest));

  // Parse metric: e.g. "5 min" -> number is 5, suffix is " min"
  // E.g., "24/7" -> number is 24, suffix is "/7"
  // E.g., "20+" -> number is 20, suffix is "+"
  // E.g., "490.000" -> number is 490000, but let's keep formatting nice!
  const hasFormatting = value.includes(".");
  
  // Regex to match leading numeric part and trailing non-numeric part
  const numMatch = value.match(/^([\d.,]+)(.*)$/);
  const rawNumberStr = numMatch ? numMatch[1] : "";
  const suffix = numMatch ? numMatch[2] : "";

  // Parse float of numeric string, stripping periods if they are thousands separators,
  // or retaining them if they are decimals.
  const isThousandsDot = hasFormatting && rawNumberStr.split(".").pop()?.length === 3;
  const parsedNumber = isThousandsDot
    ? parseFloat(rawNumberStr.replace(/\./g, ""))
    : parseFloat(rawNumberStr.replace(/,/g, "")) || 0;

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, parsedNumber, {
        duration: 2.0,
        delay: delay,
        ease: [0.16, 1, 0.3, 1],
      });
      return () => controls.stop();
    }
  }, [isInView, count, parsedNumber, delay]);

  // Format the printed number
  const formatted = useTransform(rounded, (latest) => {
    if (isThousandsDot) {
      // Re-add dots as thousands separators
      return latest.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    return latest.toString();
  });

  return (
    <span ref={ref} className={className}>
      <motion.span>{formatted}</motion.span>
      {suffix}
    </span>
  );
}

// ----------------------------------------------------
// 6. TILT CARD (3D TACTILE PERSPECTIVE ROTATION)
// ----------------------------------------------------
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxRotate?: number;
}

export function TiltCard({ children, className = "", maxRotate = 8 }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 22, stiffness: 140, mass: 0.8 };
  const rotateX = useSpring(y, springConfig);
  const rotateY = useSpring(x, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Mouse coords relative to center of element
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Normalize and convert to degrees
    const rX = -(mouseY / (height / 2)) * maxRotate;
    const rY = (mouseX / (width / 2)) * maxRotate;

    x.set(rY);
    y.set(rX);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`perspective-1000 ${className}`}
    >
      {children}
    </motion.div>
  );
}
