export { dictationSpaces, joinDictation }

/**
 * Where dictated words go in a draft, the spaces they need there: one
 * between them and the text on either side where neither has one and
 * both are of a script written with spaces between its words (Latin,
 * Cyrillic, Greek, Hangul…: letters and digits). None next to Chinese,
 * Japanese, Thai and the like, whose words come without them, nor
 * before punctuation; after a sentence's or a clause's (". , ! ? ; :"),
 * a closing bracket or quote, one.
 *
 * `before` and `after` are the draft's text on either side of where
 * they go (only the characters beside them count): `""` none, `"\n"` a
 * line break, `"\uFFFC"` a chip (a mention, a file), which takes a
 * space as a word does.
 */
function dictationSpaces(
  before: string,
  words: string,
  after: string
): { lead: string; trail: string } {
  if (!words) return { lead: "", trail: "" }
  return {
    lead: spaced(lastOf(before), firstOf(words)) ? " " : "",
    trail: spaced(lastOf(words), firstOf(after)) ? " " : "",
  }
}

/** `words` in `draft` at `at` (a caret's offset), spaced as they need. */
function joinDictation(draft: string, at: number, words: string) {
  const before = draft.slice(0, at)
  const after = draft.slice(at)
  const { lead, trail } = dictationSpaces(before, words, after)
  return before + lead + words + trail + after
}

const firstOf = (text: string) => {
  const code = text.codePointAt(0)
  return code === undefined ? "" : String.fromCodePoint(code)
}
const lastOf = (text: string) => Array.from(text).at(-1) ?? ""

/** Letters, digits and their marks; a chip as one. */
const wordChar = /[\p{L}\p{N}\p{M}\uFFFC]/u
/** Scripts written without spaces between words. */
const unspaced =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}\u3000-\u303F\uFF00-\uFFEF]/u
/** Ends a sentence, a clause or a bracket: a space after it. */
const closing = /[.,!?;:)\]}%”’…]/u
/** Opens a bracket or quote: a space before it. */
const opening = /[([{“‘]/u

const isWord = (char: string) => wordChar.test(char) && !unspaced.test(char)

function spaced(left: string, right: string) {
  if (!left || !right) return false
  if (/\s/u.test(left) || /\s/u.test(right)) return false
  return (
    (isWord(left) || closing.test(left)) && (isWord(right) || opening.test(right))
  )
}
