import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTrainerHtml, trainerPlainText } from "./trainers-sanitize";

describe("sanitizeTrainerHtml", () => {
  it("returns empty string for nullish input", () => {
    assert.equal(sanitizeTrainerHtml(null), "");
    assert.equal(sanitizeTrainerHtml(undefined), "");
    assert.equal(sanitizeTrainerHtml(""), "");
  });

  it("keeps the allowed formatting tags", () => {
    const html =
      "<h1>A</h1><h2>B</h2><h3>C</h3><p>Hi<br />there</p><ul><li><strong>One</strong></li></ul><ol><li><em>Two</em></li></ol><blockquote><p><b>Q</b> <i>and</i> <u>more</u></p></blockquote>";
    assert.equal(sanitizeTrainerHtml(html), html);
  });

  it("strips script, style, class, and disallowed tags while keeping text", () => {
    const html =
      '<div class="x" style="color:red"><p class="y" style="color:blue">Hello</p><script>alert(1)</script><style>p{}</style></div>';
    assert.equal(sanitizeTrainerHtml(html), "<p>Hello</p>");
  });

  it("forces rel and target on external http(s) links and drops event handlers", () => {
    const html = '<a href="https://example.com/path" onclick="evil()" class="btn" style="color:red">Site</a>';
    assert.equal(
      sanitizeTrainerHtml(html),
      '<a href="https://example.com/path" rel="noopener noreferrer" target="_blank">Site</a>'
    );
  });

  it("keeps mailto and tel links without target=_blank", () => {
    assert.equal(
      sanitizeTrainerHtml('<a href="mailto:train@example.com">Email</a>'),
      '<a href="mailto:train@example.com" rel="noopener noreferrer">Email</a>'
    );
    assert.equal(
      sanitizeTrainerHtml('<a href="tel:+15555550100">Call</a>'),
      '<a href="tel:+15555550100" rel="noopener noreferrer">Call</a>'
    );
  });

  it("drops unsafe hrefs but keeps the link text", () => {
    assert.equal(sanitizeTrainerHtml('<a href="javascript:alert(1)">Click</a>'), "Click");
    assert.equal(sanitizeTrainerHtml('<a href="//evil.example">Click</a>'), "Click");
    assert.equal(sanitizeTrainerHtml('<a href="data:text/html,hi">Click</a>'), "Click");
    assert.equal(sanitizeTrainerHtml("<a>Click</a>"), "Click");
  });

  it("is stable when run twice", () => {
    const once = sanitizeTrainerHtml(
      '<h2>Title</h2><p>See <a href="https://ldma.com">LDMA</a> and <a href="mailto:a@b.co">mail</a>.</p>'
    );
    assert.equal(sanitizeTrainerHtml(once), once);
  });
});

describe("trainerPlainText", () => {
  it("strips tags and collapses whitespace", () => {
    assert.equal(trainerPlainText("  <p>Hello <strong>there</strong></p>  "), "Hello there");
    assert.equal(trainerPlainText(null), "");
  });
});
