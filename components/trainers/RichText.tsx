/**
 * Renders a trainer biography. `html` is already sanitized by the data layer
 * (lib/trainers-sanitize.ts) to a small set of formatting tags.
 */
export function RichText({ html }: { html: string }) {
  return <div className="trainer-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
