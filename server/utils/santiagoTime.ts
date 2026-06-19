const TZ = 'America/Santiago';

export interface SantiagoParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dateKey: string;
  timeKey: string;
}

function getParts(date: Date): SantiagoParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  let hour = Number(get('hour'));
  const minute = Number(get('minute'));
  if (hour === 24) hour = 0;

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[get('weekday')] ?? 0;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeKey: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function getSantiagoNow(): SantiagoParts {
  return getParts(new Date());
}

export function getSantiagoPartsFromIso(iso: string): SantiagoParts {
  return getParts(new Date(iso));
}

/** Convierte "HH:mm" o "HH:mm:ss" a minutos del día */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ¿Está la hora actual dentro de la ventana del cron (±toleranceMin)? */
export function isTimeInPublishWindow(
  now: SantiagoParts,
  publishTime: string,
  toleranceMin = 5,
): boolean {
  const nowMin = now.hour * 60 + now.minute;
  const targetMin = parseTimeToMinutes(publishTime);
  return nowMin >= targetMin && nowMin < targetMin + toleranceMin;
}

export function isDayScheduled(daysOfWeek: number[], dayOfWeek: number): boolean {
  return daysOfWeek.includes(dayOfWeek);
}

/** Evita republicar la misma plantilla el mismo día (permite varias plantillas/horas distintas) */
export function alreadyPublishedToday(lastPublishedAt: string | null, now: SantiagoParts): boolean {
  if (!lastPublishedAt) return false;
  const last = getSantiagoPartsFromIso(lastPublishedAt);
  return last.dateKey === now.dateKey;
}
