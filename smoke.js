#!/usr/bin/env node
/**
 * TECH-TICKETS — smoke test suite (Jul 2026)
 * Runs the app's pure, deterministic functions against known cases so a
 * regression is caught BEFORE deploy instead of on a tech's phone.
 *
 * Usage:   node smoke.js [path/to/index.html]     (default: ./index.html)
 * Exit 0 = all green. Exit 1 = at least one failure (do not deploy).
 *
 * Zero dependencies — plain Node 18+.
 */
const fs = require("fs");
const path = process.argv[2] || "./index.html";
const src = fs.readFileSync(path, "utf8");

// ── extract a top-level function's source by name ───────────────────────────
function extractFn(name) {
  let i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("Function not found in index.html: " + name);
  // Preserve an `async ` prefix if the declaration has one
  if (src.slice(Math.max(0, i - 6), i) === "async ") i -= 6;
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error("Unbalanced braces extracting " + name);
}

// ── sandbox with the app globals the extracted functions expect ─────────────
const sandbox = { active: [], done: [], console };
function load(names) {
  const code = names.map(extractFn).join("\n");
  const fn = new Function(...Object.keys(sandbox), code + "\nreturn {" + names.join(",") + "};");
  return fn(...Object.values(sandbox));
}

let pass = 0, fail = 0;
function T(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? "  ✔ " : "  ✗ ") + label + (ok ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`));
}

// ═════ 1) _custGroupKey — family identity engine ═════
console.log("\n_custGroupKey");
{
  const { _custGroupKey } = load(["_custGroupKey"]);
  const same = (a, b) => _custGroupKey(a) === _custGroupKey(b);
  T('"Ruck, Linda" ≡ "Ruck, Linda & Jim"', same("Ruck, Linda", "Ruck, Linda & Jim"), true);
  T('"Muñoz, José" ≡ "José Muñoz" (diacríticos)', same("Muñoz, José", "Jose Munoz"), true);
  T('"O\'Brien, Pat" ≡ "Pat OBrien" (apóstrofe)', same("O'Brien, Pat", "Pat OBrien"), true);
  T('"Sara Cox" ≡ "Cox Sara" (orden sin coma)', same("Sara Cox", "Cox Sara"), true);
  T('"Smith, Anna" ≠ "Smith, Bob" (familias distintas)', same("Smith, Anna", "Smith, Bob"), false);
  T("vacío → clave vacía/falsy", !_custGroupKey(""), true);
}

// ═════ 2) _dayDiff — date math the pairing depends on ═════
console.log("\n_dayDiff");
{
  const { _dayDiff } = load(["_dayDiff"]);
  T("mismo día = 0", _dayDiff("2026-06-18", "2026-06-18"), 0);
  T("d2 posterior = positivo", _dayDiff("2026-06-18", "2026-06-20"), 2);
  T("d2 anterior = negativo", _dayDiff("2026-06-20", "2026-06-18"), -2);
  T("fecha inválida = -999", _dayDiff("garbage", "2026-06-18"), -999);
}

// ═════ 3) _sharedReportVictims — the auto-healer's detection ═════
console.log("\n_sharedReportVictims (auto-heal)");
{
  sandbox.done = [
    { id: "R1", source: "report", customer: "Smart, Teresa", date: "2026-06-17", status: "done" },
    { id: "D1", source: "dispatch", customer: "Smart, Teresa", date: "2026-06-17", fieldReportSubmitted: true, fieldReportId: "R1" },
    { id: "D2", source: "dispatch", customer: "Smart, Teresa", date: "2026-06-18", fieldReportSubmitted: true, fieldReportId: "R1" },
    { id: "D3", source: "dispatch", customer: "Otro, Cliente", date: "2026-06-20", fieldReportSubmitted: true, fieldReportId: "RX" },
    { id: "D4", source: "dispatch", customer: "Solo, Uno", date: "2026-06-20", fieldReportSubmitted: true, fieldReportId: "R1X" },
    { id: "R1X", source: "report", customer: "Solo, Uno", date: "2026-06-20", status: "done" },
  ];
  const { _sharedReportVictims } = load(["_dayDiff", "_sharedReportVictims"]);
  const v = _sharedReportVictims().map(x => x.id);
  T("caso Teresa: víctima = D2, sobrevive D1", v, ["D2"]);
  T("rid sin reporte (RX) ignorado; single-link (D4) intacto", v.includes("D3") || v.includes("D4"), false);
  sandbox.done = [];
}

// ═════ 4) fmtD — local date (the UTC-evening fix depends on it) ═════
console.log("\nfmtD");
{
  const { fmtD } = load(["fmtD"]);
  T("2026-07-02 formatea igual", fmtD(new Date(2026, 6, 2)), "2026-07-02");
  T("pad de mes/día", fmtD(new Date(2026, 0, 5)), "2026-01-05");
}

// ═════ 5) _pinHash — determinismo del hash (Node 18+ webcrypto) ═════
console.log("\n_pinHash");
(async () => {
  try {
    const code = extractFn("_pinHash");
    const fn = new Function("crypto", "TextEncoder", code + "\nreturn _pinHash;");
    const _pinHash = fn(globalThis.crypto, TextEncoder);
    const a = await _pinHash("1234"), b = await _pinHash("1234"), c = await _pinHash("1235");
    T("mismo PIN → mismo hash", a === b && a.length === 64, true);
    T("PIN distinto → hash distinto", a === c, false);
    T("vacío → cadena vacía", await _pinHash(""), "");
  } catch (e) { fail++; console.log("  ✗ _pinHash: " + e.message); }

  // ── summary ──
  console.log("\n══════════════════════════════");
  console.log(fail === 0 ? `✅ ${pass} tests passed — safe to deploy` : `❌ ${fail} FAILED / ${pass} passed — DO NOT DEPLOY`);
  process.exit(fail === 0 ? 0 : 1);
})();
