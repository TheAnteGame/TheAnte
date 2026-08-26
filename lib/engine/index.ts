// lib/engine — the canonical settlement engine (ANTE-PLAYER §8). Pure functions,
// no I/O, no clock, no imports from anywhere below. Everything here is exhaustively
// unit-tested against the rulebook's worked examples in tests/engine/.

export * from "./constants";
export * from "./core";
export * from "./types";
export * from "./slateOpen";
export * from "./reveal";
export * from "./settle";
export * from "./invariants";
export * from "./removal";
