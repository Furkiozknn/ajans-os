/**
 * arac/run-report.js — structured run report from the task record and the trace.
 *
 * WHY THESE TESTS. The report reads files that two modules write. So the record and
 * the trace below are produced by the REAL task-manager and observability, not
 * hand-written: if either module changes its on-disk shape, these tests break
 * before a report starts lying. The other tests pin the honesty rule: unknown cost
 * is never added up as zero.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gorevYoneticisi } from "./task-manager/index.js";
import { gozlemci } from "./observability/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { buildReport, parseTrace, partialSum, toMarkdown } = createRequire(import.meta.url)("../arac/run-report.js");
const EXAMPLE = join(ROOT, "contracts", "ornek", "gorev", "gece-mimari-turu.json");

const tmp = mkdtempSync(join(tmpdir(), "ajans-os-rapor-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

function step(id, depends_on = [], max = 2) {
  return {
    id,
    title: `${id} adimi`,
    assign: { mode: "role", role: "specialist" },
    depends_on,
    evaluation: { method: "deterministic", checker: "true" },
    retry: { max_attempts: max, mode: "duzelt", backoff: "yok" },
    side_effects: false,
  };
}

function newTask(id, steps) {
  return {
    contract_version: "1.0",
    task: { id, title: "Rapor denemesi", budget: { max_usd: 2, on_exceed: "stop", spent_usd: null } },
    graph: { steps },
    run: { run_id: `kosu-${id}`, started_at: "2026-10-15T10:00:00Z", step_records: [] },
  };
}

function cliRun(args) {
  const r = spawnSync(process.execPath, [join(ROOT, "arac", "run-report.js"), ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** One run written by the real modules: done, failed-and-retrying, waiting, not started. */
async function realRun() {
  const tm = gorevYoneticisi({ dizin: join(tmp, "gorevler") });
  const obs = gozlemci({ dizin: join(tmp, "izler") });
  const t = newTask("rapor", [step("a"), step("b", ["a"]), step("c", ["a"]), step("d", ["b", "c"])]);
  await tm.olustur(t);
  const run_id = t.run.run_id;
  const span = (id, step_id, operation, name, extra = {}) =>
    obs.span_yaz({ contract_version: "1.0", span_id: id, trace_id: run_id, parent_span_id: null, run_id, step_id, operation, name, started_at: "2026-10-15T10:00:00Z", outcome: { status: "ok" }, ...extra });

  await tm.basladi_yaz(t, "a");
  span("s1", "a", "inference", "inference model-x", { model: { provider: "p", name: "model-x" }, usage: { input_tokens: 100, output_tokens: 20 }, cost: { usd: 0.25 } });
  span("s2", "a", "permission_check", "permission_check ALLOW");
  await tm.bitti_yaz(t, "a", { result_summary: "a tamam", cost_usd: 0.25, evaluation_result: "GECTI" });

  await tm.basladi_yaz(t, "b");
  span("s3", "b", "inference", "inference model-y", { model: { provider: "p", name: "model-y" }, usage: { input_tokens: 50, output_tokens: null }, cost: { usd: null, unknown_reason: "fiyat-tablosunda-yok" } });
  span("s4", "b", "recovery", "recovery duzelt", { outcome: { status: "hata", error_type: "DOGRULAMA_KALDI" } });
  await tm.basarisiz_yaz(t, "b", { error_type: "DOGRULAMA_KALDI", error_message: "kontrol kaldi" });

  await tm.basladi_yaz(t, "c");
  span("s5", "c", "permission_check", "permission_check HUMAN_REQUIRED");
  await tm.durum_degistir(t, "c", "ONAY_BEKLIYOR", "kapi-c-1");
  // An opened span that never closed: the process "died" here.
  obs.span_ac({ contract_version: "1.0", span_id: "s6", trace_id: run_id, parent_span_id: null, run_id, step_id: "c", operation: "run", name: "adim c", started_at: "2026-10-15T10:00:00Z" });

  const recordPath = tm.kayit_yolu("rapor");
  return { recordPath, tracePath: obs.iz_yolu(run_id), obs, run_id };
}

