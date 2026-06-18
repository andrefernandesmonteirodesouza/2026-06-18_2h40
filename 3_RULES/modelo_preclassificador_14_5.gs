/**
 * 📂 ARQUIVO: 3_RULES/modelo_preclassificador_14_5.gs
 * 🧠 MÓDULO: MODELO ANTES DO GEMINI
 * 🔢 VERSÃO: 14.5.0
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Usar a CFG_Modelo_Classificacao para sugerir categorias antes do Gemini.
 *
 * O modelo próprio não aprova nada.
 * Ele apenas grava MODELO_FORTE/MEDIO/FRACO/BAIXO/BLOQUEADO.
 * -----------------------------------------------------------------------------
 */

const GFP_PREMODEL_PROP_14_5 = "GFP_ENABLE_MODELO_PRECLASSIFICADOR_14_5";
const GFP_PREMODEL_DB_SHEET_14_5 = "DB_TRANSACOES";
const GFP_PREMODEL_MODEL_SHEET_14_5 = "CFG_Modelo_Classificacao";
const GFP_PREMODEL_PATCH_14_5 = "14.5.0";

/**
 * Liga o preclassificador.
 */
function GFP_ENABLE_MODELO_PRECLASSIFICADOR_14_5() {
  PropertiesService.getScriptProperties().setProperty(GFP_PREMODEL_PROP_14_5, "TRUE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Modelo antes do Gemini ATIVADO.",
    "GFP 14.5"
  );

  Logger.log("[GFP_ENABLE_MODELO_PRECLASSIFICADOR_14_5] Ativado.");

  return { enabled: true };
}

/**
 * Desliga o preclassificador.
 */
function GFP_DISABLE_MODELO_PRECLASSIFICADOR_14_5() {
  PropertiesService.getScriptProperties().setProperty(GFP_PREMODEL_PROP_14_5, "FALSE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Modelo antes do Gemini DESATIVADO.",
    "GFP 14.5"
  );

  Logger.log("[GFP_DISABLE_MODELO_PRECLASSIFICADOR_14_5] Desativado.");

  return { enabled: false };
}

/**
 * Status do preclassificador.
 */
function GFP_STATUS_MODELO_PRECLASSIFICADOR_14_5() {
  return {
    enabled: GFP_MODELO_PRECLASSIFICADOR_IS_ENABLED_14_5(),
    property: GFP_PREMODEL_PROP_14_5
  };
}

/**
 * Helper público para outros módulos.
 */
function GFP_MODELO_PRECLASSIFICADOR_IS_ENABLED_14_5() {
  return String(
    PropertiesService.getScriptProperties().getProperty(GFP_PREMODEL_PROP_14_5) || ""
  ).toUpperCase() === "TRUE";
}

/**
 * DRY-RUN.
 */
function GFP_MODELO_PRECLASSIFICAR_PENDENTES_DRYRUN_14_5(limit) {
  return GFP_MODELO_PRECLASSIFICAR_PENDENTES_14_5_(limit || 100, true);
}

/**
 * APPLY.
 */
function GFP_MODELO_PRECLASSIFICAR_PENDENTES_APPLY_14_5(limit) {
  return GFP_MODELO_PRECLASSIFICAR_PENDENTES_14_5_(limit || 100, false);
}

/**
 * Núcleo.
 */
