#!/usr/bin/env node
"use strict";
/**
 * plan-preview.js — dry-run preview of a task graph, before any model is called.
 *
 * WHY. The orchestrator only learns that a step will stop at a human gate, has no
 * compensation, or depends on a step that does not exist when it gets there: after
 * model calls have been paid for and side effects have run. LangGraph draws the graph
 * (`get_graph().draw_mermaid()`), Terraform prints `plan` before `apply`, CrewAI's
 * planner writes the plan into the run. This tool is the same idea for a
 * task.schema.json record: it reads the record and prints what a run WOULD do,
 * without touching the disk or the network.
 *
 * WHAT IT MIRRORS (and must keep mirroring; the tests pin each rule):
 *   - next-step order of `task-manager.sonraki_adim` (declared order, all deps BITTI,
 *     waiting steps are skipped, a failed step is retried until max_attempts),
 *   - the loop ceiling of `orchestrator.dongu` (sum of max_attempts + 1),
 *   - the stops the orchestrator would hit: `human_gate`, no deterministic evaluation
 *     (D11), side effects without `compensation.method` (recovery goes to the human
 *     gate, AP8), and an assigned agent that cannot be resolved.
 *
 * WHAT IT DOES NOT DO: it does not call the model router or the permission manager.
 * Permission decisions depend on the model's tool call, which only exists at run time;
 * the preview names the stop as "possible", never as decided.
 *
 * Exit codes: 0 plan is valid · 1 graph is invalid (cycle, unknown or duplicate id)
 * · 2 usage error or unreadable input.
 */

const fs = require("fs");
const path = require("path");

const CLOSED = new Set(["BITTI"]);
const WAITING = new Set(["GIRDI_BEKLIYOR", "ONAY_BEKLIYOR"]);

/** Last record of a step, like task-manager's `sonKayit`. */
function lastRecord(task, stepId) {
  const records = (task.run && Array.isArray(task.run.step_records) ? task.run.step_records : []).filter(
    (r) => r.step_id === stepId,
  );
  return records.length ? records[records.length - 1] : null;
}

function maxAttempts(step) {
  return (step.retry && step.retry.max_attempts) || 1;
}

/** Structural errors that would make `sonraki_adim` loop or throw. */
function validateGraph(steps) {
  const errors = [];
  const ids = new Set();
  for (const s of steps) {
    if (ids.has(s.id)) errors.push(`yinelenen adım kimliği: ${s.id}`);
    ids.add(s.id);
  }
  for (const s of steps) {
    for (const d of s.depends_on || []) {
      if (!ids.has(d)) errors.push(`${s.id} olmayan bir adıma bağlı: ${d}`);
      if (d === s.id) errors.push(`${s.id} kendisine bağlı`);
    }
  }
  // Cycle detection (DFS colouring). A cycle never becomes ready: the run would
  // end as "bitti" with steps silently never executed.
  const byId = new Map(steps.map((s) => [s.id, s]));
  const colour = new Map();
  const visit = (id, trail) => {
    colour.set(id, 1);
    for (const d of (byId.get(id) && byId.get(id).depends_on) || []) {
      if (!byId.has(d) || d === id) continue;
      if (colour.get(d) === 1) {
        const loop = [...trail.slice(trail.indexOf(d)), d];
        errors.push(`döngü: ${loop.join(" -> ")}`);
      } else if (!colour.get(d)) visit(d, [...trail, d]);
    }
    colour.set(id, 2);
  };
  for (const s of steps) if (!colour.get(s.id)) visit(s.id, [s.id]);
  return errors;
}

/** Longest-path level: steps on the same wave have no dependency between them. */
function waves(steps) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const memo = new Map();
  const level = (id) => {
    if (memo.has(id)) return memo.get(id);
    const deps = (byId.get(id).depends_on || []).filter((d) => byId.has(d));
    const l = deps.length ? Math.max(...deps.map(level)) + 1 : 0;
    memo.set(id, l);
    return l;
  };
  return new Map(steps.map((s) => [s.id, level(s.id)]));
}

/**
 * State of one step from the record, in the words of task-manager:
 * done | waiting | exhausted | retry | interrupted | pending.
 */
