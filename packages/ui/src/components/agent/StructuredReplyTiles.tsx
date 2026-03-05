'use client';

/**
 * HMS-style structured reply tiles: render pre-parsed section/list tiles from the API.
 * Used when the agent returns structured tiles (e.g. get_market_intel_factors) so we never depend on markdown parsing.
 */

import React from 'react';
import { TileSectionIcon, TileListIcon } from '../icons/PortalIcons';

export interface ReplyTile {
  type: 'section' | 'list';
  title?: string;
  body?: string;
  items?: string[];
}

export interface StructuredReplyTilesProps {
  tiles: ReplyTile[];
  className?: string;
}

export function StructuredReplyTiles({ tiles, className = '' }: StructuredReplyTilesProps) {
  if (!tiles?.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {tiles.map((tile, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-4 flex gap-3">
            {tile.type === 'section' ? (
              <TileSectionIcon className="flex-shrink-0 mt-0.5 w-4 h-4 text-brand-500" />
            ) : (
              <TileListIcon className="flex-shrink-0 mt-0.5 w-4 h-4 text-brand-500" />
            )}
            <div className="prose prose-sm max-w-none text-surface-800 min-w-0 flex-1">
              {tile.title && (
                <h2 className="text-base font-semibold text-surface-900 mt-0 mb-1.5 first:mt-0">
                  {tile.title}
                </h2>
              )}
              {tile.body && (
                <p className="text-sm text-surface-800 mb-2 last:mb-0 leading-relaxed">
                  {tile.body}
                </p>
              )}
              {tile.items && tile.items.length > 0 && (
                <ul className="list-none space-y-1.5 my-2 pl-0">
                  {tile.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-surface-800">
                      <span className="text-brand-500 font-medium flex-shrink-0">•</span>
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StructuredReplyTiles;
