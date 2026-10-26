const decoration = 'svg, img, kbd, [aria-hidden="true"], [hidden], .sr-only, .visually-hidden, .native-visually-hidden, .avatar, .feature-avatar, .priority-icon, .status-icon';

/** Read the rendered label, excluding icons, avatar initials and shortcut hints. */
function visibleLabel(element: Element): { text: string; clipped: boolean; clippedText?: string } {
  if (element.matches(decoration)) return { text: '', clipped: false };
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') {
    return { text: '', clipped: false };
  }
  const parts: string[] = [];
  const clippedParts: string[] = [];
  let clipped = false;
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) parts.push(child.textContent || '');
    else if (child instanceof Element) {
      const label = visibleLabel(child);
      parts.push(label.text);
      clipped ||= label.clipped;
      if (label.clipped) clippedParts.push(label.clippedText || label.text);
    }
  }
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (text && style.display !== 'contents') {
    clipped ||= (style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1)
      || (style.overflowY !== 'visible' && element.scrollHeight > element.clientHeight + 1);
  }
  return { text, clipped, clippedText: clippedParts.join(' ') || (clipped ? text : undefined) };
}

export const tooltipSelector = '[data-tooltip], [data-tooltip-label], button[aria-label], a[aria-label]';

export function tooltipContent(target: HTMLElement): { label: string; description: boolean } | null {
  if (target.closest('[data-tooltip-disabled]')) return null;
  // Native hints with additional information still own their hover surface.
  if (target.closest('[title]') || target.closest('button[aria-expanded="true"], a[aria-expanded="true"]')) return null;

  const description = target.getAttribute('data-tooltip');
  const explicitLabel = target.getAttribute('data-tooltip-label');
  const label = description || explicitLabel || target.getAttribute('aria-label');
  if (!label) return null;

  // An avatar/priority glyph beside its name must not create a second tooltip.
  // The same glyph on its own still needs an explanation.
  const context = target.closest('button, a, [role="option"], [role="menuitem"]')
    || (target.matches('.avatar, .priority-icon') ? target.parentElement : null)
    || target;
  const visible = visibleLabel(context);
  const normalized = label.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const printed = visible.text.toLocaleLowerCase();
  const alreadyPrinted = printed === normalized || (` ${printed} `).includes(` ${normalized} `);

  // Explicit descriptions (label help, dates, summaries) may add useful context.
  // Explicit labels are only needed if absent, abbreviated, or visually clipped.
  if (description || explicitLabel) {
    return alreadyPrinted && !visible.clipped ? null : { label, description: !!description };
  }

  // Accessible names are not an instruction to repeat every visible button name.
  if (visible.text) return visible.clipped ? { label: visible.clippedText || visible.text, description: false } : null;
  return { label, description: false };
}
