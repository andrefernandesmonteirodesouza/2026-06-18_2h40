/**
 * 📂 ARQUIVO: 3_RULES/recalibrador_sugestoes_pendentes_14_4.gs
 * 🧠 MÓDULO: RECALIBRADOR DE SUGESTÕES PENDENTES PELO MODELO
 * 🔢 VERSÃO: 14.4.2
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Reavaliar apenas sugestões automáticas pendentes GEMINI_/MODELO_
 * com base na CFG_Modelo_Classificacao.
 *
 * Esta versão NÃO mexe em PENDENTE_CATEGORIZADA.
 * -----------------------------------------------------------------------------
 */

const GFP_RECAL_DB_SHEET_14_4 = "DB_TRANSACOES";
const GFP_RECAL_MODEL_SHEET_14_4 = "CFG_Modelo_Classificacao";
const GFP_RECAL_CATEGORY_SHEET_14_4 = "CFG_Categorias";
const GFP_RECAL_PATCH_14_4 = "14.4.2";

/**
 * DRY-RUN.
 */
function GFP_RECALIBRAR_SUGESTOES_PENDENTES_DRYRUN_14_4(limit) {
  return GFP_RECALIBRAR_SUGESTOES_PENDENTES_14_4_(limit || 100, true);
}

/**
 * APPLY.
 */
function GFP_RECALIBRAR_SUGESTOES_PENDENTES_APPLY_14_4(limit) {
  return GFP_RECALIBRAR_SUGESTOES_PENDENTES_14_4_(limit || 100, false);
}

/**
 * Núcleo do recalibrador.
 */
function GFP_RECALIBRAR_SUGESTOES_PENDENTES_14_4_(limit, dryRun) {
  const fn = "GFP_RECALIBRAR_SUGESTOES_PENDENTES_14_4_";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_RECAL_DB_SHEET_14_4);
  const modelSheet = ss.getSheetByName(GFP_RECAL_MODEL_SHEET_14_4);

  if (!db) throw new Error("Aba DB_TRANSACOES não encontrada.");
  if (!modelSheet) throw new Error("Aba CFG_Modelo_Classificacao não encontrada.");

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const model = GFP_RECAL_loadModel_14_4_(modelSheet);
  const officialCategories = GFP_RECAL_loadOfficialCategories_14_4_(ss);

  const lastRow = db.getLastRow();
  if (lastRow < 2) {
    return { dryRun: !!dryRun, scanned: 0, changes: 0 };
  }

  const values = db.getRange(2, 1, lastRow - 1, 14).getValues();
  const changes = [];

  values.forEach((row, idx) => {
    if (changes.length >= safeLimit) return;

    const sheetRow = idx + 2;

    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "").trim();
    const categoriaAtual = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const notas = String(row[9] || "").trim();
    const meta = GFP_RECAL_parseJson_14_4_(row[13]);

    if (!descricao) return;

    // Nunca mexer em linhas resolvidas.
    if (GFP_RECAL_isResolvedStatus_14_4_(status)) return;

    // Nunca mexer em T/S.
    if (tipo === "T" || tipo === "S") return;

    // Hotfix 14.4.2:
    // recalibrar apenas sugestões automáticas, nunca pendências categorizadas.
    if (!GFP_RECAL_isRecalibratableStatus_14_4_(status)) return;

    const match = GFP_RECAL_findBestModelMatch_14_4_(model, descricao, conta, tipo);
    if (!match) return;

    const decision = GFP_RECAL_buildDecision_14_4_({
      row: sheetRow,
      descricao: descricao,
      conta: conta,
      tipo: tipo,
      categoriaAtual: categoriaAtual,
      statusAtual: status,
      notas: notas,
      meta: meta,
      match: match,
      officialCategories: officialCategories
    });

    if (!decision || !decision.shouldChange) return;

    changes.push(decision);
  });

  Logger.log(`[${fn}] ${dryRun ? "DRY-RUN" : "APPLY"} | mudanças=${changes.length} | limite=${safeLimit}`);

  changes.forEach(c => {
    Logger.log(
      `[${fn}] ${dryRun ? "[DRY]" : "[APPLY]"} linha=${c.row} | ` +
      `${c.statusAtual || "(vazio)"} → ${c.statusNovo} | ` +
      `cat atual='${c.categoriaAtual}' | cat nova='${c.categoriaNova || ""}' | ` +
      `score=${c.model.score} | faixa=${c.model.faixa} | motivo=${c.reason}`
    );
  });

  if (!dryRun) {
    changes.forEach(c => {
      const row = c.row;

      if (c.writeCategory) {
        db.getRange(row, 6).setValue(c.categoriaNova);
      } else if (c.clearCategory) {
        db.getRange(row, 6).clearContent();
      }

      db.getRange(row, 9).setValue(c.statusNovo);
      db.getRange(row, 10).setValue(c.noteShort);
      db.getRange(row, 10).setNote(c.noteFull);
      db.getRange(row, 14).setValue(JSON.stringify(c.metaNova));
    });

    // Hotfix 14.4.2:
    // Não chama mais rotinas visuais soltas. Usa o saneamento central, se existir.
    try {
      if (typeof GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1 === "function") {
        GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1();
      }
    } catch (visualError) {
      Logger.warn("[GFP 14.4.2] Falha no saneamento visual central pós-recalibração: " + visualError.message);
    }
  }

  return {
    dryRun: !!dryRun,
    scanned: values.length,
    changes: changes.length,
    examples: changes.slice(0, 50)
  };
}