function stepState(step, rec) {
  if (!rec) return "pending";
  if (CLOSED.has(rec.status)) return "done";
  if (WAITING.has(rec.status)) return "waiting";
  if (rec.status === "BASARISIZ") return rec.attempt >= maxAttempts(step) ? "exhausted" : "retry";
  return "interrupted"; // BASLADI: process died between the two writes (ADR-003)
}

/**
 * Simulated order if every remaining step passes on its first attempt: the same
 * choice `sonraki_adim` makes, repeated. Waiting and exhausted steps block their
 * dependents, exactly as in a real run.
 */
function simulateOrder(steps, states) {
  const done = new Set(steps.filter((s) => states.get(s.id) === "done").map((s) => s.id));
  const blocked = new Set(
    steps.filter((s) => ["waiting", "exhausted"].includes(states.get(s.id))).map((s) => s.id),
  );
  const order = [];
  for (;;) {
    const next = steps.find(
      (s) => !done.has(s.id) && !blocked.has(s.id) && (s.depends_on || []).every((d) => done.has(d)),
    );
    if (!next) break;
    order.push(next.id);
    done.add(next.id);
  }
  const unreachable = steps
    .filter((s) => !done.has(s.id) && !blocked.has(s.id))
    .map((s) => s.id);
  return { order, unreachable };
}

/** Agent contracts from a directory, as the registry would list them. */
function loadAgents(dir) {
  const agents = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    if (doc && doc.identity && doc.identity.id) agents.push(doc);
  }
  return agents;
}

/** Same rule as orchestrator `ajanSec`: explicit agent id, else first active by role. */
function resolveAgent(step, agents) {
  const a = step.assign || {};
  if (a.mode === "agent" && a.agent_id) return agents.find((x) => x.identity.id === a.agent_id) || null;
  return agents.find((x) => x.role && x.role.kind === a.role && x.identity.status === "active") || null;
}

/** Stops the orchestrator would or could hit for this step. */
function stopsFor(step, agent, agentsGiven) {
  const stops = [];
  if (step.human_gate === true) stops.push({ kind: "human_gate", certain: true, note: "human_gate: true — onaysız ilerlemez" });
  const ev = step.evaluation || {};
  if (ev.method !== "deterministic" || !ev.checker) {
    stops.push({ kind: "not_evaluated", certain: true, note: "deterministik denetleyici yok — D11: DEGERLENDIRILMEDI, ONAY_BEKLIYOR'a düşer" });
  }
  if (step.side_effects && !(step.compensation && step.compensation.method)) {
    stops.push({ kind: "no_compensation", certain: false, note: "yan etkili ama telafi tanımsız — hata olursa kurtarma insan kapısına gider (AP8)" });
  }
  if (agentsGiven && !agent) {
    stops.push({ kind: "agent_missing", certain: true, note: "atanan ajan bulunamadı — BAGIMLILIK_BASARISIZ" });
  }
  return stops;
}

