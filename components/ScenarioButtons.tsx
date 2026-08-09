'use client';

import { BookmarkPlus, Link2 } from 'lucide-react';
import { addScenario, buildShareUrl } from '@/lib/workbench';
import { copyText } from '@/lib/clipboard';
import { useToast } from '@/components/Toast';

/**
 * Workbench scenario controls shared by every calculator:
 *
 *  - "Save scenario" snapshots the current inputs into the local workbench
 *    (visible on the home page, restorable with one click);
 *  - "Copy link" copies a deep link that restores exactly these inputs via
 *    URL params — scenarios become shareable without any backend.
 */
export default function ScenarioButtons({
  slug,
  shortTitle,
  href,
  params,
}: {
  slug: string;
  shortTitle: string;
  href: string;
  params: Record<string, number>;
}) {
  const { show } = useToast();

  async function handleCopyLink() {
    const ok = await copyText(buildShareUrl(href, params));
    show(ok ? 'Copied shareable link' : 'Copy failed', ok ? 'success' : 'info');
  }

  function handleSave() {
    const name = `${shortTitle} · ${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
    addScenario(slug, name, params);
    show('Scenario saved to your workbench');
  }

  return (
    <>
      <button type="button" onClick={handleSave} className="btn-ghost" aria-label="Save this scenario to your workbench">
        <BookmarkPlus className="h-4 w-4 text-indigo-500" aria-hidden="true" />
        Save scenario
      </button>
      <button type="button" onClick={handleCopyLink} className="btn-ghost" aria-label="Copy a shareable link to these inputs">
        <Link2 className="h-4 w-4 text-indigo-500" aria-hidden="true" />
        Copy link
      </button>
    </>
  );
}
