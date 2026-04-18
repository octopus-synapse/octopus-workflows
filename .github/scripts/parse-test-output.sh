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

    # Extract last 20 lines where summary typically appears
    local summary
    summary=$(tail -20 "$file")

    # Parse metrics using consistent patterns
    # Bun format: " 10 pass" " 2 fail" " 1 skip" "across 5 files"
    PASS=$(echo "$summary" | grep -oE ' [0-9]+ pass' | grep -oE '[0-9]+' | head -1 || echo "0")
    FAIL=$(echo "$summary" | grep -oE ' [0-9]+ fail' | grep -oE '[0-9]+' | head -1 || echo "0")
    SKIP=$(echo "$summary" | grep -oE ' [0-9]+ skip' | grep -oE '[0-9]+' | head -1 || echo "0")
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