function GFP_MODELO_PRECLASSIFICAR_PENDENTES_14_5_(limit, dryRun) {
  const fn = "GFP_MODELO_PRECLASSIFICAR_PENDENTES_14_5_";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_PREMODEL_DB_SHEET_14_5);
  const modelSheet = ss.getSheetByName(GFP_PREMODEL_MODEL_SHEET_14_5);

  if (!db) throw new Error("Aba DB_TRANSACOES não encontrada.");
  if (!modelSheet) throw new Error("Aba CFG_Modelo_Classificacao não encontrada.");

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const model = GFP_PREMODEL_loadModel_14_5_(modelSheet);

  const lastRow = db.getLastRow();
  if (lastRow < 2) {
    return { dryRun: !!dryRun, scanned: 0, candidates: 0, suggestions: 0 };
  }

  const values = db.getRange(2, 1, lastRow - 1, 14).getValues();

  const suggestions = [];

  values.forEach((row, idx) => {
    if (suggestions.length >= safeLimit) return;

    const sheetRow = idx + 2;

    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "").trim();
    const categoriaAtual = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const notas = String(row[9] || "").trim();
    const meta = GFP_PREMODEL_parseJson_14_5_(row[13]);

    if (!descricao) return;
    if (tipo === "T" || tipo === "S") return;

    if (!GFP_PREMODEL_isEligibleRow_14_5_(status, categoriaAtual)) return;

    const match = GFP_PREMODEL_findBestModelMatch_14_5_(model, descricao, conta, tipo);
    if (!match) return;

    const decision = GFP_PREMODEL_buildDecision_14_5_({
      row: sheetRow,
      descricao: descricao,
      conta: conta,
      tipo: tipo,
      categoriaAtual: categoriaAtual,
      statusAtual: status,
      notas: notas,
      meta: meta,
      match: match
    });

    if (!decision || !decision.shouldSuggest) return;

    suggestions.push(decision);
  });

  Logger.log(`[${fn}] ${dryRun ? "DRY-RUN" : "APPLY"} | sugestões=${suggestions.length} | limite=${safeLimit}`);

  suggestions.forEach(s => {
    Logger.log(
      `[${fn}] ${dryRun ? "[DRY]" : "[APPLY]"} linha=${s.row} | ` +
      `${s.statusAtual || "(vazio)"} → ${s.statusNovo} | ` +
      `cat atual='${s.categoriaAtual || ""}' | cat modelo='${s.categoriaNova || ""}' | ` +
      `score=${s.model.score} | faixa=${s.model.faixa} | match=${s.matchScore}`
    );
  });

  if (!dryRun) {
    suggestions.forEach(s => {
      const row = s.row;

      if (s.writeCategory) {
        db.getRange(row, 6).setValue(s.categoriaNova);
      } else if (s.clearCategory) {
        db.getRange(row, 6).clearContent();
      }

      db.getRange(row, 9).setValue(s.statusNovo);
      db.getRange(row, 10).setValue(s.noteShort);
      db.getRange(row, 10).setNote(s.noteFull);
      db.getRange(row, 14).setValue(JSON.stringify(s.metaNova));
    });

    GFP_PREMODEL_afterApply_14_5_();
  }

  return {
    dryRun: !!dryRun,
    scanned: values.length,
    suggestions: suggestions.length,
    examples: suggestions.slice(0, 50)
  };
}

/**
 * Integração chamável pelo Gemini fallback.
 *
 * Só roda se estiver ativado.
 */
function GFP_MODELO_PRECLASSIFICAR_MAYBE_APPLY_14_5(limit, origem) {
  if (!GFP_MODELO_PRECLASSIFICADOR_IS_ENABLED_14_5()) {
    return {
      skipped: true,
      reason: "disabled",
      origem: origem || ""
    };
  }

  try {
    const result = GFP_MODELO_PRECLASSIFICAR_PENDENTES_APPLY_14_5(limit || 100);
    return {
      skipped: false,
      origem: origem || "",
      result: result
    };
  } catch (e) {
    Logger.warn("[GFP 14.5] Falha no preclassificador: " + e.message);

    return {
      skipped: true,
      reason: "error",
      error: e.message,
      origem: origem || ""
    };
  }
}

/**
 * Carrega CFG_Modelo_Classificacao.
 */
