// The board configuration the installer writes. The loop needs organizationId, boardId, token and baseUrl.

export const DEFAULT_BASE_URL = 'https://api.eventmodelers.ai';

/**
 * Completes a config for the loop: `organizationId` replaces the older `orgId` field, and `baseUrl`
 * is the override when given, else the existing value, else the hosted platform URL.
 */
export function completeConfig(config = {}, baseUrlOverride) {
  const completed = { ...config };
  if (!completed.organizationId && completed.orgId) completed.organizationId = completed.orgId;
  delete completed.orgId;
  completed.baseUrl = (baseUrlOverride || completed.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return completed;
}

/** True when completing the config changes it, so it needs to be written. */
export function needsCompletion(config = {}, baseUrlOverride) {
  return JSON.stringify(completeConfig(config, baseUrlOverride)) !== JSON.stringify(config);
}
