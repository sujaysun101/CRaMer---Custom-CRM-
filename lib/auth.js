// SHA-256 hex of the access password. Set CRM_PASSWORD_HASH in the environment
// (.env.local locally, project env vars on Easel). Never commit it.
// If unset, the app fails closed: every request is rejected.
export const PW_HASH = process.env.CRM_PASSWORD_HASH || null;
