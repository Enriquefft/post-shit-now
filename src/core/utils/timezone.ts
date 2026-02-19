/**
 * Timezone conversion utilities.
 *
 * Uses the built-in Intl API for timezone operations.
 * No external dependencies required.
 *
 * All times are stored as UTC internally. User's configured timezone
 * is used for display and input interpretation.
 */

/**
 * Check if a timezone string is a valid IANA timezone identifier.
 *
 * @param tz - Timezone string to validate (e.g., "America/New_York", "UTC")
 * @returns true if valid IANA timezone, false otherwise
 */
export function isValidTimezone(tz: string): boolean {
	if (!tz) return false;
	try {
		Intl.DateTimeFormat(undefined, { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

/**
 * Convert a user's local date/time to a UTC Date.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM format
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date object in UTC
 * @throws Error if timezone, date, or time format is invalid
 */
export function userTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
	if (!isValidTimezone(timezone)) {
		throw new Error(`Invalid timezone: ${timezone}`);
	}

	if (!DATE_REGEX.test(dateStr)) {
		throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
	}

	if (!TIME_REGEX.test(timeStr)) {
		throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
	}

	// Parse the date/time components
	const [year = 0, month = 0, day = 0] = dateStr.split("-").map(Number);
	const [hours = 0, minutes = 0] = timeStr.split(":").map(Number);

	// Validate ranges
	if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
		throw new Error(`Invalid date/time values: ${dateStr} ${timeStr}`);
	}

	// Strategy: Create a UTC date, then calculate the offset for the target timezone
	// and adjust accordingly.
	//
	// We use Intl.DateTimeFormat to find the offset of the target timezone at the
	// given date/time, then subtract that offset to get UTC.

	// First, create a reference UTC date for the given date/time values
	const referenceUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

	// Get the offset of the timezone at this approximate time
	const offsetMinutes = getTimezoneOffset(referenceUtc, timezone);

	// The user's local time = UTC + offset, so UTC = local - offset
	const utcMs = referenceUtc.getTime() - offsetMinutes * 60 * 1000;
	const result = new Date(utcMs);

	// Verify the offset didn't change (DST edge case near transitions)
	const verifyOffset = getTimezoneOffset(result, timezone);
	if (verifyOffset !== offsetMinutes) {
		// Recalculate with the corrected offset
		const correctedMs = referenceUtc.getTime() - verifyOffset * 60 * 1000;
		return new Date(correctedMs);
	}

	return result;
}

/**
 * Convert a UTC Date to the user's local date/time.
 *
 * @param utcDate - Date object (interpreted as UTC)
 * @param timezone - IANA timezone string
 * @returns Object with date (YYYY-MM-DD), time (HH:MM), and full string
 */
export function utcToUserTime(
	utcDate: Date,
	timezone: string,
): { date: string; time: string; full: string } {
	if (!isValidTimezone(timezone)) {
		throw new Error(`Invalid timezone: ${timezone}`);
	}

	// Use Intl to format in the target timezone
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZoneName: "short",
	});

	const parts = formatter.formatToParts(utcDate);
	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((p) => p.type === type)?.value ?? "";

	const year = get("year");
	const month = get("month");
	const day = get("day");
	let hour = get("hour");
	const minute = get("minute");
	const tzAbbrev = get("timeZoneName");

	// Some locales format midnight as "24" instead of "00"
	if (hour === "24") hour = "00";

	const date = `${year}-${month}-${day}`;
	const time = `${hour}:${minute}`;
	const full = `${date} ${time} ${tzAbbrev}`;

	return { date, time, full };
}

/**
 * Get the UTC offset in minutes for a timezone at a given instant.
 * Positive = east of UTC, negative = west of UTC.
 */
function getTimezoneOffset(date: Date, timezone: string): number {
	// Format the date in both UTC and target timezone, then compute difference
	const utcParts = new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const localParts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const toDate = (parts: Intl.DateTimeFormatPart[]): Date => {
		const get = (type: Intl.DateTimeFormatPartTypes): number => {
			let val = parts.find((p) => p.type === type)?.value ?? "0";
			if (type === "hour" && val === "24") val = "0";
			return Number.parseInt(val, 10);
		};
		return new Date(
			Date.UTC(
				get("year"),
				get("month") - 1,
				get("day"),
				get("hour"),
				get("minute"),
				get("second"),
			),
		);
	};

	const utcTime = toDate(utcParts);
	const localTime = toDate(localParts);

	return (localTime.getTime() - utcTime.getTime()) / (60 * 1000);
}
