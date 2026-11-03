import { useCallback, type RefObject } from 'react';
import type FullCalendar from '@fullcalendar/react';

const LINE_PX = 56;
const PAGE_RATIO = 0.85;

/** Setas e PageUp/PageDown rolam a grade da visão ativa quando o calendário tem foco. */
export function useCalendarKeyboardScroll(calendarRef: RefObject<FullCalendar | null>) {
  return useCallback(
    (event: React.KeyboardEvent) => {
      const root = (calendarRef.current?.getApi() as { el?: HTMLElement } | undefined)?.el;
      const scroller = root?.querySelector('.fc-view-harness-active .fc-scroller') as HTMLElement | null | undefined;
      const page = scroller ? scroller.clientHeight * PAGE_RATIO : 0;
      const deltas: Record<string, number> = {
        ArrowDown: LINE_PX,
        ArrowUp: -LINE_PX,
        PageDown: page,
        PageUp: -page,
      };
      if (!(event.key in deltas)) return;
      if (scroller) scroller.scrollTop += deltas[event.key];
      event.preventDefault();
    },
    [calendarRef],
  );
}
