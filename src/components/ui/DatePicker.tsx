"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string; // Format: "YYYY-MM-DD" or ""
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
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string; // "YYYY-MM-DD"
  ariaLabel?: string;
  "aria-label"?: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left?: number;
}

const DAYS_HEADER = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// Parse YYYY-MM-DD into a local Date without timezone shifting
function parseDateString(str?: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Format local Date into YYYY-MM-DD
function formatDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DatePicker({
  id: explicitId,
  name,
  value = "",
  onChange,
  placeholder = "Pilih tanggal...",
  disabled = false,
  clearable = true,
  className,
  triggerClassName,
  popoverClassName,
  variant = "surface",
  size = "md",
  align = "left",
  minDate,
  maxDate,
  ariaLabel,
  "aria-label": ariaLabelProp,
}: DatePickerProps) {
  const generatedId = useId();
  const datePickerId = explicitId || generatedId;
  const labelText = ariaLabelProp || ariaLabel;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  // Month and year currently displayed in calendar view
  const parsedValue = parseDateString(value);
  const [viewDate, setViewDate] = useState<Date>(() => parsedValue || new Date());

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync calendar view month when value changes
  useEffect(() => {
    if (parsedValue) {
      setViewDate(parsedValue);
    }
  }, [value]);

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

    const popoverWidth = 280;
    const popoverHeight = 330;

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
    if (parsedValue) {
      setViewDate(parsedValue);
    } else {
      setViewDate(new Date());
    }
    updatePosition();
    setIsOpen(true);
  }, [disabled, parsedValue, updatePosition]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setPopoverPosition(null);
  }, []);

  // Close on click outside (checks both container and portaled popover)
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

  // Keyboard navigation on container
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

  // Calendar month grid calculation
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0: Senin, 6: Minggu
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const days: {
    date: Date;
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }[] = [];

  const todayStr = formatDateString(new Date());

  // Preceding month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
    const dStr = formatDateString(d);
    days.push({
      date: d,
      dateString: dStr,
      dayNumber: prevMonthDays - i,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isSelected: dStr === value,
      isDisabled: Boolean((minDate && dStr < minDate) || (maxDate && dStr > maxDate)),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    const dStr = formatDateString(d);
    days.push({
      date: d,
      dateString: dStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dStr === todayStr,
      isSelected: dStr === value,
      isDisabled: Boolean((minDate && dStr < minDate) || (maxDate && dStr > maxDate)),
    });
  }

  // Next month trailing days to complete full weeks (rows of 7)
  const remainingCells = 7 - (days.length % 7);
  if (remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const dStr = formatDateString(d);
      days.push({
        date: d,
        dateString: dStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
        isDisabled: Boolean((minDate && dStr < minDate) || (maxDate && dStr > maxDate)),
      });
    }
  }

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    closePopover();
    triggerRef.current?.focus();
  };

  const handleSelectToday = () => {
    if ((minDate && todayStr < minDate) || (maxDate && todayStr > maxDate)) return;
    onChange(todayStr);
    closePopover();
    triggerRef.current?.focus();
  };

  const handleClear = () => {
    onChange("");
    closePopover();
    triggerRef.current?.focus();
  };

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const displayLabel = parsedValue
    ? format(parsedValue, size === "sm" ? "dd MMM yyyy" : "dd MMMM yyyy", { locale: localeId })
    : placeholder;

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
        id={datePickerId}
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
          "hover:border-primary/40 focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus",
          "transition-all duration-150 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed hover:border-border/80",
          isOpen && "border-border-focus ring-1 ring-border-focus",
          variantStyles,
          sizeStyles,
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-muted shrink-0" />
          <span className={cn("truncate", !parsedValue && "text-muted")}>
            {displayLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Kosongkan tanggal"
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

      {/* Portaled Floating Calendar Popover */}
      {isOpen && mounted && typeof document !== "undefined" && popoverPosition && (
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={labelText || "Kalender pemilih tanggal"}
            style={{
              top: popoverPosition.top !== undefined ? `${popoverPosition.top}px` : undefined,
              bottom: popoverPosition.bottom !== undefined ? `${popoverPosition.bottom}px` : undefined,
              left: popoverPosition.left !== undefined ? `${popoverPosition.left}px` : undefined,
              width: "280px",
            }}
            className={cn(
              "fixed z-[70] select-none",
              "bg-surface border border-border/80 dark:border-border rounded-2xl",
              "shadow-dropdown p-3 focus:outline-none",
              popoverClassName
            )}
          >
            {/* Calendar Month & Year Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/70">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Bulan sebelumnya"
                className="p-1 rounded-lg hover:bg-surface-muted text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs sm:text-sm font-bold text-foreground capitalize">
                {format(viewDate, "MMMM yyyy", { locale: localeId })}
              </span>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Bulan berikutnya"
                className="p-1 rounded-lg hover:bg-surface-muted text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAYS_HEADER.map((day) => (
                <div
                  key={day}
                  className="text-[11px] font-semibold text-muted py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((d, index) => {
                return (
                  <button
                    key={`${d.dateString}-${index}`}
                    type="button"
                    disabled={d.isDisabled}
                    onClick={() => handleSelectDate(d.dateString)}
                    className={cn(
                      "h-8 text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                      !d.isCurrentMonth && "text-muted/40",
                      d.isCurrentMonth && "text-foreground hover:bg-surface-muted",
                      d.isToday && !d.isSelected && "font-bold text-primary ring-1 ring-primary/40",
                      d.isSelected && "bg-primary text-white font-bold shadow-sm hover:bg-primary/90",
                      d.isDisabled && "opacity-25 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    {d.dayNumber}
                  </button>
                );
              })}
            </div>

            {/* Calendar Footer Actions */}
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
                onClick={handleSelectToday}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                Hari Ini
              </button>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}
