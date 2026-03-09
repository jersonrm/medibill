import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://a088802db65084950599ef916f9e0f65@o4511016097546240.ingest.us.sentry.io/4511016105410560",
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
