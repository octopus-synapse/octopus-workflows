#!/bin/bash
# ==============================================================================
# generate-summary.sh - Standardized GitHub Step Summary generator
# ==============================================================================
#
# Usage:
#   generate-summary.sh <status> <name> <pass> <fail> <skip> <duration> [output-file]
#
# Arguments:
#   status      - "success" or "failure"
#   name        - Test suite name (e.g., "Integration Tests")
#   pass        - Number of passed tests
#   fail        - Number of failed tests
#   skip        - Number of skipped tests
#   duration    - Duration in seconds
#   output-file - Optional path to test output for failure context
#
# Environment:
#   GITHUB_STEP_SUMMARY - GitHub Actions summary file (required)
#
# Example:
#   .github/scripts/generate-summary.sh success "E2E Tests" 42 0 2 125
#   .github/scripts/generate-summary.sh failure "Integration" 38 4 0 90 test-output.txt
# ==============================================================================

set -euo pipefail

generate_summary() {
    local status="$1"
    local name="$2"
    local pass="$3"
    local fail="$4"
    local skip="$5"
    local duration="$6"
    local output_file="${7:-}"

    # Validate GITHUB_STEP_SUMMARY exists (for local testing, use temp file)
    local summary_file="${GITHUB_STEP_SUMMARY:-/tmp/github-step-summary.md}"

    # Header with status emoji
    if [[ "$status" == "success" ]]; then
        echo "## ✅ $name Passed" >> "$summary_file"
    else
        echo "## ❌ $name Failed" >> "$summary_file"
    fi
    echo "" >> "$summary_file"

    # Metrics table
    echo "| Metric | Value |" >> "$summary_file"
    echo "|--------|-------|" >> "$summary_file"
    echo "| Passed | $pass |" >> "$summary_file"
    echo "| Failed | $fail |" >> "$summary_file"
    echo "| Skipped | $skip |" >> "$summary_file"
    echo "| Duration | ${duration}s |" >> "$summary_file"
    echo "" >> "$summary_file"

    # Show first failures if available
    if [[ "$fail" -gt 0 && -n "$output_file" && -f "$output_file" ]]; then
        echo "### First Failures" >> "$summary_file"
        echo '```' >> "$summary_file"
        # Extract lines with test failures (✗ marker in Bun output)
        grep -A2 "✗" "$output_file" 2>/dev/null | head -15 >> "$summary_file" || echo "No failure details available" >> "$summary_file"
        echo '```' >> "$summary_file"
        echo "" >> "$summary_file"
    fi
}

# Execute with provided arguments
if [[ $# -ge 6 ]]; then
    generate_summary "$@"
else
    echo "Usage: generate-summary.sh <status> <name> <pass> <fail> <skip> <duration> [output-file]" >&2
    exit 1
fi
