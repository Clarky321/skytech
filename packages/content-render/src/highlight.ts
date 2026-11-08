import { CODE_LANGUAGE_IDS, type CodeLanguage } from '@skytech/contracts';
import apache from 'highlight.js/lib/languages/apache';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import dos from 'highlight.js/lib/languages/dos';
import nginx from 'highlight.js/lib/languages/nginx';
import powershell from 'highlight.js/lib/languages/powershell';
import { common, createLowlight } from 'lowlight';

/**
 * One highlighter for both the editor (client) and the server renderer, so code looks the same
 * while editing and after publishing (ADR 0002). Only languages offered in the picker are needed.
 */
export function createSkyLowlight() {
  const lowlight = createLowlight(common);
  lowlight.register({ apache, dockerfile, dos, nginx, powershell });
  return lowlight;
}

export type SkyLowlight = ReturnType<typeof createSkyLowlight>;

export function normalizeLanguage(language: string | null | undefined): CodeLanguage {
  return (CODE_LANGUAGE_IDS as readonly string[]).includes(language ?? '')
    ? (language as CodeLanguage)
    : 'plaintext';
}
