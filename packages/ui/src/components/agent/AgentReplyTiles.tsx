'use client';

/**
 * Renders agent assistant replies as tiles with clear structure (headings, lists, bold).
 * Uses a lightweight built-in renderer so no extra dependency is required.
 */

import React from 'react';
import { TileSectionIcon, TileListIcon, TileParagraphIcon } from '../icons/PortalIcons';

export interface AgentReplyTilesProps {
  text: string;
  className?: string;
}

/** Convert LaTeX-style formulas to plain text (UI does not render LaTeX). */
function plainTextFormula(raw: string): string {
  return raw
    .replace(/\\\[[\s\S]*?\\\]/g, (m) => {
      const inner = m.slice(2, -2).replace(/\\text\{([^}]*)\}/g, '$1').replace(/\s+/g, ' ').trim();
      return inner || m;
    })
    .replace(/\\\([\s\S]*?\\\)/g, (m) => {
      const inner = m.slice(2, -2).replace(/\\text\{([^}]*)\}/g, '$1').replace(/\s+/g, ' ').trim();
      return inner || m;
    })
    .replace(/\\text\{([^}]*)\}/g, '$1');
}

/** Split text into blocks: by double newline, and by lines that start with ###. */
function splitIntoBlocks(text: string): string[] {
  if (!text?.trim()) return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const parts: string[] = [];
  let current = '';
  for (const line of normalized.split('\n')) {
    const isHeader = /^#{1,3}\s+/.test(line.trim());
    if (isHeader && current.trim()) {
      parts.push(current.trim());
      current = line + '\n';
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) parts.push(current.trim());
  if (parts.length <= 1) {
    const byDouble = normalized.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    return byDouble.length > 0 ? byDouble : [normalized];
  }
  return parts;
}

/** Render **bold** and inline `code` in a string. */
function renderInlineFormatting(str: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let remaining = str;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    let match: RegExpMatchArray | null = null;
    let type: 'bold' | 'code' | null = null;
    if (boldMatch && (!codeMatch || (boldMatch.index ?? 0) <= (codeMatch.index ?? 0))) {
      match = boldMatch;
      type = 'bold';
    } else if (codeMatch) {
      match = codeMatch;
      type = 'code';
    }
    if (match && type) {
      const idx = match.index!;
      if (idx > 0) segments.push(<React.Fragment key={key++}>{remaining.slice(0, idx)}</React.Fragment>);
      if (type === 'bold') segments.push(<strong key={key++} className="font-semibold text-surface-900">{match[1]}</strong>);
      else segments.push(<code key={key++} className="bg-surface-100 px-1.5 py-0.5 rounded text-sm font-medium text-surface-800">{match[1]}</code>);
      remaining = remaining.slice(idx + match[0].length);
    } else {
      segments.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }
  }
  return segments.length === 1 ? segments[0] : <>{segments}</>;
}

/** Render a single block: headings, paragraphs, bullet lists. */
function renderBlock(block: string): React.ReactNode {
  const lines = block.split('\n').filter((l) => l.trim() !== '');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^###\s+/.test(trimmed)) {
      nodes.push(<h3 key={i} className="text-sm font-semibold text-surface-800 mt-2 mb-1 first:mt-0">{renderInlineFormatting(trimmed.replace(/^###\s+/, ''))}</h3>);
      i += 1;
    } else if (/^##\s+/.test(trimmed)) {
      nodes.push(<h2 key={i} className="text-base font-semibold text-surface-900 mt-3 mb-1.5 first:mt-0">{renderInlineFormatting(trimmed.replace(/^##\s+/, ''))}</h2>);
      i += 1;
    } else if (/^#\s+/.test(trimmed)) {
      nodes.push(<h1 key={i} className="text-lg font-semibold text-surface-900 mt-0 mb-2">{renderInlineFormatting(trimmed.replace(/^#\s+/, ''))}</h1>);
      i += 1;
    } else if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (/^[-*•]\s+/.test(lines[i].trim()) || /^\d+[.)]\s+/.test(lines[i].trim()))) {
        const bullet = lines[i].trim().replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
        if (bullet) listItems.push(<li key={i} className="flex gap-2 text-sm text-surface-800"><span className="text-brand-500 font-medium flex-shrink-0">•</span><span className="min-w-0">{renderInlineFormatting(bullet)}</span></li>);
        i += 1;
      }
      nodes.push(<ul key={`ul-${i}`} className="list-none space-y-1.5 my-2 pl-0">{listItems}</ul>);
    } else if (/^\d+\.?\s*$/.test(trimmed)) {
      // Consecutive lines that are just numbers (e.g. "1" or "2.") — coalesce into one compact list to avoid 22 separate paragraph tiles
      const numberLines: string[] = [];
      while (i < lines.length && /^\d+\.?\s*$/.test(lines[i].trim())) {
        numberLines.push(lines[i].trim());
        i += 1;
      }
      if (numberLines.length > 1) {
        nodes.push(
          <p key={`num-${i}`} className="text-sm text-surface-500 my-2">
            {numberLines.join(', ')}
          </p>
        );
      } else {
        nodes.push(<p key={i} className="text-sm text-surface-800 mb-2 last:mb-0 leading-relaxed">{renderInlineFormatting(trimmed)}</p>);
      }
    } else {
      nodes.push(<p key={i} className="text-sm text-surface-800 mb-2 last:mb-0 leading-relaxed">{renderInlineFormatting(trimmed)}</p>);
      i += 1;
    }
  }
  return <>{nodes}</>;
}

/** Infer tile type from block content for icon. */
function getTileIcon(block: string): 'section' | 'list' | 'paragraph' {
  const firstLine = block.split('\n')[0]?.trim() ?? '';
  if (/^#{1,3}\s+/.test(firstLine)) return 'section';
  if (/^[-*•]\s+/.test(firstLine) || /^\d+[.)]\s+/.test(firstLine)) return 'list';
  return 'paragraph';
}

export function AgentReplyTiles({ text, className = '' }: AgentReplyTilesProps) {
  const normalized = plainTextFormula(text || '');
  let blocks = splitIntoBlocks(normalized);
  // If no blocks but we have any text, treat entire string as one block so we never show a blank/placeholder
  if (blocks.length === 0 && normalized.trim()) {
    blocks = [normalized.trim()];
  }
  // Final guard: still no blocks (e.g. empty string) — render raw text as one paragraph so parent never gets null
  if (blocks.length === 0) {
    return text?.trim() ? (
      <div className={`space-y-3 ${className}`}>
        <div className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4">
            <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{text.trim()}</p>
          </div>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, idx) => {
        const tileType = getTileIcon(block);
        const Icon = tileType === 'section' ? TileSectionIcon : tileType === 'list' ? TileListIcon : TileParagraphIcon;
        return (
          <div
            key={idx}
            className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-4 flex gap-3">
              <Icon className="flex-shrink-0 mt-0.5" />
              <div className="prose prose-sm max-w-none text-surface-800 min-w-0 flex-1">
                {renderBlock(block)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AgentReplyTiles;
