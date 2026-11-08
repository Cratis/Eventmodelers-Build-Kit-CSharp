// Builds what is written to Claude's stdin for one turn.
// Only ids go into the prompt — the board token reaches the tools through the environment.

/** The connection header for a turn: board, organization and base URL, never the token. */
export function turnHeader(cfg = {}) {
  if (!cfg.boardId) return '';
  const fields = [`board=${cfg.boardId}`];
  if (cfg.organizationId) fields.push(`org=${cfg.organizationId}`);
  if (cfg.baseUrl) fields.push(`baseUrl=${cfg.baseUrl}`);
  return `${fields.join(' ')}\n\n`;
}

/** The full input for a turn. */
export function turnInput(cfg, prompt) {
  return turnHeader(cfg) + prompt;
}