/**
 * Carrega CFG_Modelo_Classificacao.
 */
function GFP_RECAL_loadModel_14_4_(sh) {
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
      negadas: GFP_RECAL_parseList_14_4_(row[5]),
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
 * Carrega categorias oficiais da CFG_Categorias.
 */
function GFP_RECAL_loadOfficialCategories_14_4_(ss) {
  const sh = ss.getSheetByName(GFP_RECAL_CATEGORY_SHEET_14_4);
  const set = {};

  if (!sh || sh.getLastRow() < 2) return set;

  const values = sh.getDataRange().getValues();

  values.forEach(row => {
    row.forEach(cell => {
      const txt = String(cell || "").trim();
      if (/^\d{2}\.\d{2}\s+—\s+/.test(txt)) {
        set[txt] = true;
      }
    });
  });

  return set;
}

/**
 * Encontra melhor match do modelo para descrição/conta/tipo.
 */
function GFP_RECAL_findBestModelMatch_14_4_(model, descricao, conta, tipo) {
  const key = GFP_RECAL_normalizeKey_14_4_(descricao);
  const contaNorm = String(conta || "*").trim() || "*";
  const tipoNorm = String(tipo || "*").trim().toUpperCase() || "*";

  if (!key) return null;

  const candidates = [];

  model.forEach(m => {
    let scoreMatch = 0;

    if (m.chave === key) {
      scoreMatch += 100;
    } else if (key.indexOf(m.chave) >= 0 && m.chave.length >= 8) {
      scoreMatch += 75;
    } else if (m.chave.indexOf(key) >= 0 && key.length >= 8) {
      scoreMatch += 65;
    } else {
      return;
    }

    if (m.conta === contaNorm) scoreMatch += 15;
    else if (m.conta === "*") scoreMatch += 5;
    else scoreMatch -= 10;

    if (m.tipo === tipoNorm) scoreMatch += 15;
    else if (m.tipo === "*") scoreMatch += 5;
    else scoreMatch -= 10;

    scoreMatch += Math.min(20, Number(m.acertos || 0) * 2);
    scoreMatch -= Math.min(20, Number(m.erros || 0) * 3);

    candidates.push({
      model: m,
      matchScore: scoreMatch
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.matchScore - a.matchScore);

  const best = candidates[0];

  if (best.matchScore < 80) return null;

  const out = best.model;
  out._matchScore = best.matchScore;

  return out;
}

/**
 * Decide o que fazer com a linha.
 */
function GFP_RECAL_buildDecision_14_4_(ctx) {
  const m = ctx.match;

  const categoriaAtual = String(ctx.categoriaAtual || "").trim();
  const categoriaModelo = String(m.categoria || "").trim();
  const officialCategories = ctx.officialCategories || {};

  if (!GFP_RECAL_isCategory_14_4_(categoriaModelo)) return null;

  const categoriaExisteOficialmente =
    Object.keys(officialCategories).length === 0 || !!officialCategories[categoriaModelo];

  const faixa = String(m.faixa || "").toUpperCase();
  const statusModelo = String(m.statusModelo || "").toUpperCase();

  const blocked =
    statusModelo === "BLOQUEADA" ||
    faixa === "BLOQUEADA" ||
    GFP_RECAL_categoryIsNegated_14_4_(m, categoriaAtual) ||
    !categoriaExisteOficialmente;

  let statusNovo = "";
  let writeCategory = false;
  let clearCategory = false;

  if (blocked) {
    statusNovo = "MODELO_BLOQUEADO";
    writeCategory = false;
    clearCategory = false;
  } else if (faixa === "FORTE" && Number(m.score || 0) >= 95) {
    statusNovo = "MODELO_FORTE";
    writeCategory = true;
  } else if (faixa === "MEDIA" || faixa === "MÉDIA" || Number(m.score || 0) >= 80) {
    statusNovo = "MODELO_MEDIO";
    writeCategory = true;
  } else if (faixa === "FRACA" || Number(m.score || 0) >= 60) {
    statusNovo = "MODELO_FRACO";
    writeCategory = true;
  } else {
    statusNovo = "MODELO_BAIXO";
    writeCategory = false;
    clearCategory = GFP_RECAL_isGenericCategory_14_4_(categoriaAtual);
  }

  if (!statusNovo) return null;

  const categoriaNova = writeCategory ? categoriaModelo : categoriaAtual;

  const sameStatus = String(ctx.statusAtual || "").toUpperCase() === statusNovo;
  const sameCategory = String(categoriaAtual || "").trim() === String(categoriaNova || "").trim();

  if (sameStatus && sameCategory && !clearCategory) return null;

  const meta = ctx.meta || {};
  if (!meta.classificationParams) meta.classificationParams = {};

  const cp = meta.classificationParams;

  const oldSnapshot = {
    status: ctx.statusAtual,
    category: categoriaAtual,
    note: ctx.notas || "",
    recalibratedAt: cp.recalibratedAt || ""
  };

  cp.source = "MODELO_RECALIBRADOR";
  cp.status = statusNovo;
  cp.confidence = Number(m.score || 0);
  cp.faixa = faixa || GFP_RECAL_statusToFaixa_14_4_(statusNovo);
  cp.suggestedCategory = categoriaModelo;
  cp.modelKey = m.chave;
  cp.modelScore = Number(m.score || 0);
  cp.modelAcertos = Number(m.acertos || 0);
  cp.modelErros = Number(m.erros || 0);
  cp.modelStatus = m.statusModelo;
  cp.modelMatchScore = Number(m._matchScore || 0);
  cp.previousSuggestion = oldSnapshot;
  cp.recalibratedAt = new Date().toISOString();
  cp.recalibrationPatch = GFP_RECAL_PATCH_14_4;
  cp.categoryExistsInOfficialList = !!categoriaExisteOficialmente;

  const reason = GFP_RECAL_buildReason_14_4_(ctx, m, statusNovo, blocked, categoriaExisteOficialmente);
  cp.reason = reason;

  const noteShort = GFP_RECAL_noteShort_14_4_(statusNovo, Number(m.score || 0));

  const noteFull = [
    "GFP — Recalibração pelo modelo",
    "",
    `Status anterior: ${ctx.statusAtual || "(vazio)"}`,
    `Categoria anterior: ${categoriaAtual || "(vazia)"}`,
    `Status novo: ${statusNovo}`,
    `Categoria modelo: ${categoriaModelo}`,
    `Categoria existe na CFG_Categorias: ${categoriaExisteOficialmente ? "SIM" : "NÃO"}`,
    `Score modelo: ${m.score}`,
    `Faixa modelo: ${m.faixa}`,
    `Acertos: ${m.acertos}`,
    `Erros: ${m.erros}`,
    `Chave modelo: ${m.chave}`,
    "",
    `Motivo: ${reason}`,
    "",
    "Observações do modelo:",
    m.observacoes || "(sem observações)"
  ].join("\n");

  return {
    shouldChange: true,
    row: ctx.row,
    statusAtual: ctx.statusAtual,
    statusNovo: statusNovo,
    categoriaAtual: categoriaAtual,
    categoriaNova: categoriaNova,
    writeCategory: writeCategory,
    clearCategory: clearCategory,
    noteShort: noteShort,
    noteFull: noteFull,
    metaNova: meta,
    model: m,
    reason: reason
  };
}

function GFP_RECAL_buildReason_14_4_(ctx, model, statusNovo, blocked, categoriaExisteOficialmente) {
  if (!categoriaExisteOficialmente) {
    return "Categoria sugerida pelo modelo não existe na CFG_Categorias; sugestão bloqueada para evitar erro de validação.";
  }

  if (blocked) {
    return "Modelo indica padrão bloqueado ou categoria atual está em categorias negadas.";
  }

  if (String(ctx.categoriaAtual || "").trim() !== String(model.categoria || "").trim()) {
    return "Modelo aprendeu categoria diferente da sugestão automática pendente atual.";
  }

  return "Modelo recalibrou a confiança/status da sugestão automática pendente.";
}

function GFP_RECAL_noteShort_14_4_(status, score) {
  const s = String(status || "").toUpperCase();

  if (s === "MODELO_FORTE") return `Modelo FORTE ${score}% — ver nota`;
  if (s === "MODELO_MEDIO") return `Modelo MÉDIO ${score}% — ver nota`;
  if (s === "MODELO_FRACO") return `Modelo FRACO ${score}% — ver nota`;
  if (s === "MODELO_BAIXO") return `Modelo BAIXO ${score}% — sem preencher; ver nota`;
  if (s === "MODELO_BLOQUEADO") return `Modelo BLOQUEADO ${score}% — revisar; ver nota`;

  return `Modelo ${score}% — ver nota`;
}

function GFP_RECAL_isResolvedStatus_14_4_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "OK" ||
         s === "CONCILIADO" ||
         s === "SPLIT" ||
         s === "CONSOLIDADO" ||
         s === "APROVADO";
}

/**
 * Hotfix 14.4.2:
 * só recalibra sugestões automáticas.
 */
function GFP_RECAL_isRecalibratableStatus_14_4_(status) {
  const s = String(status || "").trim().toUpperCase();

  if (s.indexOf("GEMINI_") === 0) return true;
  if (s.indexOf("MODELO_") === 0) return true;

  return false;
}

function GFP_RECAL_categoryIsNegated_14_4_(model, categoriaAtual) {
  const cat = String(categoriaAtual || "").trim();
  if (!cat) return false;

  const negadas = model.negadas || [];
  return negadas.indexOf(cat) >= 0;
}

function GFP_RECAL_isCategory_14_4_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_RECAL_isGenericCategory_14_4_(category) {
  const txt = GFP_RECAL_stripAccents_14_4_(String(category || ""))
    .toUpperCase()
    .trim();

  return txt.indexOf("A IDENTIFICAR") >= 0 ||
         txt.indexOf("NAO IDENTIFICADA") >= 0 ||
         txt.indexOf("NAO IDENTIFICADO") >= 0 ||
         txt.indexOf("A CLASSIFICAR") >= 0 ||
         txt.indexOf("NAO CLASSIFICADA") >= 0 ||
         txt.indexOf("NAO CLASSIFICADO") >= 0;
}

function GFP_RECAL_statusToFaixa_14_4_(status) {
  const s = String(status || "").toUpperCase();

  if (s.indexOf("FORTE") >= 0) return "FORTE";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return "MEDIA";
  if (s.indexOf("FRACO") >= 0) return "FRACA";
  if (s.indexOf("BAIXO") >= 0) return "BAIXA_NAO_PREENCHER";
  if (s.indexOf("BLOQUE") >= 0) return "BLOQUEADA";

  return "";
}

function GFP_RECAL_parseList_14_4_(value) {
  const txt = String(value || "").trim();
  if (!txt || txt === "-") return [];

  return txt
    .split(";")
    .map(s => String(s || "").trim())
    .filter(Boolean);
}

function GFP_RECAL_parseJson_14_4_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_RECAL_normalizeKey_14_4_(value) {
  let txt = GFP_RECAL_stripAccents_14_4_(String(value || ""))
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

function GFP_RECAL_stripAccents_14_4_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
