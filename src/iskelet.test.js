// Calisma zamani iskeletinin kendi testi (U0).
// Amaci bir modulu sinamak degil: `npm test` ile kosucunun gercekten ayakta
// oldugunu ve ESM cozumlemesinin calistigini gostermek.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = dirname(fileURLToPath(import.meta.url));

test("kosucu ayakta ve ESM cozumleniyor", () => {
  assert.equal(typeof import.meta.url, "string");
});

test("ADR-001: 13 modul klasorunun her birinde index.d.ts var", () => {
  const modiller = readdirSync(src, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.equal(modiller.length, 13, "modul klasoru sayisi ADR-001 ile eslesmeli");
  for (const m of modiller) {
    assert.ok(existsSync(join(src, m, "index.d.ts")), `src/${m}/index.d.ts yok`);
  }
});
