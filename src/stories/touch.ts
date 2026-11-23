/**
 * A rule's declarations as written: a shorthand with a `var()` in it
 * (`padding-block: calc(var(--spacing) * 2)`) is read whole, as its
 * longhands read empty until it is computed.
 */
function declarations(style: CSSStyleDeclaration) {
  const found = new Map<string, string>()
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index)
    const value = style.getPropertyValue(name)
    if (value) found.set(name, value)
  }
  for (const declaration of style.cssText.split(";")) {
    const colon = declaration.indexOf(":")
    if (colon < 0) continue
    const name = declaration.slice(0, colon).trim()
    const value = style.getPropertyValue(name)
    if (value && !found.has(name)) found.set(name, value)
  }
  return found
}

/**
 * What `read` finds with `root` laid out as under a finger: the
 * declarations of the page's `(pointer: coarse)` rules (where their other
 * conditions, e.g. a width, hold) put inline on the elements they match,
 * `root` and those in it, while it runs; as the browser under test has a
 * mouse. Later rules win, as in the page's order.
 */
export function asCoarse<T>(root: HTMLElement, read: () => T): T {
  const elements = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>("*")),
  ]
  const found = new Map<HTMLElement, Map<string, string>>()
  const apply = (selector: string, style: CSSStyleDeclaration) => {
    if (selector.includes("::")) return
    for (const element of elements) {
      try {
        if (!element.matches(selector)) continue
      } catch {
        // A selector this browser does not take.
        continue
      }
      const own = found.get(element) ?? new Map<string, string>()
      for (const [name, value] of declarations(style)) own.set(name, value)
      found.set(element, own)
    }
  }
  const visit = (rules: CSSRuleList, coarse: boolean, parent: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const condition = rule.conditionText
        // A finger's, or one for any pointer but a mouse's
        // (`not-pointer-fine:`).
        if (
          condition.includes("pointer: coarse") ||
          /^not\b.*pointer: fine/.test(condition)
        )
          visit(rule.cssRules, true, parent)
        else if (
          !condition.includes("pointer: fine") &&
          window.matchMedia(condition).matches
        )
          visit(rule.cssRules, coarse, parent)
      } else if (rule instanceof CSSStyleRule) {
        const selector = parent
          ? rule.selectorText.replaceAll("&", parent)
          : rule.selectorText
        if (coarse) apply(selector, rule.style)
        visit(rule.cssRules, coarse, selector)
      } else if ("style" in rule && parent) {
        // Declarations nested in a rule's media query.
        if (coarse) apply(parent, (rule as CSSStyleRule).style)
      } else if ("cssRules" in rule)
        visit((rule as CSSGroupingRule).cssRules, coarse, parent)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, false, "")
    } catch {
      // Another origin's.
    }
  }
  const saved = new Map<HTMLElement, string | null>()
  for (const [element, declarations] of found) {
    saved.set(element, element.getAttribute("style"))
    // At once: a transition would read its start.
    element.style.setProperty("transition", "none")
    for (const [name, value] of declarations)
      element.style.setProperty(name, value)
  }
  try {
    return read()
  } finally {
    for (const [element, style] of saved)
      if (style === null) element.removeAttribute("style")
      else element.setAttribute("style", style)
  }
}

/**
 * How large an element's place is where the pointer is a finger
 * (`pointer: coarse`), in pixels: its box, or its `::after`'s where that
 * is larger (an inset past its edges, or the theme's `touch-target`),
 * read from the page's style sheets, as the browser under test has a
 * mouse.
 */
export function coarseHitSize(element: HTMLElement) {
  let after: CSSStyleDeclaration | undefined
  const visit = (rules: CSSRuleList, coarse: boolean, parent: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule)
        visit(
          rule.cssRules,
          coarse || rule.conditionText.includes("pointer: coarse"),
          parent
        )
      else if (rule instanceof CSSStyleRule) {
        const selector = parent
          ? rule.selectorText.replaceAll("&", parent)
          : rule.selectorText
        if (
          coarse &&
          selector.includes("::after") &&
          (rule.style.inset || rule.style.width)
        ) {
          try {
            if (element.matches(selector.replaceAll("::after", "")))
              after = rule.style
          } catch {
            // A selector this browser does not take.
          }
        }
        visit(rule.cssRules, coarse, selector)
      } else if ("cssRules" in rule)
        visit((rule as CSSGroupingRule).cssRules, coarse, parent)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, false, "")
    } catch {
      // Another origin's.
    }
  }
  // Its layout's size, not as an opening popup's scale shows it.
  const box = { width: element.offsetWidth, height: element.offsetHeight }
  if (after === undefined) return box
  // The `::after` as the element's own style would lay it out.
  const probe = document.createElement("div")
  probe.style.position = "absolute"
  if (after.width) {
    probe.style.width = after.width
    probe.style.height = after.height
    element.append(probe)
    const size = { width: probe.offsetWidth, height: probe.offsetHeight }
    probe.remove()
    return size
  }
  probe.style.marginLeft = after.inset
  element.append(probe)
  const outset = -parseFloat(getComputedStyle(probe).marginLeft)
  probe.remove()
  return { width: box.width + 2 * outset, height: box.height + 2 * outset }
}

/**
 * A length an element takes where the pointer is a finger, e.g. its
 * `min-height`, in pixels: from the page's style sheets' `pointer:
 * coarse` rules that match it; undefined without one.
 */
export function coarseLength(element: HTMLElement, property: string) {
  let value: string | undefined
  const take = (style: CSSStyleDeclaration, selector: string) => {
    const own = style.getPropertyValue(property)
    try {
      if (own && element.matches(selector)) value = own
    } catch {
      // A selector this browser does not take.
    }
  }
  const visit = (rules: CSSRuleList, coarse: boolean, parent: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule)
        visit(
          rule.cssRules,
          coarse || rule.conditionText.includes("pointer: coarse"),
          parent
        )
      else if (rule instanceof CSSStyleRule) {
        const selector = parent
          ? rule.selectorText.replaceAll("&", parent)
          : rule.selectorText
        if (coarse) take(rule.style, selector)
        visit(rule.cssRules, coarse, selector)
      } else if ("cssRules" in rule)
        visit((rule as CSSGroupingRule).cssRules, coarse, parent)
      // Declarations nested in a media rule in a style rule.
      else if (coarse && parent && "style" in rule)
        take((rule as CSSStyleRule).style, parent)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, false, "")
    } catch {
      // Another origin's.
    }
  }
  if (value === undefined) return undefined
  const probe = document.createElement("div")
  probe.style.position = "absolute"
  probe.style.height = value
  element.append(probe)
  const size = probe.offsetHeight
  probe.remove()
  return size
}