test("run-report: reads the record and trace exactly as the real task-manager and observability wrote them", async () => {
  const { recordPath, tracePath, obs, run_id } = await realRun();
  const r = buildReport(JSON.parse(readFileSync(recordPath, "utf8")), readFileSync(tracePath, "utf8"));

  assert.equal(r.outcome, "waiting", "a step at the approval gate wins over the retrying one");
  assert.deepEqual(r.waiting, [{ step_id: "c", status: "ONAY_BEKLIYOR", approval_ref: "kapi-c-1" }]);
  const s = (id) => r.steps.find((x) => x.id === id);
  assert.equal(s("a").status, "BITTI");
  assert.equal(s("a").evaluation_result, "GECTI");
  assert.equal(s("b").status, "BASARISIZ (yeniden denenecek)");
  assert.equal(s("b").error_type, "DOGRULAMA_KALDI");
  assert.equal(s("d").status, "BASLAMADI");
  assert.equal(s("d").attempts, 0);

  // Trace: same dedupe rule as kosu_izleri, so the span count must agree with it.
  assert.equal(r.trace.spans, (await obs.kosu_izleri(run_id)).length);
  assert.equal(r.trace.interrupted, 1, "the open span stays visible as interrupted");
  assert.deepEqual(r.trace.permissions, { ALLOW: 1, HUMAN_REQUIRED: 1 });
  assert.deepEqual(r.trace.recoveries, { duzelt: 1 });
  assert.deepEqual(r.trace.errors, { DOGRULAMA_KALDI: 1 });
  const y = r.trace.models.find((m) => m.model === "model-y");
  assert.deepEqual(y.output_tokens, { value: 0, known: 0, unknown: 1 }, "an unknown count is not 0 tokens");
});

test("run-report: unknown cost makes the total a lower bound, never a complete sum (AP10)", () => {
  const t = newTask("maliyet", [step("a"), step("b"), step("c")]);
  t.run.step_records = [
    { step_id: "a", attempt: 1, status: "BITTI", started_at: "2026-10-15T10:00:00Z", ended_at: "2026-10-15T10:00:30Z", cost_usd: 0.5, evaluation_result: "GECTI" },
    { step_id: "b", attempt: 1, status: "BITTI", started_at: "2026-10-15T10:01:00Z", ended_at: "2026-10-15T10:02:00Z", cost_usd: null, evaluation_result: "GECTI" },
  ];
  const r = buildReport(t);
  assert.deepEqual(r.cost_usd, { value: 0.5, known: 1, unknown: 1 }, "the not-started step c is not an unknown cost");
  const md = toMarkdown(r);
  assert.match(md, /Maliyet: en az \$0\.5 \(1 kalemde bilinmiyor\) \/ bütçe \$2/);
  assert.match(md, /\| a \| BITTI \| 1\/2 \| 30 s \| \$0\.5 \| GECTI \|/);
  assert.match(md, /\| b \| BITTI \| 1\/2 \| 1 dk \| bilinmiyor \|/);
  assert.equal(r.outcome, "in_progress");
  assert.equal(r.trace, null, "no trace given, no trace section invented");
});

test("run-report: outcome follows the record (complete, failed, interrupted, not started)", () => {
  const rec = (step_id, status, attempt = 1) => ({ step_id, attempt, status, started_at: "2026-10-15T10:00:00Z" });
  const t = (records, max = 2) => {
    const x = newTask("sonuc", [step("a", [], max), step("b", [], max)]);
    x.run.step_records = records;
    return buildReport(x).outcome;
  };
  assert.equal(t([rec("a", "BITTI"), rec("b", "BITTI")]), "complete");
  assert.equal(t([rec("a", "BASARISIZ", 2)]), "failed");
  assert.equal(t([rec("a", "BASARISIZ", 1)]), "in_progress", "a failure with attempts left is not the end");
  assert.equal(t([rec("a", "BITTI"), rec("b", "BASLADI")]), "interrupted");
  assert.equal(t([]), "not_started");
});

