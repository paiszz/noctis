"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  id?: string;
  name?: string;
  value?: string; // Format: "HH:mm" (24-hour) or ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;
  variant?: "surface" | "muted";
  size?: "sm" | "md";
  align?: "left" | "right";
  minuteStep?: number; // default: 1 (allows any minute 0-59)
  minTime?: string; // "HH:mm"
  maxTime?: string; // "HH:mm"
  ariaLabel?: string;
  "aria-label"?: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimePicker({
  id: explicitId,
  name,
  value = "",
  onChange,
  placeholder = "Pilih jam...",
  disabled = false,
  clearable = true,
  className,
  triggerClassName,
  popoverClassName,
  variant = "surface",
  size = "md",
  align = "left",
  minuteStep = 1,
  minTime,
  maxTime,
  ariaLabel,
  "aria-label": ariaLabelProp,
}: TimePickerProps) {
  const generatedId = useId();
  const timePickerId = explicitId || generatedId;
  const labelText = ariaLabelProp || ariaLabel;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoursColRef = useRef<HTMLDivElement>(null);
  const minutesColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse hours and minutes from "HH:mm"
  const [valHours, valMinutes] = value && value.includes(":")
    ? value.split(":").map((v) => parseInt(v, 10))
    : [NaN, NaN];

  const selectedHour = !isNaN(valHours) ? Math.min(23, Math.max(0, valHours)) : null;
  const selectedMinute = !isNaN(valMinutes) ? Math.min(59, Math.max(0, valMinutes)) : null;

  // Generate minutes based on minuteStep (default: 1 -> 00 to 59)
  const step = Math.max(1, Math.min(30, minuteStep));
  const minutesCount = Math.floor(60 / step);
  const minutesList = Array.from({ length: minutesCount }, (_, i) => i * step);

  // Dynamic floating position calculation
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Close popover if trigger is scrolled completely out of view
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      setIsOpen(false);
      return;
    }

    const popoverWidth = 200;
    const popoverHeight = 270;

    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    // Flip upwards if space below is tight and space above has more room
    const openUpwards = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    let leftCoord =
      align === "right"
        ? Math.max(8, rect.right - popoverWidth)
        : Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8));

    if (leftCoord + popoverWidth > viewportWidth - 8) {
      leftCoord = Math.max(8, viewportWidth - popoverWidth - 8);
    }

    if (openUpwards) {
      setPopoverPosition({
        bottom: viewportHeight - rect.top + 6,
        left: leftCoord,
      });
    } else {
      setPopoverPosition({
        top: rect.bottom + 6,
        left: leftCoord,
      });
    }
  }, [align]);

  const openPopover = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  }, [disabled, updatePosition]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setPopoverPosition(null);
  }, []);

  // Auto-scroll selected hour & minute to center when opened
  useEffect(() => {
    if (!isOpen) return;

    // Delay slight tick to allow DOM mount
    const timer = setTimeout(() => {
      if (selectedHour !== null && hoursColRef.current) {
        const hourEl = hoursColRef.current.children[selectedHour] as HTMLElement;
        hourEl?.scrollIntoView({ block: "center" });
      }
      if (selectedMinute !== null && minutesColRef.current) {
        const minuteIndex = minutesList.indexOf(selectedMinute);
        if (minuteIndex >= 0) {
          const minEl = minutesColRef.current.children[minuteIndex] as HTMLElement;
          minEl?.scrollIntoView({ block: "center" });
        }
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [isOpen, selectedHour, selectedMinute]);

  // Close on click outside (checks both trigger container and portaled popover)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        closePopover();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, closePopover]);

  // Update position on scroll (capture-phase for scrolling ancestors/modals) and window resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openPopover();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        triggerRef.current?.focus();
        break;

      case "Tab":
        closePopover();
        break;
    }
  };

  const handleSelectHour = (h: number) => {
    const m = selectedMinute !== null ? selectedMinute : 0;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (minTime && timeStr < minTime) return;
    if (maxTime && timeStr > maxTime) return;
    onChange(timeStr);
  };

  const handleSelectMinute = (m: number) => {
    const h = selectedHour !== null ? selectedHour : 12;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (minTime && timeStr < minTime) return;
    if (maxTime && timeStr > maxTime) return;
    onChange(timeStr);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${h}:${m}`;
    onChange(timeStr);
    closePopover();
    triggerRef.current?.focus();
  };

  const handleClear = () => {
    onChange("");
    closePopover();
    triggerRef.current?.focus();
  };

  const variantStyles =
    variant === "muted"
      ? "bg-surface-muted border-border"
      : "bg-surface border-border/80 shadow-sm";

  const sizeStyles =
    size === "sm"
      ? "text-xs px-3 py-1.5 rounded-lg"
      : "text-xs sm:text-sm px-3.5 py-2 rounded-xl";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
      onKeyDown={handleKeyDown}
    >
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          disabled={disabled}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={timePickerId}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={labelText}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => (isOpen ? closePopover() : openPopover())}
        className={cn(
          "w-full flex items-center justify-between gap-2.5 border text-foreground text-left",
          "hover:border-primary/40 focus:outline-none focus:border-border-focus",
          "transition-all duration-150 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed hover:border-border/80",
          isOpen && "border-border-focus",
          variantStyles,
          sizeStyles,
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-muted shrink-0" />
          <span className={cn("truncate", !value && "text-muted")}>
            {value || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Kosongkan jam"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }
              }}
              className="p-0.5 rounded-full hover:bg-surface-muted text-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted shrink-0 transition-transform duration-200",
              isOpen && "rotate-180 text-foreground"
            )}
          />
        </div>
      </button>

      {/* Portaled Floating Time Picker Popover */}
      {isOpen && mounted && typeof document !== "undefined" && popoverPosition && (
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={labelText || "Pemilih jam dan menit"}
            style={{
              top: popoverPosition.top !== undefined ? `${popoverPosition.top}px` : undefined,
              bottom: popoverPosition.bottom !== undefined ? `${popoverPosition.bottom}px` : undefined,
              left: popoverPosition.left !== undefined ? `${popoverPosition.left}px` : undefined,
              width: "200px",
            }}
            className={cn(
              "fixed z-[70] select-none",
              "bg-surface border border-border/80 dark:border-border rounded-2xl",
              "shadow-dropdown p-3 focus:outline-none",
              popoverClassName
            )}
          >
            {/* Header: Column labels */}
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/70 text-xs font-semibold text-muted text-center">
              <span className="flex-1">Jam</span>
              <span className="text-muted/40 font-bold px-1">:</span>
              <span className="flex-1">Menit</span>
            </div>

            {/* Dual Scroll Columns: Hours & Minutes */}
            <div className="flex items-stretch gap-1.5 h-48">
              {/* Hours Column */}
              <div
                ref={hoursColRef}
                className="flex-1 overflow-y-auto overscroll-contain pr-0.5 space-y-1 focus:outline-none"
                role="listbox"
                aria-label="Daftar jam"
              >
                {HOURS.map((h) => {
                  const isSelected = selectedHour === h;
                  const label = String(h).padStart(2, "0");
                  return (
                    <button
                      key={h}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        "w-full h-8 text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-white font-bold shadow-sm"
                          : "text-foreground hover:bg-surface-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Column Separator */}
              <div className="w-[1px] bg-border/60 my-1 shrink-0" />

              {/* Minutes Column */}
              <div
                ref={minutesColRef}
                className="flex-1 overflow-y-auto overscroll-contain pr-0.5 space-y-1 focus:outline-none"
                role="listbox"
                aria-label="Daftar menit"
              >
                {minutesList.map((m) => {
                  const isSelected = selectedMinute === m;
                  const label = String(m).padStart(2, "0");
                  return (
                    <button
                      key={m}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        "w-full h-8 text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-white font-bold shadow-sm"
                          : "text-foreground hover:bg-surface-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/70 text-xs">
              {clearable ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-muted hover:text-danger cursor-pointer transition-colors"
                >
                  Kosongkan
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleSetNow}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                Sekarang
              </button>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}