/** Pure core: task record (+ optional agent contracts) -> plan object. */
function buildPlan(task, agents = null) {
  const steps = (task && task.graph && Array.isArray(task.graph.steps) ? task.graph.steps : []).map((s) => ({
    ...s,
    depends_on: Array.isArray(s.depends_on) ? s.depends_on : [],
  }));
  const errors = steps.length ? validateGraph(steps) : ["görev grafında adım yok (graph.steps)"];
  const plan = {
    task_id: task && task.task ? task.task.id : null,
    title: task && task.task ? task.task.title : null,
    run_id: task && task.run ? task.run.run_id || null : null,
    valid: errors.length === 0,
    errors,
    steps: [],
    order: [],
    unreachable: [],
    next_step: null,
    max_model_calls: null,
    budget: task && task.task && task.task.budget ? task.task.budget : null,
  };
  if (!plan.valid) return plan;

  const lv = waves(steps);
  const states = new Map(steps.map((s) => [s.id, stepState(s, lastRecord(task, s.id))]));
  const sim = simulateOrder(steps, states);
  plan.order = sim.order;
  plan.unreachable = sim.unreachable;
  plan.next_step = sim.order[0] || null;
  // Orchestrator loop ceiling counts every step; the calls still possible exclude done ones.
  plan.loop_ceiling = steps.reduce((n, s) => n + maxAttempts(s), 0) + 1;
  plan.max_model_calls = steps
    .filter((s) => !["done", "waiting", "exhausted"].includes(states.get(s.id)))
    .reduce((n, s) => {
      const rec = lastRecord(task, s.id);
      const used = rec && rec.status === "BASARISIZ" ? rec.attempt : rec ? rec.attempt - 1 : 0;
      return n + Math.max(maxAttempts(s) - used, 0);
    }, 0);

  for (const s of steps) {
    const agent = agents ? resolveAgent(s, agents) : null;
    const a = s.assign || {};
    plan.steps.push({
      id: s.id,
      title: s.title || "",
      wave: lv.get(s.id),
      depends_on: s.depends_on,
      state: states.get(s.id),
      assign: a.mode === "agent" ? `ajan:${a.agent_id}` : `rol:${a.role || "?"}`,
      agent: agent ? agent.identity.id : null,
      needs_tool_calling: Boolean(agent && Array.isArray(agent.tools) && agent.tools.length > 0),
      max_attempts: maxAttempts(s),
      side_effects: Boolean(s.side_effects),
      writes: Array.isArray(s.writes) ? s.writes : [],
      stops: ["done"].includes(states.get(s.id)) ? [] : stopsFor(s, agent, Boolean(agents)),
    });
  }
  return plan;
}

const STATE_LABEL = {
  done: "tamamlandı (atlanır)",
  waiting: "bekliyor (onay/girdi)",
  exhausted: "hakkı bitti",
  retry: "yeniden denenecek",
  interrupted: "yarıda kaldı (sürdürülür)",
  pending: "bekleyen",
};

function toText(plan) {
  const out = [];
  out.push(`Plan önizleme: ${plan.task_id || "?"}${plan.title ? ` — ${plan.title}` : ""}`);
  if (plan.run_id) out.push(`Koşu: ${plan.run_id}`);
  if (!plan.valid) {
    out.push("", `GEÇERSİZ graf: ${plan.errors.length} sorun`);
    for (const e of plan.errors) out.push(`  - ${e}`);
    return out.join("\n");
  }
  out.push("");
  const maxWave = Math.max(...plan.steps.map((s) => s.wave));
  for (let w = 0; w <= maxWave; w += 1) {
    out.push(`Dalga ${w + 1}`);
    for (const s of plan.steps.filter((x) => x.wave === w)) {
      const who = s.agent ? `${s.assign} -> ${s.agent}` : s.assign;
      out.push(`  ${s.id}  [${STATE_LABEL[s.state]}]  ${who}  deneme≤${s.max_attempts}${s.side_effects ? "  yan-etki" : ""}`);
      for (const st of s.stops) out.push(`      ${st.certain ? "DURUR" : "olası durak"}: ${st.note}`);
    }
  }
  out.push("");
  out.push(`Sıra (her adım ilk denemede geçerse): ${plan.order.length ? plan.order.join(" -> ") : "(çalışacak adım yok)"}`);
  if (plan.unreachable.length) out.push(`Bu koşuda ulaşılamaz (bekleyen/tükenen adıma bağlı): ${plan.unreachable.join(", ")}`);
  out.push(`Sıradaki adım: ${plan.next_step || "yok"}`);
  out.push(`En çok model çağrısı (kalan deneme hakları): ${plan.max_model_calls}; döngü tavanı ${plan.loop_ceiling}`);
  if (plan.budget) {
    const spent = plan.budget.spent_usd === null || plan.budget.spent_usd === undefined ? "ölçülmedi" : `$${plan.budget.spent_usd}`;
    out.push(`Bütçe: en çok $${plan.budget.max_usd} (aşılırsa: ${plan.budget.on_exceed}); harcanan: ${spent}`);
  }
  const certain = plan.steps.filter((s) => s.stops.some((x) => x.certain)).map((s) => s.id);
  out.push(certain.length ? `Kesin duraklar: ${certain.join(", ")}` : "Kesin durak yok.");
  out.push("Not: izin kararları modelin araç çağrısına bağlı, önizlemede verilmez.");
  return out.join("\n");
}

