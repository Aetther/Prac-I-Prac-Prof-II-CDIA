const ADMIN_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatAdminTimestamp(value: string): string {
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds)
    ? value
    : ADMIN_TIMESTAMP_FORMATTER.format(milliseconds);
}
