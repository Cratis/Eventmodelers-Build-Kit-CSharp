// Permissions for an unattended Claude turn.
// Edits are accepted inside the project only (acceptEdits), and only the commands below may run.
// Anything else is refused by Claude Code, and the build prompt reports it as a blocked slice.

export const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'MultiEdit',
  'Glob',
  'Grep',
  'LS',
  'TodoWrite',
  'Skill',
  'mcp__eventmodelers',
  'Bash(dotnet build:*)',
  'Bash(dotnet test:*)',
  'Bash(dotnet restore:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git checkout:*)',
  'Bash(git switch:*)',
  'Bash(git branch:*)',
  'Bash(git merge --ff-only:*)',
  'Bash(git pull --ff-only:*)',
  'Bash(git rev-parse:*)',
  'Bash(yarn install:*)',
  'Bash(yarn build:*)',
  'Bash(yarn lint:*)',
  'Bash(yarn test:*)',
  'Bash(curl:*)',
];

const BYPASS = /dangerously|bypassPermissions/i;

function splitList(value) {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * The tools a turn may use: the defaults plus `allowedTools` from the kit config and the
 * comma-separated `RALPH_ALLOWED_TOOLS` environment variable.
 */
export function allowedTools(cfg = {}, env = process.env) {
  const extra = [...(Array.isArray(cfg.allowedTools) ? cfg.allowedTools : []), ...splitList(env.RALPH_ALLOWED_TOOLS)];
  const refused = extra.filter((tool) => BYPASS.test(tool));
  if (refused.length > 0) throw new Error(`Refusing allow-list entries that bypass permission checks: ${refused.join(', ')}`);
  return [...new Set([...DEFAULT_ALLOWED_TOOLS, ...extra])];
}

/** Arguments for `claude`: print mode, prompt on stdin, edits limited to the project, explicit allow list. */
export function claudeArgs(cfg = {}, env = process.env) {
  return ['-p', '--permission-mode', 'acceptEdits', '--allowedTools', ...allowedTools(cfg, env)];
}
