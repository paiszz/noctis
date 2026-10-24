"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string> {
  id?: string;
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[] | SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;
  variant?: "surface" | "muted";
  size?: "sm" | "md";
  align?: "left" | "right";
  ariaLabel?: string;
  "aria-label"?: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  maxHeight: number;
}

export function Select<T extends string | number = string>({
  id: explicitId,
  name,
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  disabled = false,
  className,
  triggerClassName,
  popoverClassName,
  variant = "surface",
  size = "md",
  align = "left",
  ariaLabel,
  "aria-label": ariaLabelProp,
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const listboxId = `${selectId}-listbox`;
  const labelText = ariaLabelProp || ariaLabel;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate dynamic floating position based on trigger and viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // If trigger is scrolled out of viewport, close dropdown
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    // Flip upwards if space below is tight (< 220px) and space above has more room
    const openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = openUpwards ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(280, Math.max(120, availableSpace - 6));

    const minWidth = Math.min(rect.width, viewportWidth - 16);

    let left: number | undefined = undefined;
    let right: number | undefined = undefined;

    if (align === "right") {
      right = Math.max(8, viewportWidth - rect.right);
    } else {
      let leftCoord = Math.max(8, rect.left);
      if (leftCoord + minWidth > viewportWidth - 8) {
        leftCoord = Math.max(8, viewportWidth - minWidth - 8);
      }
      left = leftCoord;
    }

    if (openUpwards) {
      setDropdownPosition({
        bottom: viewportHeight - rect.top + 6,
        left,
        right,
        minWidth,
        maxHeight,
      });
    } else {
      setDropdownPosition({
        top: rect.bottom + 6,
        left,
        right,
        minWidth,
        maxHeight,
      });
    }
  }, [align]);

  // Sync highlightedIndex when dropdown opens
  const openDropdown = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
      setHighlightedIndex(selectedIndex);
    } else {
      const firstValid = options.findIndex((opt) => !opt.disabled);
      setHighlightedIndex(firstValid >= 0 ? firstValid : -1);
    }
  }, [disabled, selectedIndex, options, updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    setDropdownPosition(null);
  }, []);

  const selectOption = useCallback(
    (index: number) => {
      if (index < 0 || index >= options.length) return;
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      closeDropdown();
      triggerRef.current?.focus();
    },
    [options, onChange, closeDropdown]
  );

  // Close on click outside (checks both trigger container and portaled listbox)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listboxRef.current &&
        !listboxRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) return;
    const item = listboxRef.current.children[highlightedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex]);

  // Update position on scroll (capture phase catches any scrolling ancestor/modal) and window resize
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
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        closeDropdown();
        triggerRef.current?.focus();
        break;

      case "Tab":
        closeDropdown();
        break;

      case "ArrowDown": {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        while (nextIndex < options.length && options[nextIndex]?.disabled) {
          nextIndex++;
        }
        if (nextIndex < options.length) {
          setHighlightedIndex(nextIndex);
        }
        break;
      }

      case "ArrowUp": {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        while (prevIndex >= 0 && options[prevIndex]?.disabled) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          setHighlightedIndex(prevIndex);
        }
        break;
      }

      case "Home": {
        e.preventDefault();
        const firstValid = options.findIndex((opt) => !opt.disabled);
        if (firstValid >= 0) setHighlightedIndex(firstValid);
        break;
      }

      case "End": {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i].disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
        break;
      }

      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          selectOption(highlightedIndex);
        }
        break;
    }
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
      {/* Hidden input for form submission compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={String(value)}
          disabled={disabled}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={labelText}
        aria-disabled={disabled}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
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
        <span className={cn("truncate", !selectedOption && "text-muted")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Dropdown Popover Listbox (Portaled to document.body for unconstrained floating) */}
      {isOpen && mounted && typeof document !== "undefined" && dropdownPosition && (
        createPortal(
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={labelText}
            style={{
              top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : undefined,
              bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : undefined,
              left: dropdownPosition.left !== undefined ? `${dropdownPosition.left}px` : undefined,
              right: dropdownPosition.right !== undefined ? `${dropdownPosition.right}px` : undefined,
              minWidth: `${dropdownPosition.minWidth}px`,
              maxHeight: `${dropdownPosition.maxHeight}px`,
            }}
            className={cn(
              "fixed z-[70] w-max max-w-[calc(100vw-1rem)]",
              "bg-surface border border-border/80 dark:border-border rounded-xl",
              "shadow-dropdown p-1 overflow-y-auto overscroll-contain",
              "focus:outline-none",
              popoverClassName
            )}
            onKeyDown={handleKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={String(option.value)}
                  id={`${selectId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onClick={() => selectOption(index)}
                  onMouseEnter={() => {
                    if (!option.disabled) setHighlightedIndex(index);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm rounded-lg",
                    "transition-colors select-none",
                    option.disabled
                      ? "opacity-40 cursor-not-allowed text-muted"
                      : "cursor-pointer text-foreground",
                    !option.disabled && isHighlighted && !isSelected && "bg-surface-muted",
                    isSelected && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )
      )}
    </div>
  );
}
