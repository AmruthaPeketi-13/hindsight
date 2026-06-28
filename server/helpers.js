// ─── helpers.js ───────────────────────────────────────────────────────────────
// Pure utility functions used by server.js
// No dependencies on memory, router, or analytics modules.

function detectCategory(msg) {
  if (/vpn|printer|outlook|laptop|wifi|network|password|access|sharepoint|teams|monitor|keyboard|mouse|driver|bluetooth|usb|crash|blue.?screen/i.test(msg)) return 'IT';
  if (/leave|salary|hr|payroll|onboard|benefits|policy|appraisal|resignation|joining|offer.?letter|pf|provident/i.test(msg)) return 'HR';
  if (/outage|down|production|deploy|server|api|crash|error 5|incident|alert|pagerduty|rollback|hotfix/i.test(msg)) return 'Incident';
  if (/project|sprint|deadline|milestone|task|ticket|jira|standup|backlog|story|epic|release/i.test(msg)) return 'Project';
  return 'General';
}

function detectSeverity(msg) {
  if (/urgent|critical|down|outage|production|blocked|cannot|crash|emergency|immediately|asap/i.test(msg)) return 'high';
  if (/issue|problem|not working|error|fail|broken|stuck|slow|delay/i.test(msg)) return 'medium';
  return 'low';
}

function extractTags(msg) {
  const STOP = new Set([
    'that','this','with','have','from','they','will','been','when','what',
    'your','also','into','just','then','than','some','even','most','such',
    'take','well','much','over','back','only','come','more','about','after',
    'again','because','does','each','help','need','want','like','make',
  ]);
  const words = msg.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  return [...new Set(words.filter(w => !STOP.has(w)))].slice(0, 8);
}

module.exports = { detectCategory, detectSeverity, extractTags };
