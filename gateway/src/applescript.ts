import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAppleScript(to: string, body: string) {
  const escapedTo = escapeAppleScriptString(to);
  const escapedBody = escapeAppleScriptString(body);

  return `
tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${escapedTo}" of targetService
  send "${escapedBody}" to targetBuddy
end tell
`.trim();
}

async function sendIMessage(to: string, body: string) {
  const script = buildAppleScript(to, body);
  await execFileAsync("osascript", ["-e", script]);
}

export { buildAppleScript, sendIMessage };
