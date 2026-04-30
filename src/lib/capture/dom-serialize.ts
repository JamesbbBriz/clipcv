// Serialize the visible DOM tree to a plain HTML string for a downstream LLM
// call. Strips elements that pollute the model's view of the page:
//   - <script> / <style> / <noscript> have no visual content and only inflate
//     token cost.
//   - aria-hidden="true" elements are explicitly hidden from assistive tech;
//     they are typically decorative or off-screen and add noise.
// Pure DOM logic — runs in the content script context.

const STRIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

export function serializeVisibleDom(doc: Document = document): string {
  const body = doc.body;
  if (!body) return '';
  const clone = body.cloneNode(true) as HTMLElement;
  pruneSubtree(clone);
  return clone.innerHTML;
}

function pruneSubtree(root: Element): void {
  const ownerDoc = root.ownerDocument;
  if (!ownerDoc) return;
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const removeList: Element[] = [];
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element && shouldStrip(node)) {
      removeList.push(node);
    }
    node = walker.nextNode();
  }
  // Detach in reverse order so parent removal cannot interfere with later
  // child references. `Element.remove()` is a no-op when parentNode is null.
  for (let i = removeList.length - 1; i >= 0; i--) {
    removeList[i]?.remove();
  }
}

function shouldStrip(el: Element): boolean {
  if (STRIP_TAGS.has(el.tagName)) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  return false;
}