/**
 * Mermaid flowchart. Node ids are positional (s0, s1, ...): a kebab_id such as
 * `end` or `graph` is a Mermaid keyword, so the step id goes into the label only.
 */
function toMermaid(plan) {
  const node = new Map(plan.steps.map((s, i) => [s.id, `s${i}`]));
  const out = ["flowchart TD"];
  for (const s of plan.steps) {
    const label = `${s.id}<br/>${STATE_LABEL[s.state]}`.replace(/"/g, "'");
    out.push(`  ${node.get(s.id)}["${label}"]:::${s.state}`);
  }
  for (const s of plan.steps) for (const d of s.depends_on) out.push(`  ${node.get(d)} --> ${node.get(s.id)}`);
  out.push("  classDef done fill:#1f3d2b,stroke:#4ade9e;");
  out.push("  classDef waiting fill:#3d331f,stroke:#c9a961;");
  out.push("  classDef exhausted fill:#3d1f1f,stroke:#e85757;");
  out.push("  classDef retry fill:#3d2a1f,stroke:#e8a057;");
  out.push("  classDef interrupted fill:#2a1f3d,stroke:#a57be8;");
  out.push("  classDef pending fill:#1f2a3d,stroke:#6cb6ff;");
  return out.join("\n");
}

const HELP = `
plan-preview.js — bir görev kaydının kuru-koşu önizlemesi (model çağrılmaz, diske yazılmaz)

Kullanım: node arac/plan-preview.js <gorev.json> [--ajanlar <klasör>] [--json | --mermaid]

  <gorev.json>        task.schema.json biçiminde görev kaydı (yarım kalmış koşu da olur)
  --ajanlar <klasör>  ajan sözleşmeleri; verilirse atamalar çözülür, bulunamayan ajan durak sayılır
  --json              makine-okur plan nesnesi
  --mermaid           Mermaid akış şeması (README/PR içine yapıştırılabilir)

Gösterir: dalgalar (aralarında bağımlılık olmayan adımlar), her adımın durumu, sıradaki
adım, tüm adımlar geçerse yürütme sırası, kesin ve olası duraklar (human_gate, D11,
telafisiz yan etki, bulunamayan ajan), kalan en çok model çağrısı ve bütçe.

Çıkış kodu: 0 plan geçerli · 1 graf geçersiz (döngü, olmayan ya da yinelenen kimlik) · 2 kullanım hatası ya da girdi okunamadı
`;

function main() {
  const { cli } = require("./_cli.js");
  const args = cli({ ad: "plan-preview.js", yardim: HELP, bayraklar: ["--ajanlar", "--json", "--mermaid"] });
  const fail = (msg) => {
    console.error(`hata: ${msg}`);
    console.error("Yardım: node arac/plan-preview.js --help");
    process.exit(2);
  };
  let agentsDir = null;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--ajanlar") {
      agentsDir = args[i + 1];
      if (!agentsDir || agentsDir.startsWith("-")) fail("--ajanlar bir klasör yolu ister");
      i += 1;
    } else if (!args[i].startsWith("-")) positional.push(args[i]);
  }
  if (args.includes("--json") && args.includes("--mermaid")) fail("--json ve --mermaid birlikte verilmez");
  if (positional.length !== 1) fail("tek bir görev kaydı (json) verin");

  let task;
  try {
    task = JSON.parse(fs.readFileSync(positional[0], "utf8"));
  } catch (e) {
    fail(e.code === "ENOENT" ? `${positional[0]} okunamadı — böyle bir dosya yok` : `${positional[0]} okunamadı: ${e.message}`);
  }
  let agents = null;
  if (agentsDir) {
    try {
      agents = loadAgents(agentsDir);
    } catch (e) {
      fail(`${agentsDir} okunamadı: ${e.message}`);
    }
  }
  const plan = buildPlan(task, agents);
  if (args.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else if (args.includes("--mermaid")) {
    if (plan.valid) console.log(toMermaid(plan));
    else console.error(toText(plan));
  } else (plan.valid ? console.log : console.error)(toText(plan));
  process.exit(plan.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { buildPlan, validateGraph, simulateOrder, toText, toMermaid, stepState };
