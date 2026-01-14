import geoip from 'geoip-lite';

/**
 * Detect timezone from IP address using geoip-lite
 * @param {string} ip - IP address
 * @returns {string} IANA timezone name (e.g., 'Asia/Kolkata')
 */
export const detectTimezoneFromIp = (ip) => {
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return 'Asia/Kolkata'; // Default for local development
  }
  
  const geo = geoip.lookup(ip);
  return geo ? geo.timezone : 'UTC';
};

/**
 * Format a date to user's local timezone string
 * @param {Date|string|number} date - Date to format
 * @param {string} timezone - Target timezone (default: UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatToLocal = (date, timezone = 'UTC', options = {}) => {
  if (!date) return null;
  const d = new Date(date);
  
  const defaultOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch (error) {
    console.error('Timezone formatting error:', error);
    return d.toISOString(); // Fallback to UTC ISO string
  }
};

/**
 * Get relative time in user's timezone
 * (e.g., "Today at 5:00 PM")
 */
export const getRelativeLocalTime = (date, timezone = 'UTC') => {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  
  // Format dates for comparison in target timezone
  const dateStr = formatToLocal(d, timezone, { year: 'numeric', month: 'numeric', day: 'numeric' });
  const nowStr = formatToLocal(now, timezone, { year: 'numeric', month: 'numeric', day: 'numeric' });
  
  const timeStr = formatToLocal(d, timezone, { hour: '2-digit', minute: '2-digit', hour12: true });

  if (dateStr === nowStr) {
    return `Today at ${timeStr}`;
  }
  
  // You can extend this for "Yesterday", etc.
  return `${dateStr} at ${timeStr}`;
};

/**
 * Get UTC start and end of day for a specific timezone
 * @param {string} timezone - IANA timezone
 * @param {Date} date - Basis date (default now)
 * @returns {Object} { start, end } as UTC dates
 */
export const getLocalDayRange = (timezone = 'UTC', date = new Date()) => {
  // Use Intl to get the year, month, day in the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date);
  
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  
  // Construct local start (00:00:00) and end (23:59:59) in that timezone
  // This is a bit tricky with raw Intl.
  // A better way is construct a string and parse it.
  const dateISO = `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`;
  
  // Create Date objects representing the boundaries
  // We use the timezone offset to get the exact UTC time
  const start = new Date(`${dateISO}T00:00:00Z`);
  const end = new Date(`${dateISO}T23:59:59.999Z`);
  
  // Adjust for timezone offset
  // We can find the offset by comparing local and UTC strings
  const getOffset = (tz, d) => {
    const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone: tz }));
    return utcDate.getTime() - tzDate.getTime();
  };

  const offset = getOffset(timezone, start);
  
  return {
    start: new Date(start.getTime() + offset),
    end: new Date(end.getTime() + offset)
  };
};
