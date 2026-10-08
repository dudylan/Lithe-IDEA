// Pure scanners and candidate building for clickable source locations in
// run output, mirroring the macOS OutputTextView link grammar: Maven
// diagnostics and Java stack frames. Candidates are built without touching
// the file system — the open step tolerates a missing file — so this module
// stays synchronous and store-free.

/** Where a clickable output fragment should navigate to. One-based line. */
export interface OutputSourceTarget {
  path: string;
  line: number;
  column?: number;
}

/** A candidate hit inside one output line; offsets are within that line. */
export interface OutputLocationMatch {
  start: number;
  end: number;
  target: OutputSourceTarget;
}

/** Roots that may own a class seen in a stack frame, absolute paths. */
export interface OutputLocationContext {
  workspaceRoot: string;
  sourceRoots: string[];
}

const MAVEN_LOCATION_PATTERN = /\[(?:ERROR|WARNING)\]\s+([^\s:[\]]+):\[(\d+)(?:,(\d+))?\]/;
const STACK_LOCATION_PATTERN = /\bat\s+([\w.$]+(?:\$[\w$]+)?)\.([\w$<>]+)\(([\w$]+\.java):(\d+)\)/;

/** Conventional roots used when no project model contributes real ones. */
const FALLBACK_SOURCE_ROOTS = ["src/main/java", "src/test/java"];

function joinPath(root: string, relative: string): string {
  const cleanRoot = root.replace(/[\\/]+$/, "");
  const cleanRelative = relative.replace(/^[\\/]+/, "");
  return `${cleanRoot}/${cleanRelative}`;
}

export interface MavenLocationParts {
  relativePath: string;
  line: number;
  column?: number;
}

export interface StackLocationParts {
  className: string;
  fileName: string;
  line: number;
}

export function matchMavenLocationParts(line: string): MavenLocationParts | null {
  const match = MAVEN_LOCATION_PATTERN.exec(line);
  if (!match) return null;
  return {
    relativePath: match[1],
    line: Number(match[2]),
    column: match[3] === undefined ? undefined : Number(match[3]),
  };
}

export function matchStackLocationParts(line: string): StackLocationParts | null {
  const match = STACK_LOCATION_PATTERN.exec(line);
  if (!match) return null;
  return { className: match[1], fileName: match[3], line: Number(match[4]) };
}

/**
 * Resolves the source location a log line can navigate to. Maven diagnostics
 * resolve against the workspace root (their paths are project-relative);
 * stack frames resolve the class package under every known source root,
 * preferring declared project roots over the conventional layout. The
 * clickable fragment covers `file:line` for diagnostics and the frame
 * argument for stack lines.
 */
export function resolveOutputLocation(
  line: string,
  context: OutputLocationContext,
): OutputLocationMatch | null {
  const stack = STACK_LOCATION_PATTERN.exec(line);
  if (stack) {
    const parts = matchStackLocationParts(line);
    if (!parts) return null;
    const outerClass = parts.className.split("$")[0];
    const segments = outerClass.split(".");
    segments[segments.length - 1] = parts.fileName;
    const relative = segments.join("/");
    const roots = context.sourceRoots.length > 0
      ? context.sourceRoots
      : FALLBACK_SOURCE_ROOTS.map((root) => joinPath(context.workspaceRoot, root));
    return {
      start: stack.index,
      end: stack.index + stack[0].length,
      target: { path: joinPath(roots[0], relative), line: parts.line },
    };
  }

  const maven = MAVEN_LOCATION_PATTERN.exec(line);
  if (maven) {
    const parts = matchMavenLocationParts(line);
    if (!parts) return null;
    return {
      start: maven.index,
      end: maven.index + maven[0].length,
      target: {
        path: joinPath(context.workspaceRoot, parts.relativePath),
        line: parts.line,
        column: parts.column,
      },
    };
  }
  return null;
}
