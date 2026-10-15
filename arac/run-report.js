#!/usr/bin/env node
"use strict";
/**
 * run-report.js — structured report of one run, from the task record and its trace.
 *
 * WHY. After a run the evidence is on disk in two shapes: the task record
 * (task.schema.json, one record per attempt) and the trace (one JSONL line per span,
 * span.schema.json). Answering "what happened, what did it cost, where is it
 * waiting" meant reading both by hand. Langfuse and LangSmith show this as a run
 * summary, the OpenAI Agents SDK as a trace view; all of them need a server. This
 * tool reads the two files and writes the same summary as Markdown (for a PR or a
 * log) or JSON (for another tool), with no network and no dependency.
 *
 * HONESTY RULES (the same ones the modules keep):
 *   - Unknown is not zero (AP10). A step whose `cost_usd` is null makes the total
 *     cost a lower bound ("at least"), never a sum that pretends to be complete.
 *     The same holds for durations and token counts.
 *   - The trace is read like `observability.kosu_izleri`: the last record of a
 *     span_id wins and broken lines are skipped and counted, not fatal.
 *   - A span still marked "kesildi" is reported as interrupted, not dropped.
 *
 * Exit codes: 0 report written · 1 with --kati, the run is not complete
 * · 2 usage error or unreadable input.
 */

const fs = require("fs");

const OUTCOME_LABEL = {
  complete: "tamamlandı",
  waiting: "onay/girdi bekliyor",
  failed: "başarısız (deneme hakkı bitti)",
  interrupted: "yarıda kaldı (sürdürülebilir)",
  in_progress: "sürüyor",
  not_started: "başlamadı",
};

function durationMs(start, end) {
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

/** Sum that knows how many terms were unknown: {value, unknown, known}. */
function partialSum(values) {
  let value = 0;
  let unknown = 0;
  let known = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      value += v;
      known += 1;
    } else unknown += 1;
  }
  return { value: Math.round(value * 1e6) / 1e6, known, unknown };
}

/** Same reading rule as observability.kosu_izleri, plus a count of skipped lines. */
function parseTrace(text) {
  const last = new Map();
  let skipped = 0;
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    let span;
    try {
      span = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (!span || typeof span !== "object" || Array.isArray(span) || typeof span.span_id !== "string") {
      skipped += 1;
      continue;
    }
    last.set(span.span_id, span);
  }
  return { spans: [...last.values()], skipped };
}

function summarizeSteps(task) {
  const steps = (task.graph && Array.isArray(task.graph.steps) ? task.graph.steps : []);
  const records = task.run && Array.isArray(task.run.step_records) ? task.run.step_records : [];
  return steps.map((step) => {
    const mine = records.filter((r) => r.step_id === step.id);
    const final = mine.length ? mine[mine.length - 1] : null;
    const max = (step.retry && step.retry.max_attempts) || 1;
    let status = final ? final.status : "BASLAMADI";
    if (final && final.status === "BASARISIZ" && final.attempt < max) status = "BASARISIZ (yeniden denenecek)";
    return {
      id: step.id,
      title: step.title || "",
      status,
      attempts: mine.length ? Math.max(...mine.map((r) => r.attempt || 1)) : 0,
      max_attempts: max,
      duration_ms: final ? durationMs(final.started_at, final.ended_at) : null,
      cost_usd: final && typeof final.cost_usd === "number" ? final.cost_usd : null,
      cost_known: Boolean(final && typeof final.cost_usd === "number"),
      evaluation_result: final ? final.evaluation_result || null : null,
      approval_ref: final ? final.approval_ref || null : null,
      error_type: final ? final.error_type || null : null,
      error_message: final ? final.error_message || null : null,
      artifacts: final && Array.isArray(final.artifacts) ? final.artifacts : [],
      _exhausted: Boolean(final && final.status === "BASARISIZ" && final.attempt >= max),
    };
  });
}

function runOutcome(steps) {
  if (steps.length && steps.every((s) => s.status === "BITTI")) return "complete";
  if (steps.some((s) => s.status === "ONAY_BEKLIYOR" || s.status === "GIRDI_BEKLIYOR")) return "waiting";
  if (steps.some((s) => s._exhausted)) return "failed";
  if (steps.some((s) => s.status === "BASLADI")) return "interrupted";
  if (steps.some((s) => s.status !== "BASLAMADI")) return "in_progress";
  return "not_started";
}

