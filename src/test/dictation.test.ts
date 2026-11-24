import { describe, expect, test } from "vitest"

import { dictationSpaces, joinDictation } from "@/lib/dictation"

describe("joinDictation", () => {
  test("Latin beside Latin: a space between", () => {
    expect(joinDictation("hello world", 11, "dictated words")).toBe(
      "hello world dictated words"
    )
    expect(joinDictation("version", 7, "2")).toBe("version 2")
  })

  test("the caret in the middle: a space on either side", () => {
    expect(joinDictation("hello world", 5, "big")).toBe("hello big world")
    expect(joinDictation("helloworld", 5, "big")).toBe("hello big world")
  })

  test("a space there already: none more", () => {
    expect(joinDictation("hello ", 6, "world")).toBe("hello world")
    expect(joinDictation("hello world", 6, "big")).toBe("hello big world")
    expect(joinDictation("hello", 5, " world")).toBe("hello world")
    expect(joinDictation("one\n", 4, "two")).toBe("one\ntwo")
  })

  test("Latin beside Chinese or Japanese: none", () => {
    expect(joinDictation("rename", 6, "函数")).toBe("rename函数")
    expect(joinDictation("ファイル", 4, "upload")).toBe("ファイルupload")
  })

  test("Chinese or Japanese beside each other: none", () => {
    expect(joinDictation("请把", 2, "函数改名")).toBe("请把函数改名")
    expect(joinDictation("これは", 3, "テストです")).toBe("これはテストです")
    expect(joinDictation("你好。", 3, "再见")).toBe("你好。再见")
  })

  test("other scripts written with spaces: one", () => {
    expect(joinDictation("привет", 6, "мир")).toBe("привет мир")
    expect(joinDictation("안녕", 2, "세상")).toBe("안녕 세상")
    expect(joinDictation("café", 4, "olé")).toBe("café olé")
  })

  test("punctuation: a space after a sentence's or a clause's, none before", () => {
    expect(joinDictation("Done.", 5, "Next")).toBe("Done. Next")
    expect(joinDictation("first,", 6, "second")).toBe("first, second")
    expect(joinDictation("(see)", 5, "below")).toBe("(see) below")
    expect(joinDictation("hello.", 5, "world")).toBe("hello world.")
    expect(joinDictation("hello", 5, "world, again")).toBe("hello world, again")
    expect(joinDictation("note", 4, "(draft)")).toBe("note (draft)")
    // Opening or closing, a straight quote cannot say: none.
    expect(joinDictation('say "', 5, "hi")).toBe('say "hi')
    expect(joinDictation("path/", 5, "to")).toBe("path/to")
  })

  test("an empty draft: the words as they are", () => {
    expect(joinDictation("", 0, "hello world")).toBe("hello world")
  })

  test("no words: nothing", () => {
    expect(dictationSpaces("hello", "", "world")).toEqual({
      lead: "",
      trail: "",
    })
  })

  test("a chip beside them takes a space as a word does", () => {
    expect(dictationSpaces("￼", "look at this", "￼")).toEqual({
      lead: " ",
      trail: " ",
    })
  })
})
