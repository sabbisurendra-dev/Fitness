"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface PlainYmd {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const CALENDAR_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function parseIsoDate(iso: string): PlainYmd {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
    };
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

export function formatIsoDate(ymd: PlainYmd): string {
  const y = String(ymd.year).padStart(4, "0");
  const m = String(ymd.month).padStart(2, "0");
  const d = String(ymd.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(iso: string, daysDelta: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const utc = new Date(Date.UTC(year, month - 1, day + daysDelta));
  return formatIsoDate({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getWeekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatTriggerLabel(selectedDate: string, todayStr: string): string {
  const { year, month, day } = parseIsoDate(selectedDate);
  const monthLabel = SHORT_MONTH_NAMES[month - 1] || "";
  if (selectedDate === todayStr) {
    return `Today · ${monthLabel} ${day}`;
  }
  const yesterdayStr = shiftIsoDate(todayStr, -1);
  if (selectedDate === yesterdayStr) {
    return `Yesterday · ${monthLabel} ${day}`;
  }
  const weekday = SHORT_WEEKDAYS[getWeekday(year, month, day)] || "";
  return `${weekday}, ${monthLabel} ${day}`;
}

interface DatePickerDialogProps {
  selectedDate: string;
  todayStr: string;
  loggedDates: Set<string>;
  onSelectDate: (isoDate: string) => void;
  onShiftDate: (daysDelta: number) => void;
}

export function DatePickerDialog({
  selectedDate,
  todayStr,
  loggedDates,
  onSelectDate,
  onShiftDate,
}: DatePickerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedYmd = useMemo(() => parseIsoDate(selectedDate), [selectedDate]);
  const [viewYear, setViewYear] = useState(selectedYmd.year);
  const [viewMonth, setViewMonth] = useState(selectedYmd.month);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  const yesterdayStr = useMemo(() => shiftIsoDate(todayStr, -1), [todayStr]);
  const isToday = selectedDate === todayStr;

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen && !dlg.open) {
      dlg.showModal();
      requestAnimationFrame(() => {
        const selectedBtn = dlg.querySelector<HTMLButtonElement>(
          `button[data-iso-date="${selectedDate}"]`
        );
        selectedBtn?.focus();
      });
    } else if (!isOpen && dlg.open) {
      dlg.close();
    }
  }, [isOpen, selectedDate]);

  const openCalendar = () => {
    const parsed = parseIsoDate(selectedDate);
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    setIsOpen(true);
  };

  const closeCalendar = () => {
    setIsOpen(false);
  };

  const chooseDate = (iso: string) => {
    onSelectDate(iso);
    setIsOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const utc = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(utc.getUTCFullYear());
    setViewMonth(utc.getUTCMonth() + 1);
  };

  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    iso: string
  ) => {
    let deltaDays = 0;
    if (e.key === "ArrowLeft") deltaDays = -1;
    else if (e.key === "ArrowRight") deltaDays = 1;
    else if (e.key === "ArrowUp") deltaDays = -7;
    else if (e.key === "ArrowDown") deltaDays = 7;
    else if (e.key === "PageUp") {
      e.preventDefault();
      shiftMonth(-1);
      return;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      shiftMonth(1);
      return;
    } else {
      return;
    }

    e.preventDefault();
    const targetIso = shiftIsoDate(iso, deltaDays);
    const parsed = parseIsoDate(targetIso);
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    requestAnimationFrame(() => {
      const targetBtn = dialogRef.current?.querySelector<HTMLButtonElement>(
        `button[data-iso-date="${targetIso}"]`
      );
      targetBtn?.focus();
    });
  };

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dlg = dialogRef.current;
    if (!dlg) return false;
    const rect = dlg.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstWeekday = getWeekday(viewYear, viewMonth, 1);

  const calendarCells = useMemo(() => {
    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    const prevMonthUtc = new Date(Date.UTC(viewYear, viewMonth - 2, 1));
    const prevYear = prevMonthUtc.getUTCFullYear();
    const prevMonth = prevMonthUtc.getUTCMonth() + 1;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({
        iso: formatIsoDate({ year: prevYear, month: prevMonth, day: d }),
        day: d,
        inCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        iso: formatIsoDate({ year: viewYear, month: viewMonth, day: d }),
        day: d,
        inCurrentMonth: true,
      });
    }

    const nextMonthUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    const nextYear = nextMonthUtc.getUTCFullYear();
    const nextMonth = nextMonthUtc.getUTCMonth() + 1;
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailing = 7 - remainder;
      for (let d = 1; d <= trailing; d++) {
        cells.push({
          iso: formatIsoDate({ year: nextYear, month: nextMonth, day: d }),
          day: d,
          inCurrentMonth: false,
        });
      }
    }

    return cells;
  }, [daysInMonth, firstWeekday, viewMonth, viewYear]);

  const loggedCountThisMonth = useMemo(() => {
    const prefix = `${String(viewYear).padStart(4, "0")}-${String(viewMonth).padStart(2, "0")}-`;
    let count = 0;
    for (const d of loggedDates) {
      if (d.startsWith(prefix)) count += 1;
    }
    return count;
  }, [loggedDates, viewMonth, viewYear]);

  const todayYmd = parseIsoDate(todayStr);
  const isViewingDifferentMonthOrDay =
    !isToday || viewYear !== todayYmd.year || viewMonth !== todayYmd.month;
  const monthName = MONTH_NAMES[viewMonth - 1] || "";

  return (
    <>
      <div
        className={`inline-flex items-center rounded-xl border min-h-[40px] px-0.5 transition ${
          isToday
            ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            : "border-amber-500/45 bg-amber-500/10"
        }`}
      >
        <button
          type="button"
          onClick={() => onShiftDate(-1)}
          aria-label="Previous Day"
          className="flex h-9 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={openCalendar}
          aria-label={`Open calendar date picker (current: ${selectedDate})`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold whitespace-nowrap hover:bg-[var(--bg-surface)] transition ${
            isToday ? "text-[var(--text-primary)]" : "text-amber-400"
          }`}
        >
          <Calendar
            className={`h-3.5 w-3.5 shrink-0 ${
              isToday ? "text-emerald-400" : "text-amber-400"
            }`}
            aria-hidden="true"
          />
          <span>{formatTriggerLabel(selectedDate, todayStr)}</span>
        </button>

        <button
          type="button"
          onClick={() => onShiftDate(1)}
          aria-label="Next Day"
          className="flex h-9 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="calendar-picker-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => {
          if (dialogRef.current) {
            dialogRef.current.returnValue = "";
          }
          setIsOpen(false);
        }}
        onPointerDown={(e) => {
          if (!("closedBy" in HTMLDialogElement.prototype)) {
            pressedOutsideRef.current = isOutsideDialog(e);
          }
        }}
        onPointerUp={(e) => {
          if (
            !("closedBy" in HTMLDialogElement.prototype) &&
            pressedOutsideRef.current &&
            isOutsideDialog(e)
          ) {
            closeCalendar();
          }
          pressedOutsideRef.current = false;
        }}
        className="calendar-picker-dialog shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 id="calendar-picker-title" className="text-sm font-bold truncate">
              Select Date
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => chooseDate(todayStr)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedDate === todayStr
                  ? "bg-emerald-500 text-slate-950"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-emerald-500/50"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => chooseDate(yesterdayStr)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedDate === yesterdayStr
                  ? "bg-amber-500 text-slate-950"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-emerald-500/40"
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={closeCalendar}
              aria-label="Close calendar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous Month"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-emerald-500/45 transition"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="text-sm font-bold tracking-tight">
              {monthName} {viewYear}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next Month"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-emerald-500/45 transition"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div
            role="grid"
            aria-label={`${monthName} ${viewYear}`}
            className="space-y-1"
          >
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--text-muted)]">
              {CALENDAR_HEADERS.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => {
                const isSelectedCell = cell.iso === selectedDate;
                const isTodayCell = cell.iso === todayStr;
                const hasLog = loggedDates.has(cell.iso);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    data-iso-date={cell.iso}
                    aria-label={`${cell.iso}${isTodayCell ? ", Today" : ""}${
                      hasLog ? ", has logged activity" : ""
                    }`}
                    aria-pressed={isSelectedCell}
                    autoFocus={isOpen && isSelectedCell}
                    onClick={() => chooseDate(cell.iso)}
                    onKeyDown={(e) => handleGridKeyDown(e, cell.iso)}
                    className={`relative flex min-h-[42px] flex-col items-center justify-center rounded-xl text-xs font-semibold tabular-nums transition ${
                      isSelectedCell
                        ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                        : isTodayCell
                        ? "border border-emerald-500/70 bg-emerald-500/10 text-emerald-400 font-bold"
                        : cell.inCurrentMonth
                        ? "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                        : "text-[var(--text-muted)]/45 hover:bg-[var(--bg-elevated)]/60"
                    }`}
                  >
                    <span>{cell.day}</span>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        hasLog
                          ? isSelectedCell
                            ? "bg-slate-950"
                            : "bg-emerald-400"
                          : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
            <span>
              Logged <strong className="text-[var(--text-primary)]">{loggedCountThisMonth}</strong>{" "}
              {loggedCountThisMonth === 1 ? "day" : "days"} in {SHORT_MONTH_NAMES[viewMonth - 1]}
            </span>
          </div>
          {isViewingDifferentMonthOrDay && (
            <button
              type="button"
              onClick={() => chooseDate(todayStr)}
              className="font-bold text-emerald-400 hover:underline"
            >
              Jump to Today
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
