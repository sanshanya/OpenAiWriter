import { diff_match_patch, DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from "diff-match-patch";
import { type Path, type Point, type Range, RangeApi, TextApi, type TText } from "platejs";
import type { PlateEditor } from "platejs/react";

export type DiffTuple = [number, string];

export interface PreviewInput {
  docVersion: number;
  selection: Range;
  snapshot: string;
  replacement: string;
  diffs?: DiffTuple[];
}

type PreviewRange = Range & {
  ai_preview_delete?: boolean;
  ai_preview_insert_before?: boolean;
  ai_preview_insert_text?: string;
};

type FlattenedCell = {
  path: Path;
  text: string;
  start: number;
  end: number;
  offset: number;
};

type DecorationsMap = Map<string, PreviewRange[]>;

const previewCache = new Map<string, DecorationsMap>();
const dmp = new diff_match_patch();
dmp.Diff_Timeout = 0;

export function stableKey(input: Pick<PreviewInput, "docVersion" | "snapshot" | "replacement">) {
  return [
    input.docVersion,
    input.snapshot.length,
    input.replacement.length,
    input.snapshot,
    input.replacement,
  ].join("|");
}

export function computePreviewDecorations(editor: PlateEditor, input: PreviewInput) {
  const key = stableKey(input);
  const cached = previewCache.get(key);
  if (cached) {
    return cached;
  }

  const cells = flattenSelection(editor, input.selection);
  if (cells.length === 0) {
    const empty = new Map<string, PreviewRange[]>();
    previewCache.set(key, empty);
    return empty;
  }

  const diffs = resolveDiffs(input);
  const decorations = projectDiffsOntoCells(cells, diffs);

  previewCache.set(key, decorations);
  return decorations;
}

export function clearPreviewCache() {
  previewCache.clear();
}

function resolveDiffs(input: PreviewInput): DiffTuple[] {
  if (input.diffs) {
    return input.diffs;
  }

  if (!input.snapshot && !input.replacement) {
    return [];
  }

  const result = dmp.diff_main(input.snapshot, input.replacement);
  dmp.diff_cleanupEfficiency(result);
  return result as DiffTuple[];
}

function flattenSelection(editor: PlateEditor, selection: Range): FlattenedCell[] {
  const cells: FlattenedCell[] = [];
  let cursor = 0;

  const textEntries = editor.api.nodes<TText>({
    at: selection,
    match: TextApi.isText,
  });

  for (const [node, path] of textEntries) {
    const nodeRange = editor.api.range(path);
    if (!nodeRange) continue;
    const overlap = RangeApi.intersection(nodeRange, selection);
    if (!overlap) continue;

    const [startPoint, endPoint] = RangeApi.edges(overlap);
    const relativeStart = startPoint.offset;
    const relativeEnd = endPoint.offset;
    const sliceLength = Math.max(0, relativeEnd - relativeStart);
    const slice = sliceLength > 0 ? node.text.slice(relativeStart, relativeEnd) : "";

    cells.push({
      path,
      text: slice,
      start: cursor,
      end: cursor + sliceLength,
      offset: relativeStart,
    });

    cursor += sliceLength;
  }

  return cells;
}

function projectDiffsOntoCells(cells: FlattenedCell[], diffs: DiffTuple[]): DecorationsMap {
  const decorations: DecorationsMap = new Map();
  let originalPos = 0;

  for (const [operation, chunk] of diffs) {
    if (!chunk) continue;

    switch (operation) {
      case DIFF_INSERT: {
        insertDecoration(cells, decorations, originalPos, chunk);
        break;
      }
      case DIFF_DELETE: {
        sliceDecoration(cells, decorations, originalPos, originalPos + chunk.length, true);
        originalPos += chunk.length;
        break;
      }
      case DIFF_EQUAL: {
        originalPos += chunk.length;
        break;
      }
      default:
        break;
    }
  }

  return decorations;
}

function insertDecoration(
  cells: FlattenedCell[],
  decorations: DecorationsMap,
  position: number,
  text: string,
) {
  if (!text) return;
  const cell = findCellByPosition(cells, position);
  if (!cell) return;

  const anchorOffset = cell.offset + Math.max(0, position - cell.start);
  const anchor: Point = { path: cell.path, offset: anchorOffset };
  const focus: Point = { ...anchor };
  const range: PreviewRange = {
    anchor,
    focus,
    ai_preview_insert_before: true,
    ai_preview_insert_text: text,
  };

  pushDecoration(decorations, cell.path, range);
}

function sliceDecoration(
  cells: FlattenedCell[],
  decorations: DecorationsMap,
  start: number,
  end: number,
  markDelete: boolean,
) {
  if (start >= end) return;

  for (const cell of cells) {
    if (cell.end <= start) continue;
    if (cell.start >= end) break;

    const intersectionStart = Math.max(cell.start, start);
    const intersectionEnd = Math.min(cell.end, end);
    if (intersectionEnd <= intersectionStart) continue;

    const anchorOffset = cell.offset + (intersectionStart - cell.start);
    const focusOffset = cell.offset + (intersectionEnd - cell.start);
    const anchor: Point = { path: cell.path, offset: anchorOffset };
    const focus: Point = { path: cell.path, offset: focusOffset };
    const range: PreviewRange = {
      anchor,
      focus,
      ai_preview_delete: markDelete || undefined,
    };

    pushDecoration(decorations, cell.path, range);
  }
}

function findCellByPosition(cells: FlattenedCell[], position: number) {
  if (cells.length === 0) return null;

  for (const cell of cells) {
    if (position >= cell.start && position < cell.end) {
      return cell;
    }
  }

  const last = cells[cells.length - 1];
  if (last && position === last.end) {
    return last;
  }

  return null;
}

function pushDecoration(map: DecorationsMap, path: Path, range: PreviewRange) {
  const key = JSON.stringify(path);
  const current = map.get(key);
  if (current) {
    current.push(range);
    return;
  }
  map.set(key, [range]);
}