test("run-report: broken trace lines are skipped and counted; another run's spans are not mixed in", () => {
  const good = { span_id: "x", run_id: "kosu-r", operation: "run", name: "adim a", outcome: { status: "ok" } };
  const other = { ...good, span_id: "y", run_id: "kosu-baska" };
  const text = [JSON.stringify(good), "{yarim", "null", "7", JSON.stringify(other), JSON.stringify({ ...good, outcome: { status: "hata", error_type: "BILINMEYEN" } })].join("\n");
  const { spans, skipped } = parseTrace(text);
  assert.equal(skipped, 3);
  assert.equal(spans.length, 2, "last record of span x wins");
  const t = newTask("r", [step("a")]);
  const r = buildReport(t, text);
  assert.equal(r.trace.spans, 1);
  assert.equal(r.trace.other_run_spans, 1);
  assert.deepEqual(r.trace.errors, { BILINMEYEN: 1 });
});

test("run-report: partialSum keeps known and unknown apart", () => {
  assert.deepEqual(partialSum([1, 2.5, null, undefined, Number.NaN]), { value: 3.5, known: 2, unknown: 3 });
  assert.deepEqual(partialSum([]), { value: 0, known: 0, unknown: 0 });
});

test("run-report CLI: Markdown, --json, --kati exit 1 on an incomplete run, unreadable input 2", async () => {
  const md = cliRun([EXAMPLE]);
  assert.equal(md.code, 0, md.err);
  assert.match(md.out, /^# Koşu raporu: orkestrasyon-mimarisi/);
  assert.match(md.out, /Sonuç: \*\*yarıda kaldı \(sürdürülebilir\)\*\*/);

  const json = cliRun([EXAMPLE, "--json"]);
  assert.equal(JSON.parse(json.out).outcome, "interrupted");

  assert.equal(cliRun([EXAMPLE, "--kati"]).code, 1);

  const { recordPath, tracePath } = await realRunForCli();
  const withTrace = cliRun([recordPath, "--izler", tracePath]);
  assert.equal(withTrace.code, 0, withTrace.err);
  assert.match(withTrace.out, /## İz/);
  assert.match(withTrace.out, /İzin kararları: ALLOW 1/);

  const missing = cliRun([join(tmp, "yok.json")]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /böyle bir dosya yok/);
  const notTask = join(tmp, "gorev-degil.json");
  writeFileSync(notTask, "{}", "utf8");
  assert.equal(cliRun([notTask]).code, 2);
  assert.match(cliRun([EXAMPLE, "--izler"]).err, /--izler bir JSONL dosya yolu ister/);
});

async function realRunForCli() {
  const dir = mkdtempSync(join(tmp, "cli-"));
  const t = newTask("cli", [step("a")]);
  const tm = gorevYoneticisi({ dizin: dir });
  await tm.olustur(t);
  await tm.basladi_yaz(t, "a");
  await tm.bitti_yaz(t, "a", { result_summary: "ok", cost_usd: 0.1, evaluation_result: "GECTI" });
  const tracePath = join(dir, "kosu-cli.jsonl");
  appendFileSync(tracePath, `${JSON.stringify({ span_id: "p", run_id: "kosu-cli", operation: "permission_check", name: "permission_check ALLOW", outcome: { status: "ok" } })}\n`);
  return { recordPath: tm.kayit_yolu("cli"), tracePath };
}

test("run-report: a value cannot break out of its Markdown table cell", () => {
  const t = newTask("hucre", [step("a")]);
  t.run.step_records = [
    { step_id: "a", attempt: 1, status: "BASARISIZ", started_at: "2026-10-15T10:00:00Z", error_type: "ARAC_HATASI", error_message: "yol C:\\x\\| sonra\nyeni satir" },
  ];
  const row = toMarkdown(buildReport(t)).split("\n").find((l) => l.startsWith("| a |"));
  // 7 columns = 8 unescaped pipes; the message's "\|" must stay inside its cell.
  assert.equal(row.replace(/\\\\/g, "").replace(/\\\|/g, "").split("|").length - 1, 8, row);
  assert.match(row, /C:\\\\x\\\\\\\| sonra yeni satir/);
});