import axe from 'axe-core';

// CSQP-33 / CSQP-NF-004: run axe-core's WCAG 2.1 A/AA rules on the rendered page.
// Colour contrast can't be measured in jsdom (no layout), so that rule is
// checked in the browser instead (Lighthouse, see docs/ACCESSIBILITY_AUDIT.md).
export async function axeViolations(container = document.body) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
