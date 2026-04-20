/**
 * Domain: Changelog
 *
 * Pure functions for generating release changelogs.
 * Supports hierarchical grouping: patch → minor → major
 */

export type PullRequest = {
  number: number;
  title: string;
  mergedAt: string; // ISO 8601 date
};

export type Tag = {
  name: string;
  date: string; // ISO 8601 date
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions (extracted from formatMajorChangelog)
// ═══════════════════════════════════════════════════════════════════════════

function filterPRsByDateRange(
  prs: PullRequest[],
  startDate: string,
  endDate: string,
): PullRequest[] {
  return prs.filter((pr) => pr.mergedAt > startDate && pr.mergedAt <= endDate);
}

function formatPRList(prs: PullRequest[]): string[] {
  return prs.map((pr) => `- ${pr.title} #${pr.number}`);
}

function appendPRSection(lines: string[], title: string, prs: PullRequest[]): void {
  if (prs.length === 0) return;
  lines.push(`#### ${title}`);
  lines.push(...formatPRList(prs));
  lines.push('');
}

function parseTagVersion(tagName: string): [number, number, number] {
  const version = tagName.replace('v', '');
  const parts = version.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function findPatchesForMinor(patchTags: Tag[], majorNum: number, minorNum: number): Tag[] {
  return patchTags.filter((t) => {
    const [tMajor, tMinor] = parseTagVersion(t.name);
    return tMajor === majorNum && tMinor === minorNum;
  });
}

/**
 * Formats a simple changelog for PATCH releases.
 * Flat list of PRs merged since the last tagged release.
 *
 * When `baseDate` is provided, only PRs merged strictly AFTER it are
 * included — this is the behavior callers want 99% of the time because
 * `gather-changelog-data` ships every merged PR on main + homolog (no
 * date filter upstream), so without this guard every patch release
 * regurgitates the entire history. `baseDate` is optional only so the
 * older test fixtures that call `formatPatchChangelog(prs)` directly
 * keep working.
 */
export function formatPatchChangelog(prs: PullRequest[], baseDate?: string): string {
  const lines: string[] = ['### Changes', ''];
  const relevantPRs = baseDate ? prs.filter((pr) => pr.mergedAt > baseDate) : prs;

  for (const pr of relevantPRs) {
    lines.push(`- ${pr.title} #${pr.number}`);
  }

  return lines.join('\n');
}

/**
 * Formats changelog for MINOR releases.
 * Groups PRs by patch releases since last minor.
 */
export function formatMinorChangelog(
  prs: PullRequest[],
  patchTags: Tag[],
  baseDate: string,
  nextVersion: string,
): string {
  const lines: string[] = ['### Changes since last minor release', ''];

  let prevDate = baseDate;

  // Group by existing patch tags
  for (const tag of patchTags) {
    const sectionPRs = prs.filter((pr) => pr.mergedAt > prevDate && pr.mergedAt <= tag.date);

    if (sectionPRs.length > 0) {
      lines.push(`#### ${tag.name}`);
      for (const pr of sectionPRs) {
        lines.push(`- ${pr.title} #${pr.number}`);
      }
      lines.push('');
    }

    prevDate = tag.date;
  }

  // PRs after last tag (current release)
  const currentPRs = prs.filter((pr) => pr.mergedAt > prevDate);

  if (currentPRs.length > 0) {
    lines.push(`#### ${nextVersion}`);
    for (const pr of currentPRs) {
      lines.push(`- ${pr.title} #${pr.number}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Processes initial v0.0.x patches before first minor release.
 * Returns the updated prevDate.
 */
function processInitialPatches(
  lines: string[],
  prs: PullRequest[],
  patchTags: Tag[],
  firstMinor: Tag | undefined,
  baseDate: string,
): string {
  const initialPatches = patchTags.filter((t) => t.name.startsWith('v0.0.'));

  if (initialPatches.length === 0 || !firstMinor) {
    return baseDate;
  }

  lines.push(`### ${firstMinor.name}`, '');
  let prevDate = baseDate;

  for (const patchTag of initialPatches) {
    const sectionPRs = filterPRsByDateRange(prs, prevDate, patchTag.date);
    appendPRSection(lines, patchTag.name, sectionPRs);
    prevDate = patchTag.date;
  }

  const directPRs = filterPRsByDateRange(prs, prevDate, firstMinor.date);
  appendPRSection(lines, 'Direct commits', directPRs);

  return firstMinor.date;
}

/**
 * Processes a single minor release with its associated patches.
 * Returns the updated prevDate.
 */
function processMinorRelease(
  lines: string[],
  prs: PullRequest[],
  minorTag: Tag,
  patchTags: Tag[],
  prevDate: string,
): string {
  const [majorNum, minorNum] = parseTagVersion(minorTag.name);

  lines.push(`### ${minorTag.name}`, '');

  // Process patches from previous minor line (e.g., v1.1.x for v1.2.0)
  const prevMinorNum = minorNum - 1;
  let currentPrevDate = prevDate;

  if (prevMinorNum >= 0) {
    const prevLinePatches = findPatchesForMinor(patchTags, majorNum, prevMinorNum);

    for (const patchTag of prevLinePatches) {
      const sectionPRs = filterPRsByDateRange(prs, currentPrevDate, patchTag.date);
      appendPRSection(lines, patchTag.name, sectionPRs);
      currentPrevDate = patchTag.date;
    }
  }

  const directPRs = filterPRsByDateRange(prs, currentPrevDate, minorTag.date);
  appendPRSection(lines, 'Direct commits', directPRs);

  return minorTag.date;
}

/**
 * Formats changelog for MAJOR releases.
 * Groups by minor releases, then by patch releases within each minor.
 */
export function formatMajorChangelog(
  prs: PullRequest[],
  minorTags: Tag[],
  patchTags: Tag[],
  baseDate: string,
  nextVersion: string,
): string {
  const lines: string[] = ['### Changes since last major release', ''];

  // Phase 1: Process initial v0.0.x patches
  let prevDate = processInitialPatches(lines, prs, patchTags, minorTags[0], baseDate);

  // Phase 2: Process remaining minor releases
  const remainingMinors = minorTags[0] ? minorTags.slice(1) : minorTags;

  for (const minorTag of remainingMinors) {
    prevDate = processMinorRelease(lines, prs, minorTag, patchTags, prevDate);
  }

  // Phase 3: Unreleased PRs (current release)
  const currentPRs = prs.filter((pr) => pr.mergedAt > prevDate);

  if (currentPRs.length > 0) {
    lines.push(`### ${nextVersion}`);
    lines.push(...formatPRList(currentPRs));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats the changelog footer with compare link.
 */
export function formatChangelogFooter(
  repository: string,
  baseTag: string | null,
  nextTag: string,
): string {
  const compareBase = baseTag ?? 'v0.0.0';
  return `
---

**Full Changelog**: https://github.com/${repository}/compare/${compareBase}...${nextTag}
`;
}
