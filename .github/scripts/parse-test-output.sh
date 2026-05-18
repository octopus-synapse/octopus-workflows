#!/bin/bash
# ==============================================================================
# parse-test-output.sh - Single source of truth for Bun test output parsing
# ==============================================================================
#
# Usage:
#   source parse-test-output.sh <test-output-file>
#   echo "pass=$PASS fail=$FAIL skip=$SKIP files=$FILES"
#
# Outputs (as environment variables):
#   PASS  - Number of passed tests
#   FAIL  - Number of failed tests
#   SKIP  - Number of skipped tests
#   FILES - Number of test files
#
# Example:
#   source .github/scripts/parse-test-output.sh test-output.txt
#   [[ "$FAIL" -gt 0 ]] && exit 1
# ==============================================================================

set -euo pipefail

parse_test_output() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # P2-#60: anchor parsing to the Bun summary block instead of a free
    # `tail -20`. A test whose name happens to contain ` 12 pass` (e.g.
    # "should report 12 pass-throughs") used to poison the count when
    # the run printed it within the tail window. Locate the line that
    # carries `Ran N tests across M files.` — that's the canonical
    # marker for the summary — and read counts from the preceding
    # lines, where ` N pass / N fail / N skip` actually live.
    local summary_anchor_line
    summary_anchor_line=$(grep -nE '^Ran [0-9]+ tests across [0-9]+ files\.' "$file" | tail -1 | cut -d: -f1)

    local summary
    if [[ -n "$summary_anchor_line" ]]; then
        # Read the anchor + the 10 lines immediately before it (where
        # ` 10 pass`, ` 2 fail`, ` 1 skip` are printed).
        local start_line=$(( summary_anchor_line - 10 ))
        [[ $start_line -lt 1 ]] && start_line=1
        summary=$(sed -n "${start_line},${summary_anchor_line}p" "$file")
    else
        # Fallback for outputs without the canonical summary line
        # (interrupted runs, partial pipelines).
        summary=$(tail -20 "$file")
    fi

    # Bun format inside the summary block:
    #   "  10 pass\n   2 fail\n   1 skip\nRan 13 tests across 5 files."
    PASS=$(echo "$summary" | grep -oE '^\s*[0-9]+ pass' | grep -oE '[0-9]+' | head -1 || echo "0")
    FAIL=$(echo "$summary" | grep -oE '^\s*[0-9]+ fail' | grep -oE '[0-9]+' | head -1 || echo "0")
    SKIP=$(echo "$summary" | grep -oE '^\s*[0-9]+ skip' | grep -oE '[0-9]+' | head -1 || echo "0")
    FILES=$(echo "$summary" | grep -oE 'across [0-9]+ files' | grep -oE '[0-9]+' | head -1 || echo "?")

    # Export for use in calling script
    export PASS FAIL SKIP FILES
}

# Execute if file argument provided (allows both sourcing and direct execution)
if [[ $# -ge 1 ]]; then
    parse_test_output "$1"
    # When executed directly (not sourced), print results
    if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
        echo "pass=$PASS fail=$FAIL skip=$SKIP files=$FILES"
    fi
fi
