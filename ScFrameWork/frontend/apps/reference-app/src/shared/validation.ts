import type { z } from "zod";

export function formIssueMessages(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.join(".");
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
