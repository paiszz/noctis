"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown, X, Check } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  id?: string;
  name?: string;
  value?: string; // Format: "YYYY-MM-DDTHH:mm" or ""
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
  minDateTime?: string; // "YYYY-MM-DDTHH:mm"
  maxDateTime?: string; // "YYYY-MM-DDTHH:mm"
  ariaLabel?: string;
  "aria-label"?: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left?: number;
}

const DAYS_HEADER = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parseDateString(str?: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function splitDateTime(val?: string): [string, string] {
  if (!val || !val.includes("T")) return ["", ""];
  const [d, t] = val.split("T");
  return [d || "", t ? t.slice(0, 5) : ""];
}

export function DateTimePicker({
  id: explicitId,
  name,
  value = "",
  onChange,
  placeholder = "Pilih tanggal & waktu...",
  disabled = false,
  clearable = true,
  className,
  triggerClassName,
  popoverClassName,
  variant = "surface",
  size = "md",
  align = "left",
  minDateTime,
  maxDateTime,
  ariaLabel,
  "aria-label": ariaLabelProp,
}: DateTimePickerProps) {
  const generatedId = useId();
  const dateTimePickerId = explicitId || generatedId;
  const labelText = ariaLabelProp || ariaLabel;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  // Tab for small mobile screens: "date" or "time"
  const [activeTab, setActiveTab] = useState<"date" | "time">("date");

  // Decompose current value
  const [currentDate, currentTime] = splitDateTime(value);
  const parsedDate = parseDateString(currentDate);

  // Month view state for calendar navigation
  const [viewDate, setViewDate] = useState<Date>(() => parsedDate || new Date());

  // Parse hour & minute
  const [valHours, valMinutes] = currentTime
    ? currentTime.split(":").map((v) => parseInt(v, 10))
    : [NaN, NaN];

  const selectedHour = !isNaN(valHours) ? Math.min(23, Math.max(0, valHours)) : null;
  const selectedMinute = !isNaN(valMinutes) ? Math.min(59, Math.max(0, valMinutes)) : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoursColRef = useRef<HTMLDivElement>(null);
  const minutesColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync calendar view month when date value changes
  useEffect(() => {
    if (parsedDate) {
      setViewDate(parsedDate);
    }
  }, [currentDate]);

  // Calculate dynamic floating position based on trigger and viewport
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

    const isMobile = viewportWidth < 640;
    const popoverWidth = isMobile ? 290 : 430;
    const popoverHeight = 350;

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
    if (parsedDate) {
      setViewDate(parsedDate);
    } else {
      setViewDate(new Date());
    }
    setActiveTab("date");
    updatePosition();
    setIsOpen(true);
  }, [disabled, parsedDate, updatePosition]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setPopoverPosition(null);
  }, []);

  // Auto-scroll selected hour & minute to center when opened
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (selectedHour !== null && hoursColRef.current) {
        const hourEl = hoursColRef.current.children[selectedHour] as HTMLElement;
        hourEl?.scrollIntoView({ block: "center" });
      }
      if (selectedMinute !== null && minutesColRef.current) {
        const minEl = minutesColRef.current.children[selectedMinute] as HTMLElement;
        minEl?.scrollIntoView({ block: "center" });
      }
    }, 15);

    return () => clearTimeout(timer);
  }, [isOpen, selectedHour, selectedMinute, activeTab]);

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

  // ── Handlers for Date & Time selection ──

  const handleSelectDate = (newDateStr: string) => {
    const time = currentTime || "09:00";
    const combined = `${newDateStr}T${time}`;
    if (minDateTime && combined < minDateTime) return;
    if (maxDateTime && combined > maxDateTime) return;
    onChange(combined);
  };

  const handleSelectHour = (h: number) => {
    const date = currentDate || formatDateString(new Date());
    const m = selectedMinute !== null ? selectedMinute : 0;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const combined = `${date}T${timeStr}`;
    if (minDateTime && combined < minDateTime) return;
    if (maxDateTime && combined > maxDateTime) return;
    onChange(combined);
  };

  const handleSelectMinute = (m: number) => {
    const date = currentDate || formatDateString(new Date());
    const h = selectedHour !== null ? selectedHour : 12;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const combined = `${date}T${timeStr}`;
    if (minDateTime && combined < minDateTime) return;
    if (maxDateTime && combined > maxDateTime) return;
    onChange(combined);
  };

  const handleSetNow = () => {
    const now = new Date();
    const dateStr = formatDateString(now);
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const combined = `${dateStr}T${timeStr}`;
    onChange(combined);
  };

  const handleClear = () => {
    onChange("");
    closePopover();
    triggerRef.current?.focus();
  };

  // ── Calendar month grid calculation ──

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0: Senin, 6: Minggu
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const days: {
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
      dateString: dStr,
      dayNumber: prevMonthDays - i,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isSelected: dStr === currentDate,
      isDisabled: Boolean(
        (minDateTime && dStr < minDateTime.split("T")[0]) ||
        (maxDateTime && dStr > maxDateTime.split("T")[0])
      ),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    const dStr = formatDateString(d);
    days.push({
      dateString: dStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dStr === todayStr,
      isSelected: dStr === currentDate,
      isDisabled: Boolean(
        (minDateTime && dStr < minDateTime.split("T")[0]) ||
        (maxDateTime && dStr > maxDateTime.split("T")[0])
      ),
    });
  }

  // Next month trailing days
  const remainingCells = 7 - (days.length % 7);
  if (remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const dStr = formatDateString(d);
      days.push({
        dateString: dStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === currentDate,
        isDisabled: Boolean(
          (minDateTime && dStr < minDateTime.split("T")[0]) ||
          (maxDateTime && dStr > maxDateTime.split("T")[0])
        ),
      });
    }
  }

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Formatted trigger label (e.g. "24 Okt 2026, 14:30")
  let displayLabel = placeholder;
  if (parsedDate && currentTime) {
    const formattedDate = format(parsedDate, "dd MMM yyyy", { locale: localeId });
    displayLabel = `${formattedDate}, ${currentTime}`;
  } else if (parsedDate) {
    displayLabel = format(parsedDate, "dd MMM yyyy", { locale: localeId });
  }

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
        id={dateTimePickerId}
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
          <Calendar className="w-4 h-4 text-muted shrink-0" />
          <span className={cn("truncate", !value && "text-muted")}>
            {displayLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Kosongkan tanggal dan waktu"
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

      {/* Portaled Floating Unified Popover */}
      {isOpen && mounted && typeof document !== "undefined" && popoverPosition && (
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={labelText || "Pemilih tanggal dan waktu"}
            style={{
              top: popoverPosition.top !== undefined ? `${popoverPosition.top}px` : undefined,
              bottom: popoverPosition.bottom !== undefined ? `${popoverPosition.bottom}px` : undefined,
              left: popoverPosition.left !== undefined ? `${popoverPosition.left}px` : undefined,
            }}
            className={cn(
              "fixed z-[70] select-none",
              "w-[290px] sm:w-[430px]",
              "bg-surface border border-border/80 dark:border-border rounded-2xl",
              "shadow-dropdown p-3 focus:outline-none",
              popoverClassName
            )}
          >
            {/* Mobile Tab Switcher (< 640px) */}
            <div className="flex sm:hidden items-center bg-surface-muted p-1 rounded-xl mb-3 border border-border/80">
              <button
                type="button"
                onClick={() => setActiveTab("date")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  activeTab === "date"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Tanggal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("time")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  activeTab === "time"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Waktu</span>
              </button>
            </div>

            {/* Content: Side-by-side on sm:, Tabbed on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {/* Left Column: Calendar (always visible on sm, tabbed on mobile) */}
              <div
                className={cn(
                  "w-full sm:w-[260px] sm:block shrink-0",
                  activeTab === "date" ? "block" : "hidden sm:block"
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
                          "h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer relative",
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
              </div>

              {/* Vertical Divider on Desktop */}
              <div className="hidden sm:block w-[1px] bg-border/60 my-1 shrink-0" />

              {/* Right Column: Time Picker (always visible on sm, tabbed on mobile) */}
              <div
                className={cn(
                  "w-full sm:w-[130px] sm:block shrink-0 flex flex-col",
                  activeTab === "time" ? "block" : "hidden sm:block"
                )}
              >
                {/* Header: Column labels */}
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/70 text-xs font-semibold text-muted text-center">
                  <span className="flex-1">Jam</span>
                  <span className="text-muted/40 font-bold px-0.5">:</span>
                  <span className="flex-1">Menit</span>
                </div>

                {/* Dual Scroll Columns: Hours & Minutes */}
                <div className="flex items-stretch gap-1 h-48">
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
                            "w-full h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer",
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
                    {MINUTES.map((m) => {
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
                            "w-full h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer",
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
              </div>
            </div>

            {/* Unified Popover Footer Actions */}
            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/70 text-xs">
              <div>
                {clearable ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-muted hover:text-danger cursor-pointer transition-colors"
                  >
                    Kosongkan
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                >
                  Sekarang
                </button>
                <button
                  type="button"
                  onClick={closePopover}
                  className="px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Selesai</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}