function summarizeTrace(spans) {
  const byModel = new Map();
  const permissions = {};
  const recoveries = {};
  const errors = {};
  let interrupted = 0;
  for (const s of spans) {
    const outcome = s.outcome || {};
    if (outcome.status === "kesildi") interrupted += 1;
    if (outcome.status === "hata" && outcome.error_type) errors[outcome.error_type] = (errors[outcome.error_type] || 0) + 1;
    if (s.operation === "inference") {
      const key = s.model && s.model.name ? s.model.name : "bilinmiyor";
      if (!byModel.has(key)) byModel.set(key, { calls: 0, input: [], output: [], usd: [] });
      const m = byModel.get(key);
      m.calls += 1;
      m.input.push(s.usage ? s.usage.input_tokens : null);
      m.output.push(s.usage ? s.usage.output_tokens : null);
      m.usd.push(s.cost ? s.cost.usd : null);
    }
    // The orchestrator names these spans "<operation> <decision|mode>".
    const word = typeof s.name === "string" ? s.name.split(" ").slice(1).join(" ") : "";
    if (s.operation === "permission_check" && word) permissions[word] = (permissions[word] || 0) + 1;
    if (s.operation === "recovery" && word) recoveries[word] = (recoveries[word] || 0) + 1;
  }
  const models = [...byModel.entries()].map(([name, m]) => ({
    model: name,
    calls: m.calls,
    input_tokens: partialSum(m.input),
    output_tokens: partialSum(m.output),
    cost_usd: partialSum(m.usd),
  }));
  return { spans: spans.length, interrupted, models, permissions, recoveries, errors };
}

/** Pure core: task record (+ optional trace text) -> report object. */
function buildReport(task, traceText = null) {
  const steps = summarizeSteps(task);
  const outcome = runOutcome(steps);
  const touched = steps.filter((s) => s.status !== "BASLAMADI");
  const report = {
    task_id: task.task ? task.task.id : null,
    title: task.task ? task.task.title : null,
    run_id: task.run ? task.run.run_id || null : null,
    started_at: task.run ? task.run.started_at || null : null,
    outcome,
    counts: steps.reduce((acc, s) => ((acc[s.status] = (acc[s.status] || 0) + 1), acc), {}),
    cost_usd: partialSum(touched.map((s) => s.cost_usd)),
    budget: task.task && task.task.budget ? task.task.budget : null,
    waiting: steps
      .filter((s) => s.status === "ONAY_BEKLIYOR" || s.status === "GIRDI_BEKLIYOR")
      .map((s) => ({ step_id: s.id, status: s.status, approval_ref: s.approval_ref })),
    steps: steps.map(({ _exhausted, ...rest }) => rest),
    trace: null,
  };
  if (traceText !== null) {
    const { spans, skipped } = parseTrace(traceText);
    const mine = report.run_id ? spans.filter((s) => s.run_id === report.run_id) : spans;
    report.trace = { ...summarizeTrace(mine), skipped_lines: skipped, other_run_spans: spans.length - mine.length };
  }
  return report;
}

function money(sum) {
  if (sum.known === 0) return sum.unknown ? "bilinmiyor" : "$0";
  const v = `$${sum.value}`;
  return sum.unknown ? `en az ${v} (${sum.unknown} kalemde bilinmiyor)` : v;
}

function count(sum) {
  if (sum.known === 0) return sum.unknown ? "bilinmiyor" : "0";
  return sum.unknown ? `≥${sum.value}` : String(sum.value);
}

function ms(v) {
  if (v === null) return "ölçülmedi";
  return v >= 60000 ? `${Math.round(v / 6000) / 10} dk` : `${Math.round(v / 100) / 10} s`;
}

const cell = (v) => String(v === null || v === undefined || v === "" ? "—" : v).replace(/\|/g, "\\|").replace(/\n/g, " ");

