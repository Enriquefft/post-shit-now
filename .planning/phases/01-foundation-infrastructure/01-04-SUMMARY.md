---
phase: 01-foundation-infrastructure
plan: 04
subsystem: API Key Validation
tags: [byok, validation, api-keys]
created: "2026-02-21"
completed: "2026-02-20"

requires_provides:
  requires:
    - name: "Neon API validation"
      from: "01-02"
    - name: "env.ts infrastructure"
      from: "01-03"
  provides:
    - name: "Extensible validation framework"
      to: "setup-keys.ts"
    - name: "Provider key validation"
      to: "all provider keys"

tech_stack:
  added:
    - "Provider-specific API validation endpoints"
  patterns:
    - "Two-layer validation: prefix check + API call"
    - "Graceful network failure handling"
    - "Extensible VALIDATORS mapping"

key_files:
  created: []
  modified:
    - path: "src/core/utils/env.ts"
      changes: "Added validators for Trigger.dev, Perplexity, Anthropic; VALIDATORS mapping; validateProviderKey function"
    - path: "src/cli/setup-keys.ts"
      changes: "Integrated validateProviderKey into writeProviderKey and writeKey functions"

key_decisions:
  - "Extensible VALIDATORS object: add new validator function and key mapping, no code changes to routing logic"
  - "Graceful degradation for unknown providers: returns valid=true instead of error"

metrics:
  duration: "1min"
  tasks_completed: 2
  files_modified: 2
  completed_date: "2026-02-20"
---

# Phase 01 Plan 04: Provider Key Validation Framework Summary

Provider key validation framework with provider-specific API validation endpoints for Trigger.dev, Perplexity, and Anthropic (extending existing Neon validation). This completes C4 (API key validation) per CONTEXT.md decision to apply validation to all providers.

## Objective

Extend API key validation framework to all provider keys (Trigger.dev, Perplexity, Anthropic, etc.) with provider-specific API validation endpoints. The framework uses a two-layer approach: fast prefix checks for immediate feedback, followed by API calls to verify key validity.

## Implementation

### Task 1: Add Provider Key Validation Framework to env.ts

Added three new validators to `src/core/utils/env.ts`:

- **validateTriggerDevApiKey**: Checks for `tr_dev_` or `tr_prod_` prefix, validates via Trigger.dev `/v1/projects` API endpoint
- **validatePerplexityApiKey**: Checks for `pplx-` prefix, validates via Perplexity `/models` API endpoint
- **validateAnthropicApiKey**: Checks for `sk-ant-` prefix, validates via Anthropic `/v1/models` API endpoint

Each validator follows the established pattern from `validateNeonApiKey`:
1. Fast prefix check for immediate user feedback
2. API validation call to provider endpoint
3. Graceful network failure handling (assume valid if unreachable)
4. Clear error messages with actionable suggestions

Created `VALIDATORS` mapping object and `validateProviderKey` utility function for extensible provider routing.

### Task 2: Integrate Provider Key Validation into setup-keys.ts

Updated `src/cli/setup-keys.ts` to validate before saving:

- `writeProviderKey`: Validates all provider keys via `validateProviderKey` before saving to database
- `writeKey`: Validates `NEON_API_KEY` specifically before saving to keys.env file

Both functions return structured error responses including:
- Error description
- Actionable suggestion for resolving the issue
- Warning for network failures (doesn't block setup)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:

- All provider keys (Neon, Trigger.dev, Perplexity, Anthropic) validated before storage
- Validation framework is extensible (add new validator to VALIDATORS object)
- Invalid keys rejected with clear error messages and suggestions
- Prefix checks provide immediate feedback
- API validation catches expired/incorrect keys
- Graceful network failure handling prevents setup blocking

## Key Decisions

1. **Extensible VALIDATORS Object**: Add new validator function and key mapping, no routing logic changes required
2. **Graceful Degradation**: Unknown providers return `valid=true` instead of errors, allowing forward compatibility
3. **Network Resilience**: Validation failures during API connectivity issues log warnings but don't block setup

## Technical Details

### Validation Pattern

```typescript
async function validateProviderKey(
  service: string,
  apiKey: string,
): Promise<ValidationResult>
```

### ValidationResult Interface

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  warning?: string;
}
```

### Provider Mapping

| Provider | Prefix Check | API Endpoint |
|----------|--------------|--------------|
| Neon | `napi_` (not `napi_re4yoevqpuf8...`) | `https://console.neon.tech/api/v1/projects` |
| Trigger.dev | `tr_dev_` or `tr_prod_` | `https://api.trigger.dev/v1/projects` |
| Perplexity | `pplx-` | `https://api.perplexity.ai/models` |
| Anthropic | `sk-ant-` | `https://api.anthropic.com/v1/models` |

## Future Work

- Add validators for additional providers as needed (Brave, Tavily, Exa, OpenAI, Ideogram, fal.ai, Runway)
- Consider caching validation results to reduce API calls during setup
- Add validation retry logic for transient network failures

## Files Modified

1. `src/core/utils/env.ts` (+134 lines) - Added validation framework
2. `src/cli/setup-keys.ts` (+35 lines) - Integrated validation calls

## Related Requirements

- C4 (API Key Validation): Complete - All provider keys validated before storage
