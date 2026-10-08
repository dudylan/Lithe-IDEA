import { useMemo, useRef, type KeyboardEvent } from "react";
import { renderRunOutput, type OutputLocationResolver } from "../utils/run-output-style";
import type { OutputSourceTarget } from "../utils/run-output-locations";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/ui/context-menu";
import { cn } from "@/utils/cn";

export function RunOutputText({
  source,
  emptyLabel,
  title,
  wrapLines = true,
  wrapLabel,
  onToggleWrapLines,
  resolveLocation,
  onOpenLocation,
}: {
  source: string;
  emptyLabel: string;
  title: string;
  /** Wrap output to the pane width; off keeps every line on one row with
   *  horizontal scrolling, matching the Git Console soft-wrap toggle. */
  wrapLines?: boolean;
  /** Label for the context-menu entry; the menu only appears when a toggle
   *  callback is provided, so store-less consumers stay unchanged. */
  wrapLabel?: string;
  onToggleWrapLines?: () => void;
  /** Maps a log line to a clickable source target; null when it has none. */
  resolveLocation?: OutputLocationResolver;
  onOpenLocation?: (target: OutputSourceTarget) => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const spans = useMemo(
    () => renderRunOutput(source, resolveLocation),
    [source, resolveLocation],
  );

  const outputClassName = wrapLines
    ? "whitespace-pre-wrap"
    : "w-max min-w-full whitespace-pre";

  const selectAll = () => {
    const node = preRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") return;
    event.preventDefault();
    event.stopPropagation();
    selectAll();
  };

  const content = (
    <>
      <div className="mb-1 font-medium text-subtle-foreground ui-text-sm">{title}</div>
      {source ? (
        <pre
          ref={preRef}
          className={cn(
            "cursor-text font-mono text-[12px] text-foreground select-text *:select-text [font-variant-ligatures:none]",
            outputClassName,
          )}
        >
          {spans.map((span, index) =>
            span.location && onOpenLocation ? (
              <span
                key={index}
                role="link"
                tabIndex={0}
                className={cn("cursor-pointer", span.className)}
                style={span.style}
                title={`${span.location.path}:${span.location.line}`}
                onClick={() => onOpenLocation(span.location!)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onOpenLocation(span.location!);
                }}
              >
                {span.text}
              </span>
            ) : (
              <span key={index} className={span.className} style={span.style}>
                {span.text}
              </span>
            ),
          )}
        </pre>
      ) : (
        <pre
          className={cn(
            "cursor-text font-mono text-[12px] text-foreground select-text [font-variant-ligatures:none]",
            outputClassName,
          )}
        >
          {emptyLabel}
        </pre>
      )}
    </>
  );

  if (!onToggleWrapLines) {
    return (
      <div tabIndex={0} className="outline-none" onKeyDown={handleKeyDown}>
        {content}
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        tabIndex={0}
        className="outline-none"
        onKeyDown={handleKeyDown}
        aria-label={title}
      >
        {content}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuCheckboxItem
          checked={wrapLines}
          onCheckedChange={() => onToggleWrapLines()}
        >
          {wrapLabel}
        </ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