function GFP_PREMODEL_loadModel_14_5_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 20).getValues();

  return values.map(row => {
    return {
      chave: String(row[0] || "").trim(),
      padraoOriginal: String(row[1] || "").trim(),
      conta: String(row[2] || "*").trim() || "*",
      tipo: String(row[3] || "*").trim().toUpperCase() || "*",
      categoria: String(row[4] || "").trim(),
      negadas: GFP_PREMODEL_parseList_14_5_(row[5]),
      acertos: Number(row[6] || 0),
      erros: Number(row[7] || 0),
      score: Number(row[8] || 0),
      faixa: String(row[9] || "").trim().toUpperCase(),
      statusModelo: String(row[10] || "").trim().toUpperCase(),
      origemPrincipal: String(row[11] || "").trim(),
      origens: String(row[12] || "").trim(),
      exemploDescricao: String(row[17] || "").trim(),
      observacoes: String(row[18] || "").trim(),
      hash: String(row[19] || "").trim()
    };
  }).filter(m => m.chave && m.categoria);
}

/**
 * Elegibilidade.
 */
function GFP_PREMODEL_isEligibleRow_14_5_(status, categoriaAtual) {
  const s = String(status || "").trim().toUpperCase();
  const cat = String(categoriaAtual || "").trim();

  if (GFP_PREMODEL_isResolvedStatus_14_5_(s)) return false;

  // Não brigar com sugestões já existentes. Essas são papel do recalibrador 14.4.
  if (s.indexOf("GEMINI_") === 0) return false;
  if (s.indexOf("MODELO_") === 0) return false;

  // Se já tem categoria válida e não genérica, é pendência categorizada.
  // O fluxo de checkbox 14.3.1 cuida.
  if (GFP_PREMODEL_isCategory_14_5_(cat) && !GFP_PREMODEL_isGenericCategory_14_5_(cat)) {
    return false;
  }

  // Pode classificar vazio/genérico/pendente.
  if (!s) return true;
  if (s === "FALSE") return true;
  if (s === "PENDENTE") return true;
  if (s === "REVISAR") return true;
  if (s === "A REVISAR") return true;
  if (s === "EM REVISAO" || s === "EM REVISÃO") return true;
  if (s === "PENDENTE_CATEGORIZADA" && GFP_PREMODEL_isGenericCategory_14_5_(cat)) return true;

  return false;
}