function toMarkdown(r) {
  const out = [];
  out.push(`# Koşu raporu: ${r.task_id || "?"}${r.title ? ` — ${r.title}` : ""}`, "");
  out.push(`- Koşu: \`${r.run_id || "?"}\`${r.started_at ? ` (başladı ${r.started_at})` : ""}`);
  out.push(`- Sonuç: **${OUTCOME_LABEL[r.outcome]}**`);
  out.push(`- Maliyet: ${money(r.cost_usd)}${r.budget && r.budget.max_usd !== undefined ? ` / bütçe $${r.budget.max_usd}` : ""}`);
  const c = Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(", ");
  out.push(`- Adımlar: ${c || "yok"}`, "");
  if (r.waiting.length) {
    out.push("## Bekleyenler", "");
    for (const w of r.waiting) out.push(`- \`${w.step_id}\` ${w.status}${w.approval_ref ? ` — onay kaydı \`${w.approval_ref}\`` : ""}`);
    out.push("");
  }
  out.push("## Adımlar", "");
  out.push("| Adım | Durum | Deneme | Süre | Maliyet | Değerlendirme | Hata / onay |");
  out.push("|---|---|---|---|---|---|---|");
  for (const s of r.steps) {
    const note = s.error_type ? `${s.error_type}${s.error_message ? `: ${s.error_message.slice(0, 120)}` : ""}` : s.approval_ref;
    out.push(
      `| ${cell(s.id)} | ${cell(s.status)} | ${s.attempts}/${s.max_attempts} | ${cell(s.status === "BASLAMADI" ? null : ms(s.duration_ms))} | ${cell(s.status === "BASLAMADI" ? null : s.cost_known ? `$${s.cost_usd}` : "bilinmiyor")} | ${cell(s.evaluation_result)} | ${cell(note)} |`,
    );
  }
  if (r.trace) {
    const t = r.trace;
    out.push("", "## İz", "");
    out.push(`- ${t.spans} span${t.interrupted ? `, ${t.interrupted} tanesi kesildi (süreç ortada öldü)` : ""}${t.skipped_lines ? `; ${t.skipped_lines} bozuk satır atlandı` : ""}${t.other_run_spans ? `; başka koşuya ait ${t.other_run_spans} span sayılmadı` : ""}`);
    const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ");
    if (Object.keys(t.permissions).length) out.push(`- İzin kararları: ${fmt(t.permissions)}`);
    if (Object.keys(t.recoveries).length) out.push(`- Kurtarma: ${fmt(t.recoveries)}`);
    if (Object.keys(t.errors).length) out.push(`- Hatalar: ${fmt(t.errors)}`);
    if (t.models.length) {
      out.push("", "| Model | Çağrı | Girdi token | Çıktı token | Maliyet |", "|---|---|---|---|---|");
      for (const m of t.models) {
        out.push(`| ${cell(m.model)} | ${m.calls} | ${count(m.input_tokens)} | ${count(m.output_tokens)} | ${money(m.cost_usd)} |`);
      }
    }
  }
  return out.join("\n");
}

const HELP = `
run-report.js — bir koşunun yapılandırılmış raporu: görev kaydı + iz (span JSONL)

Kullanım: node arac/run-report.js <gorev.json> [--izler <kosu.jsonl>] [--json] [--kati]

  <gorev.json>          task.schema.json biçiminde görev kaydı (task-manager'ın yazdığı dosya)
  --izler <kosu.jsonl>  observability'nin yazdığı iz; verilirse model/token/izin/kurtarma özeti eklenir
  --json                Markdown yerine makine-okur rapor
  --kati                koşu tamamlanmadıysa 1 ile çık (CI'da "koşu bitti mi" kapısı)

Bilinmeyen sıfır sayılmaz: maliyeti ya da süresi ölçülmemiş adım toplamı "en az" yapar.

Çıkış kodu: 0 rapor yazıldı · 1 --kati ile koşu tamamlanmadı · 2 kullanım hatası ya da girdi okunamadı
`;

function main() {
  const { cli } = require("./_cli.js");
  const args = cli({ ad: "run-report.js", yardim: HELP, bayraklar: ["--izler", "--json", "--kati"] });
  const fail = (msg) => {
    console.error(`hata: ${msg}`);
    console.error("Yardım: node arac/run-report.js --help");
    process.exit(2);
  };
  let tracePath = null;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--izler") {
      tracePath = args[i + 1];
      if (!tracePath || tracePath.startsWith("-")) fail("--izler bir JSONL dosya yolu ister");
      i += 1;
    } else if (!args[i].startsWith("-")) positional.push(args[i]);
  }
  if (positional.length !== 1) fail("tek bir görev kaydı (json) verin");
  const read = (p) => {
    try {
      return fs.readFileSync(p, "utf8");
    } catch (e) {
      return fail(e.code === "ENOENT" ? `${p} okunamadı — böyle bir dosya yok` : `${p} okunamadı: ${e.message}`);
    }
  };
  let task;
  try {
    task = JSON.parse(read(positional[0]));
  } catch (e) {
    fail(`${positional[0]} geçerli JSON değil: ${e.message}`);
  }
  if (!task || typeof task !== "object" || !task.graph) fail(`${positional[0]} bir görev kaydı değil (graph yok)`);
  const report = buildReport(task, tracePath ? read(tracePath) : null);
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : toMarkdown(report));
  process.exit(args.includes("--kati") && report.outcome !== "complete" ? 1 : 0);
}

if (require.main === module) main();

module.exports = { buildReport, parseTrace, partialSum, toMarkdown };
