/**
 * arac/plan-preview.js — dry-run preview of a task graph.
 *
 * WHY THESE TESTS. A preview that disagrees with the run is worse than none: it
 * would tell the operator "next: X" while the orchestrator runs Y. So the central
 * test below does not restate the selection rule, it asks the real
 * `task-manager.sonraki_adim` for every record state and compares.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gorevYoneticisi } from "./task-manager/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { buildPlan, toMermaid } = createRequire(import.meta.url)("../arac/plan-preview.js");
const EXAMPLE = join(ROOT, "contracts", "ornek", "gorev", "gece-mimari-turu.json");

const tmp = mkdtempSync(join(tmpdir(), "ajans-os-plan-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

function step(id, depends_on = [], extra = {}) {
  return {
    id,
    title: id,
    assign: { mode: "role", role: "specialist" },
    depends_on,
    evaluation: { method: "deterministic", checker: "true" },
    retry: { max_attempts: 2, mode: "duzelt", backoff: "yok" },
    side_effects: false,
    ...extra,
  };
}

function task(steps, records = []) {
  return {
    contract_version: "1.0",
    task: { id: "t", title: "T", budget: { max_usd: 1, on_exceed: "stop", spent_usd: null } },
    graph: { steps },
    run: { run_id: "kosu-t", step_records: records },
  };
}

function rec(step_id, status, attempt = 1) {
  return { step_id, attempt, status, started_at: "2026-10-15T10:00:00Z" };
}

function run(args) {
  const r = spawnSync(process.execPath, [join(ROOT, "arac", "plan-preview.js"), ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test("plan-preview: next step equals task-manager.sonraki_adim for every record state", () => {
  const tm = gorevYoneticisi({ dizin: tmp });
  const graph = [step("a"), step("b", ["a"]), step("c", []), step("d", ["b", "c"])];
  const cases = [
    [],
    [rec("a", "BITTI")],
    [rec("a", "BASLADI")],
    [rec("a", "BASARISIZ", 1)],
    [rec("a", "BASARISIZ", 2)],
    [rec("a", "ONAY_BEKLIYOR")],
    [rec("a", "BITTI"), rec("b", "GIRDI_BEKLIYOR"), rec("c", "BITTI")],
    [rec("a", "BITTI"), rec("b", "BITTI"), rec("c", "BITTI")],
    [rec("a", "BITTI"), rec("b", "BITTI"), rec("c", "BITTI"), rec("d", "BITTI")],
  ];
  for (const records of cases) {
    const t = task(graph, records);
    const expected = tm.sonraki_adim(t);
    const plan = buildPlan(t);
    assert.equal(plan.next_step, expected ? expected.id : null, JSON.stringify(records));
  }
});

test("plan-preview: the shipped example resumes at the interrupted step and skips the done one", () => {
  const plan = buildPlan(JSON.parse(readFileSync(EXAMPLE, "utf8")));
  assert.equal(plan.valid, true);
  assert.equal(plan.next_step, "belgeyi-yaz");
  assert.deepEqual(plan.order, ["belgeyi-yaz", "kapanis"]);
  const done = plan.steps.find((s) => s.id === "sozlesmeleri-yaz");
  assert.equal(done.state, "done");
  assert.deepEqual(done.stops, [], "a done step cannot stop the run");
  assert.deepEqual(plan.steps.map((s) => s.wave), [0, 1, 2]);
  // orchestrator.dongu ceiling: sum of max_attempts (2 + 2 + 1) + 1
  assert.equal(plan.loop_ceiling, 6);
  // interrupted attempt 1 of 2 keeps both tries (basladi_yaz reuses the attempt) + kapanis 1
  assert.equal(plan.max_model_calls, 3);
});

test("plan-preview: invalid graphs are reported, not simulated (cycle, unknown, duplicate, self)", () => {
  const cycle = buildPlan(task([step("a", ["c"]), step("b", ["a"]), step("c", ["b"])]));
  assert.equal(cycle.valid, false);
  assert.ok(cycle.errors.some((e) => /^döngü: /.test(e)), cycle.errors.join("; "));
  assert.deepEqual(cycle.order, []);

  const unknown = buildPlan(task([step("a", ["yok"])]));
  assert.ok(unknown.errors.includes("a olmayan bir adıma bağlı: yok"));

  const dup = buildPlan(task([step("a"), step("a")]));
  assert.ok(dup.errors.includes("yinelenen adım kimliği: a"));

  const self = buildPlan(task([step("a", ["a"])]));
  assert.ok(self.errors.includes("a kendisine bağlı"));

  assert.equal(buildPlan(task([])).valid, false, "an empty graph is not a plan");
});

test("plan-preview: a waiting or exhausted step makes its dependents unreachable in this run", () => {
  const graph = [step("a"), step("b", ["a"]), step("c")];
  const waiting = buildPlan(task(graph, [rec("a", "ONAY_BEKLIYOR")]));
  assert.deepEqual(waiting.order, ["c"]);
  assert.deepEqual(waiting.unreachable, ["b"]);

  const exhausted = buildPlan(task(graph, [rec("a", "BASARISIZ", 2)]));
  assert.equal(exhausted.steps[0].state, "exhausted");
  assert.deepEqual(exhausted.unreachable, ["b"]);
});

test("plan-preview: names the stops the orchestrator would hit, certain vs possible", () => {
  const plan = buildPlan(
    task([
      step("gated", [], { human_gate: true }),
      step("unchecked", [], { evaluation: { method: "llm-judge" } }),
      step("no-undo", [], { side_effects: true }),
      step("undo", [], { side_effects: true, compensation: { method: "dosyayi geri tasi" } }),
    ]),
  );
  const kinds = (id) => plan.steps.find((s) => s.id === id).stops.map((s) => [s.kind, s.certain]);
  assert.deepEqual(kinds("gated"), [["human_gate", true]]);
  assert.deepEqual(kinds("unchecked"), [["not_evaluated", true]]);
  assert.deepEqual(kinds("no-undo"), [["no_compensation", false]]);
  assert.deepEqual(kinds("undo"), []);
});

test("plan-preview: with agent contracts, resolves assignments like ajanSec and flags the missing one", () => {
  const agents = [
    { identity: { id: "uzman", status: "active" }, role: { kind: "specialist" }, tools: ["dosya-oku"] },
    { identity: { id: "eski", status: "retired" }, role: { kind: "critic" } },
  ];
  const plan = buildPlan(
    task([
      step("by-role"),
      step("by-id", [], { assign: { mode: "agent", agent_id: "uzman" } }),
      step("retired-only", [], { assign: { mode: "role", role: "critic" } }),
    ]),
    agents,
  );
  const s = (id) => plan.steps.find((x) => x.id === id);
  assert.equal(s("by-role").agent, "uzman");
  assert.equal(s("by-role").needs_tool_calling, true, "an agent with tools needs a tool-calling model");
  assert.equal(s("by-id").agent, "uzman");
  assert.equal(s("retired-only").agent, null, "a retired agent is not a candidate");
  assert.ok(s("retired-only").stops.some((x) => x.kind === "agent_missing"));
  // Without contracts the preview does not guess: no agent_missing stop.
  assert.ok(!buildPlan(task([step("x")])).steps[0].stops.some((x) => x.kind === "agent_missing"));
});

test("plan-preview: counts the model calls still possible from the record", () => {
  const graph = [step("a"), step("b", ["a"], { retry: { max_attempts: 3 } })];
  assert.equal(buildPlan(task(graph)).max_model_calls, 5);
  assert.equal(buildPlan(task(graph, [rec("a", "BITTI"), rec("b", "BASARISIZ", 1)])).max_model_calls, 2);
});

test("plan-preview CLI: text, --json and --mermaid; invalid graph exits 1; the input is not written", () => {
  const before = [readFileSync(EXAMPLE, "utf8"), statSync(EXAMPLE).mtimeMs];
  const text = run([EXAMPLE, "--ajanlar", "contracts/ornek"]);
  assert.equal(text.code, 0, text.err);
  assert.match(text.out, /^Plan önizleme: orkestrasyon-mimarisi/m);
  assert.match(text.out, /Sıradaki adım: belgeyi-yaz/);

  const json = run([EXAMPLE, "--json"]);
  assert.equal(json.code, 0);
  assert.equal(JSON.parse(json.out).next_step, "belgeyi-yaz");

  const mermaid = run([EXAMPLE, "--mermaid"]);
  assert.equal(mermaid.code, 0);
  assert.match(mermaid.out, /^flowchart TD/);
  assert.match(mermaid.out, /s0 --> s1/);
  assert.deepEqual([readFileSync(EXAMPLE, "utf8"), statSync(EXAMPLE).mtimeMs], before);

  const bad = join(tmp, "dongu.json");
  writeFileSync(bad, JSON.stringify(task([step("a", ["b"]), step("b", ["a"])])), "utf8");
  const invalid = run([bad]);
  assert.equal(invalid.code, 1);
  assert.match(invalid.err, /GEÇERSİZ graf/);

  const missing = run([join(tmp, "yok.json")]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /böyle bir dosya yok/);
  assert.equal(run([EXAMPLE, "--json", "--mermaid"]).code, 2);
});

test("plan-preview: mermaid uses positional node ids, so keyword-like step ids stay valid", () => {
  const out = toMermaid(buildPlan(task([step("end"), step("graph", ["end"])])));
  assert.match(out, /s0\["end<br\/>/);
  assert.match(out, /s0 --> s1/);
  assert.doesNotMatch(out, /^\s+end\[/m);
});