function GFP_PREMODEL_findBestModelMatch_14_5_(model, descricao, conta, tipo) {
  const key = GFP_PREMODEL_normalizeKey_14_5_(descricao);
  const contaNorm = String(conta || "*").trim() || "*";
  const tipoNorm = String(tipo || "*").trim().toUpperCase() || "*";

  if (!key) return null;

  const candidates = [];

  model.forEach(m => {
    let matchScore = 0;

    if (m.chave === key) {
      matchScore += 100;
    } else if (key.indexOf(m.chave) >= 0 && m.chave.length >= 8) {
      matchScore += 75;
    } else if (m.chave.indexOf(key) >= 0 && key.length >= 8) {
      matchScore += 65;
    } else {
      return;
    }

    if (m.conta === contaNorm) matchScore += 15;
    else if (m.conta === "*") matchScore += 5;
    else matchScore -= 10;

    if (m.tipo === tipoNorm) matchScore += 15;
    else if (m.tipo === "*") matchScore += 5;
    else matchScore -= 10;

    matchScore += Math.min(25, Number(m.acertos || 0) * 2);
    matchScore -= Math.min(25, Number(m.erros || 0) * 3);

    candidates.push({
      model: m,
      matchScore: matchScore
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.matchScore - a.matchScore);

  const best = candidates[0];

  // Mais conservador que o recalibrador: só sugerir se o match for bom.
  if (best.matchScore < 85) return null;

  const out = best.model;
  out._matchScore = best.matchScore;

  return out;
}

function GFP_PREMODEL_buildDecision_14_5_(ctx) {
  const m = ctx.match;

  const categoriaModelo = String(m.categoria || "").trim();
  const categoriaAtual = String(ctx.categoriaAtual || "").trim();

  if (!GFP_PREMODEL_isCategory_14_5_(categoriaModelo)) return null;

  const faixa = String(m.faixa || "").toUpperCase();
  const statusModelo = String(m.statusModelo || "").toUpperCase();
  const score = Number(m.score || 0);
  const acertos = Number(m.acertos || 0);
  const erros = Number(m.erros || 0);

  const blocked =
    statusModelo === "BLOQUEADA" ||
    faixa === "BLOQUEADA" ||
    (acertos === 0 && erros >= 3);

  let statusNovo = "";
  let writeCategory = false;
  let clearCategory = false;

  if (blocked) {
    statusNovo = "MODELO_BLOQUEADO";
    writeCategory = false;
    clearCategory = false;
  } else if (score >= 95 && acertos >= 1) {
    statusNovo = "MODELO_FORTE";
    writeCategory = true;
  } else if (score >= 80 && acertos >= 1) {
    statusNovo = "MODELO_MEDIO";
    writeCategory = true;
  } else if (score >= 60 && acertos >= 1) {
    statusNovo = "MODELO_FRACO";
    writeCategory = true;
  } else {
    statusNovo = "MODELO_BAIXO";
    writeCategory = false;
    clearCategory = GFP_PREMODEL_isGenericCategory_14_5_(categoriaAtual);
  }

  const meta = ctx.meta || {};
  if (!meta.classificationParams) meta.classificationParams = {};

  const cp = meta.classificationParams;

  cp.source = "MODELO_PRECLASSIFICADOR";
  cp.status = statusNovo;
  cp.confidence = score;
  cp.faixa = faixa || GFP_PREMODEL_statusToFaixa_14_5_(statusNovo);
  cp.suggestedCategory = categoriaModelo;
  cp.categoryWritten = !!writeCategory;
  cp.modelKey = m.chave;
  cp.modelScore = score;
  cp.modelAcertos = acertos;
  cp.modelErros = erros;
  cp.modelMatchScore = Number(m._matchScore || 0);
  cp.modelStatus = m.statusModelo;
  cp.suggestedAt = new Date().toISOString();
  cp.patch = GFP_PREMODEL_PATCH_14_5;
  cp.reason = GFP_PREMODEL_buildReason_14_5_(ctx, m, statusNovo);

  const noteShort = GFP_PREMODEL_noteShort_14_5_(statusNovo, score);

  const noteFull = [
    "GFP — Sugestão pelo modelo antes do Gemini",
    "",
    `Status novo: ${statusNovo}`,
    `Categoria modelo: ${categoriaModelo}`,
    `Score modelo: ${score}`,
    `Faixa modelo: ${m.faixa}`,
    `Acertos: ${acertos}`,
    `Erros: ${erros}`,
    `Chave modelo: ${m.chave}`,
    `Match score: ${m._matchScore}`,
    "",
    `Motivo: ${cp.reason}`,
    "",
    "Observações do modelo:",
    m.observacoes || "(sem observações)"
  ].join("\n");

  return {
    shouldSuggest: true,
    row: ctx.row,
    statusAtual: ctx.statusAtual,
    statusNovo: statusNovo,
    categoriaAtual: categoriaAtual,
    categoriaNova: categoriaModelo,
    writeCategory: writeCategory,
    clearCategory: clearCategory,
    noteShort: noteShort,
    noteFull: noteFull,
    metaNova: meta,
    model: m,
    matchScore: Number(m._matchScore || 0)
  };
}

function GFP_PREMODEL_buildReason_14_5_(ctx, model, statusNovo) {
  if (statusNovo === "MODELO_BLOQUEADO") {
    return "Modelo indica padrão bloqueado ou com histórico de erros.";
  }

  if (statusNovo === "MODELO_BAIXO") {
    return "Modelo encontrou padrão, mas confiança/evidência não são suficientes para preencher categoria.";
  }

  return "Modelo encontrou padrão aprendido antes de chamar Gemini.";
}

function GFP_PREMODEL_afterApply_14_5_() {
  try {
    if (typeof GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1 === "function") {
      GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1();
    } else if (typeof GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1 === "function") {
      GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1();
    }
  } catch (e) {
    Logger.warn("[GFP 14.5] Falha ao reaplicar cores: " + e.message);
  }

  try {
    if (typeof GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1 === "function") {
      GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1();
    }
  } catch (e) {
    Logger.warn("[GFP 14.5] Falha ao reaplicar checkbox Gemini/Modelo: " + e.message);
  }

  try {
    if (typeof GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1 === "function") {
      GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1();
    }
  } catch (e) {
    Logger.warn("[GFP 14.5] Falha ao reaplicar checkbox pendências categorizadas: " + e.message);
  }

  try {
    if (typeof GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3 === "function") {
      GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
    }
  } catch (e) {
    Logger.warn("[GFP 14.5] Falha ao ordenar DB_TRANSACOES: " + e.message);
  }
}

function GFP_PREMODEL_noteShort_14_5_(status, score) {
  const s = String(status || "").toUpperCase();

  if (s === "MODELO_FORTE") return `Modelo FORTE ${score}% — ver nota`;
  if (s === "MODELO_MEDIO") return `Modelo MÉDIO ${score}% — ver nota`;
  if (s === "MODELO_FRACO") return `Modelo FRACO ${score}% — ver nota`;
  if (s === "MODELO_BAIXO") return `Modelo BAIXO ${score}% — sem preencher; ver nota`;
  if (s === "MODELO_BLOQUEADO") return `Modelo BLOQUEADO ${score}% — revisar; ver nota`;

  return `Modelo ${score}% — ver nota`;
}

function GFP_PREMODEL_isResolvedStatus_14_5_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "OK" ||
         s === "CONCILIADO" ||
         s === "SPLIT" ||
         s === "CONSOLIDADO" ||
         s === "APROVADO";
}

function GFP_PREMODEL_isCategory_14_5_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_PREMODEL_isGenericCategory_14_5_(category) {
  const txt = GFP_PREMODEL_stripAccents_14_5_(String(category || ""))
    .toUpperCase()
    .trim();

  return txt.indexOf("A IDENTIFICAR") >= 0 ||
         txt.indexOf("NAO IDENTIFICADA") >= 0 ||
         txt.indexOf("NAO IDENTIFICADO") >= 0 ||
         txt.indexOf("A CLASSIFICAR") >= 0 ||
         txt.indexOf("NAO CLASSIFICADA") >= 0 ||
         txt.indexOf("NAO CLASSIFICADO") >= 0;
}

function GFP_PREMODEL_statusToFaixa_14_5_(status) {
  const s = String(status || "").toUpperCase();

  if (s.indexOf("FORTE") >= 0) return "FORTE";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return "MEDIA";
  if (s.indexOf("FRACO") >= 0) return "FRACA";
  if (s.indexOf("BAIXO") >= 0) return "BAIXA_NAO_PREENCHER";
  if (s.indexOf("BLOQUE") >= 0) return "BLOQUEADA";

  return "";
}

function GFP_PREMODEL_parseList_14_5_(value) {
  const txt = String(value || "").trim();
  if (!txt || txt === "-") return [];

  return txt
    .split(";")
    .map(s => String(s || "").trim())
    .filter(Boolean);
}

function GFP_PREMODEL_parseJson_14_5_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_PREMODEL_normalizeKey_14_5_(value) {
  let txt = GFP_PREMODEL_stripAccents_14_5_(String(value || ""))
    .toUpperCase()
    .trim();

  if (!txt) return "";

  txt = txt
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]+\)/g, " ")
    .replace(/\bCOM SALDO\b/g, " ")
    .replace(/\bCOM CARTAO\b/g, " ")
    .replace(/\bCOM CARTÃO\b/g, " ")
    .replace(/\bPIX ENVIADO\s*-\s*/g, "")
    .replace(/\bPIX RECEBIDO\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\b/g, "")
    .replace(/\bPAGAMENTO REALIZADO\s*-\s*/g, "")
    .replace(/\bPAGAMENTO REALIZADO\b/g, "")
    .replace(/\bRENDIMENTO RECEBIDO\s*-\s*/g, "")
    .replace(/\bPARC\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\bPARCELA\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  txt = txt.replace(/^[\s\-–—:;.]+|[\s\-–—:;.]+$/g, "").trim();

  if (txt.length > 120) txt = txt.slice(0, 120).trim();

  return txt;
}

function GFP_PREMODEL_stripAccents_14_5_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
