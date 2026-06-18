/**
 * 📂 ARQUIVO: 5_UTILS/saneamento_visual_db_transacoes_14_5_1.gs
 * 🎨 MÓDULO: SANEAMENTO VISUAL GLOBAL DA DB_TRANSACOES
 * 🔢 VERSÃO: 14.5.1
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Reaplicar cores, compactar notas longas, restaurar checkboxes e ordenar a base.
 * -----------------------------------------------------------------------------
 */

/**
 * ✅ EXECUTE ESTA FUNÇÃO.
 */
function GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1() {
  const result = {
    compactNotes: null,
    colors: null,
    checkboxGemini: null,
    checkboxPendencias: null,
    sort: null
  };

  try {
    result.compactNotes = GFP_COMPACTAR_NOTAS_GLOBAIS_DB_TRANSACOES_14_5_1();
  } catch (e) {
    result.compactNotes = { error: e.message };
    Logger.warn("[GFP 14.5.1] Falha ao compactar notas: " + e.message);
  }

  try {
    if (typeof GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1 === "function") {
      result.colors = GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1();
    } else if (typeof GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1 === "function") {
      result.colors = GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1();
    } else {
      result.colors = { skipped: true, reason: "função de cores não encontrada" };
    }
  } catch (e) {
    result.colors = { error: e.message };
    Logger.warn("[GFP 14.5.1] Falha ao reaplicar cores: " + e.message);
  }

  try {
    if (typeof GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1 === "function") {
      result.checkboxGemini = GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1();
    } else {
      result.checkboxGemini = { skipped: true, reason: "função de checkbox Gemini/Modelo não encontrada" };
    }
  } catch (e) {
    result.checkboxGemini = { error: e.message };
    Logger.warn("[GFP 14.5.1] Falha ao reaplicar checkbox Gemini/Modelo: " + e.message);
  }

  try {
    if (typeof GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1 === "function") {
      result.checkboxPendencias = GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1();
    } else {
      result.checkboxPendencias = { skipped: true, reason: "função de checkbox pendências categorizadas não encontrada" };
    }
  } catch (e) {
    result.checkboxPendencias = { error: e.message };
    Logger.warn("[GFP 14.5.1] Falha ao reaplicar checkbox pendências categorizadas: " + e.message);
  }

  try {
    if (typeof GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3 === "function") {
      result.sort = GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
    } else {
      result.sort = { skipped: true, reason: "sorter 14.3 não encontrado" };
    }
  } catch (e) {
    result.sort = { error: e.message };
    Logger.warn("[GFP 14.5.1] Falha ao ordenar DB_TRANSACOES: " + e.message);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Saneamento visual concluído. Notas compactadas: ${result.compactNotes && result.compactNotes.updated ? result.compactNotes.updated : 0}`,
    "GFP 14.5.1"
  );

  Logger.log("[GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1] " + JSON.stringify(result));

  return result;
}


/**
 * Compacta notas longas em J e move o texto completo para a nota da célula.
 */
function GFP_COMPACTAR_NOTAS_GLOBAIS_DB_TRANSACOES_14_5_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { scanned: 0, updated: 0 };

  const numRows = lastRow - 1;
  const values = sh.getRange(2, 1, numRows, 14).getValues();
  const notesRange = sh.getRange(2, 10, numRows, 1); // J
  const existingCellNotes = notesRange.getNotes();

  let updated = 0;

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const status = String(row[8] || "").trim().toUpperCase();
    const visibleNote = String(row[9] || "").trim();
    const meta = GFP_parseJsonVisual14_5_1_(row[13]);
    const currentCellNote = String(existingCellNotes[idx][0] || "").trim();

    const isAutoStatus = GFP_isAutoStatusVisual14_5_1_(status);
    const isAutoNote = GFP_isAutoNoteVisual14_5_1_(visibleNote);

    if (!isAutoStatus && !isAutoNote) return;

    if (
      visibleNote.length <= 90 &&
      visibleNote.toUpperCase().indexOf("VER NOTA") >= 0 &&
      currentCellNote
    ) {
      return;
    }

    const cp = meta && meta.classificationParams ? meta.classificationParams : {};

    const origem = GFP_detectOrigemVisual14_5_1_(status, visibleNote, cp);
    const faixa = GFP_detectFaixaVisual14_5_1_(status, visibleNote, cp);
    const confidence = GFP_detectConfidenceVisual14_5_1_(visibleNote, cp);
    const categoriaAtual = String(row[5] || "").trim();
    const categoriaSugerida = String(cp.suggestedCategory || categoriaAtual || "").trim();
    const reason = String(cp.reason || "").trim();

    const compact = GFP_buildCompactVisibleNoteVisual14_5_1_(
      origem,
      faixa,
      confidence,
      status,
      categoriaAtual,
      categoriaSugerida
    );

    const fullParts = [];

    fullParts.push("GFP — Detalhe da sugestão automática");
    fullParts.push("");
    if (status) fullParts.push(`Status: ${status}`);
    if (origem) fullParts.push(`Origem: ${origem}`);
    if (faixa) fullParts.push(`Faixa: ${faixa}`);
    if (confidence !== "") fullParts.push(`Confiança: ${confidence}%`);
    if (categoriaSugerida) fullParts.push(`Categoria sugerida: ${categoriaSugerida}`);
    if (categoriaAtual) fullParts.push(`Categoria atual na célula: ${categoriaAtual}`);
    if (reason) fullParts.push(`Motivo: ${reason}`);

    if (visibleNote) {
      fullParts.push("");
      fullParts.push("Texto original da coluna NOTAS:");
      fullParts.push(visibleNote);
    }

    if (currentCellNote) {
      fullParts.push("");
      fullParts.push("Nota anterior da célula:");
      fullParts.push(currentCellNote);
    }

    if (meta && Object.keys(meta).length) {
      fullParts.push("");
      fullParts.push("Metadados:");
      fullParts.push(JSON.stringify(meta, null, 2));
    }

    sh.getRange(sheetRow, 10)
      .setValue(compact)
      .setNote(fullParts.join("\n"));

    updated++;
  });

  sh.setColumnWidth(10, 360);
  sh.getRange(2, 10, numRows, 1)
    .setWrap(false)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  Logger.log(`[GFP_COMPACTAR_NOTAS_GLOBAIS_DB_TRANSACOES_14_5_1] scanned=${numRows} | updated=${updated}`);

  return { scanned: numRows, updated: updated };
}


function GFP_isAutoStatusVisual14_5_1_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s.indexOf("GEMINI_") === 0 ||
         s.indexOf("MODELO_") === 0 ||
         s === "BLOQUEADA";
}


function GFP_isAutoNoteVisual14_5_1_(note) {
  const n = String(note || "").trim().toUpperCase();

  if (!n) return false;

  return n.indexOf("[GEMINI ") === 0 ||
         n.indexOf("GEMINI ") === 0 ||
         n.indexOf("[MODELO ") === 0 ||
         n.indexOf("MODELO ") === 0 ||
         n.indexOf("MODELO FORTE") >= 0 ||
         n.indexOf("MODELO MÉDIO") >= 0 ||
         n.indexOf("MODELO MEDIO") >= 0 ||
         n.indexOf("MODELO FRACO") >= 0 ||
         n.indexOf("MODELO BAIXO") >= 0 ||
         n.indexOf("MODELO BLOQUEADO") >= 0 ||
         n.indexOf("GEMINI FORTE") >= 0 ||
         n.indexOf("GEMINI MÉDIO") >= 0 ||
         n.indexOf("GEMINI MEDIO") >= 0 ||
         n.indexOf("GEMINI FRACO") >= 0 ||
         n.indexOf("GEMINI BAIXO") >= 0 ||
         n.indexOf("GEMINI BLOQUEADO") >= 0;
}


function GFP_detectOrigemVisual14_5_1_(status, note, cp) {
  const source = String(cp.source || "").toUpperCase();
  const s = String(status || "").toUpperCase();
  const n = String(note || "").toUpperCase();

  if (source.indexOf("MODELO") >= 0 || s.indexOf("MODELO_") === 0 || n.indexOf("MODELO") >= 0) {
    return "Modelo";
  }

  if (source.indexOf("GEMINI") >= 0 || s.indexOf("GEMINI_") === 0 || n.indexOf("GEMINI") >= 0) {
    return "Gemini";
  }

  return "Sugestão";
}


function GFP_detectFaixaVisual14_5_1_(status, note, cp) {
  const raw = [
    cp.faixa || "",
    status || "",
    note || ""
  ].join(" ").toUpperCase();

  if (raw.indexOf("BLOQUE") >= 0) return "BLOQUEADO";
  if (raw.indexOf("FORTE") >= 0) return "FORTE";
  if (raw.indexOf("MEDIO") >= 0 || raw.indexOf("MÉDIO") >= 0 || raw.indexOf("MEDIA") >= 0 || raw.indexOf("MÉDIA") >= 0) return "MÉDIO";
  if (raw.indexOf("FRACO") >= 0 || raw.indexOf("FRACA") >= 0) return "FRACO";
  if (raw.indexOf("BAIXO") >= 0 || raw.indexOf("BAIXA") >= 0) return "BAIXO";

  return "";
}


function GFP_detectConfidenceVisual14_5_1_(note, cp) {
  const fromMeta = Number(cp.confidence || cp.modelScore || 0);
  if (!isNaN(fromMeta) && fromMeta > 0) return Math.max(0, Math.min(100, fromMeta));

  const m = String(note || "").match(/(\d{1,3})%/);
  if (!m) return "";

  const n = Number(m[1]);
  if (isNaN(n)) return "";

  return Math.max(0, Math.min(100, n));
}


function GFP_buildCompactVisibleNoteVisual14_5_1_(origem, faixa, confidence, status, categoriaAtual, categoriaSugerida) {
  const ori = origem || "Sugestão";
  const fx = faixa || "";
  const confTxt = confidence !== "" ? ` ${confidence}%` : "";
  const statusUpper = String(status || "").toUpperCase();

  if (statusUpper.indexOf("BAIXO") >= 0 || fx === "BAIXO") {
    return `${ori} BAIXO${confTxt} — sem preencher; ver nota`;
  }

  if (statusUpper.indexOf("BLOQUE") >= 0 || fx === "BLOQUEADO") {
    return `${ori} BLOQUEADO${confTxt} — revisar; ver nota`;
  }

  if (fx) {
    return `${ori} ${fx}${confTxt} — ver nota`;
  }

  return `${ori}${confTxt} — ver nota`;
}


function GFP_parseJsonVisual14_5_1_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}