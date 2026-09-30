/*
 * Holdfast settings for this deployment.
 * Fill in the two Supabase values to turn on sync between devices (see README, "Turning on sync").
 * The publishable key is designed to be public; Row Level Security in supabase/setup.sql keeps each account's data private.
 */
window.REEF_CONFIG = {
  supabaseUrl: "",   // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: "",   // the Publishable key, starts with "sb_publishable_"
  feedbackUrl: "",   // optional: a Google Form or other link for feedback; blank uses GitHub Issues
  feedbackNote: ""   // optional: the line shown under the feedback button, e.g. "Opens a short Google Form."
};
