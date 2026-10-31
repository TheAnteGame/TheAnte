import { describe, expect, it } from "vitest";
import { buildHandles, findMentioned, findNamed, segmentBody, type Mentionable } from "./mentions";

const roster: Mentionable[] = [
  { id: "p1", firstName: "Robert", lastName: "Toler" },
  { id: "p2", firstName: "Dana", lastName: "Whitfield" },
  { id: "p3", firstName: "Robert", lastName: "Salas" }, // same first name as p1
  { id: "p4", firstName: "Marco", lastName: null },
];

describe("buildHandles", () => {
  it("uses the bare first name when it is unique", () => {
    const h = buildHandles(roster);
    expect(h.find((x) => x.id === "p2")?.handle).toBe("Dana");
  });

  it("adds a last initial only where a first name repeats", () => {
    const h = buildHandles(roster);
    expect(h.find((x) => x.id === "p1")?.handle).toBe("RobertT");
    expect(h.find((x) => x.id === "p3")?.handle).toBe("RobertS");
  });

  it("still gives everyone exactly one handle when last names collide too", () => {
    const twins: Mentionable[] = [
      { id: "a", firstName: "Robert", lastName: "Toler" },
      { id: "b", firstName: "Robert", lastName: "Tanaka" },
    ];
    const h = buildHandles(twins);
    expect(new Set(h.map((x) => x.handle)).size).toBe(2);
    expect(h).toHaveLength(2);
  });

  it("survives a missing last name", () => {
    const h = buildHandles(roster);
    expect(h.find((x) => x.id === "p4")?.handle).toBe("Marco");
  });

  it("skips a player with no first name rather than inventing one", () => {
    expect(buildHandles([{ id: "x", firstName: null, lastName: "Ghost" }])).toHaveLength(0);
  });
});

describe("findMentioned", () => {
  const handles = buildHandles(roster);

  it("resolves an exact handle", () => {
    expect(findMentioned("nice call @Dana", handles)).toEqual(["p2"]);
  });

  it("prefers the longer handle when one is a prefix of another", () => {
    expect(findMentioned("@RobertS took the Bills", handles)).toEqual(["p3"]);
  });

  it("resolves a handle followed by punctuation", () => {
    expect(findMentioned("@Dana, are you serious?", handles)).toEqual(["p2"]);
  });

  it("de-duplicates a player named twice", () => {
    expect(findMentioned("@Dana and again @Dana", handles)).toEqual(["p2"]);
  });

  it("ignores an unknown handle", () => {
    expect(findMentioned("@Nobody here", handles)).toEqual([]);
  });

  it("returns nothing for a body with no mentions", () => {
    expect(findMentioned("just talking about the game", handles)).toEqual([]);
  });
});

describe("segmentBody", () => {
  const handles = buildHandles(roster);

  it("marks only the mention, leaving the rest as text", () => {
    const segs = segmentBody("hey @Dana nice", handles);
    expect(segs.map((s) => s.text)).toEqual(["hey ", "@Dana", " nice"]);
    expect(segs.map((s) => s.mention)).toEqual([false, true, false]);
  });

  it("leaves an unknown handle as plain text", () => {
    const segs = segmentBody("mail me at bob@example.com", handles);
    expect(segs.every((s) => !s.mention)).toBe(true);
  });

  it("reassembles to the original body exactly", () => {
    const body = "@RobertT and @Dana, both wrong. @Nobody too.";
    expect(segmentBody(body, handles).map((s) => s.text).join("")).toBe(body);
  });
});

describe("findNamed (D-121)", () => {
  // The league as it really is: two Steves, a Zack displayed as "Robert (Zack)",
  // and a Bob who is a Robert in life but not on screen.
  const league: Mentionable[] = [
    { id: "zack", firstName: "Robert (Zack)", lastName: "Toler" },
    { id: "bob", firstName: "Bob", lastName: "Toler" },
    { id: "steveL", firstName: "Steve", lastName: "Lopez" },
    { id: "steveM", firstName: "Steve", lastName: "Moore" },
    { id: "dustin", firstName: "Dustin", lastName: "Gray" },
    { id: "justin", firstName: "Justin", lastName: "Green" },
  ];

  it("hears a unique first name in plain words, any case", () => {
    expect(findNamed("dustin you're crazy", league)).toEqual(["dustin"]);
    expect(findNamed("Nice pick, Dustin!", league)).toEqual(["dustin"]);
  });

  it("matches whole words only", () => {
    expect(findNamed("Justin took the over", league)).toEqual(["justin"]);
    expect(findNamed("Dustinator strikes again", league)).toEqual([]);
  });

  it("answers to every word of the displayed first name, and only those", () => {
    expect(findNamed("Zack is on a heater", league)).toEqual(["zack"]);
    expect(findNamed("Robert is on a heater", league)).toEqual(["zack"]);
    expect(findNamed("Zach is on a heater", league)).toEqual([]);
    expect(findNamed("Bob is on a heater", league)).toEqual(["bob"]);
  });

  it("pings no Steve for a bare Steve", () => {
    expect(findNamed("Steve, what was that?", league)).toEqual([]);
    expect(findNamed("Steve's ticket is wild", league)).toEqual([]);
  });

  it("pings the one Steve a last initial or last name picks out", () => {
    expect(findNamed("Steve L, what was that?", league)).toEqual(["steveL"]);
    expect(findNamed("steve moore took the dog", league)).toEqual(["steveM"]);
    expect(findNamed("Steve look at this", league)).toEqual([]);
  });

  it("cannot split two Roberts who share a last name; their other names can", () => {
    const shared = [...league.filter((p) => p.id !== "bob"), { id: "bob", firstName: "Robert (Bob)", lastName: "Toler" }];
    expect(findNamed("Robert T is up big", shared)).toEqual([]);
    expect(findNamed("Bob and Zack both folded", shared)).toEqual(["bob", "zack"]);
  });

  it("leaves @ handles to findMentioned and names each player once", () => {
    expect(findNamed("@Dustin", league)).toEqual([]);
    expect(findNamed("Dustin! DUSTIN!", league)).toEqual(["dustin"]);
  });
});
