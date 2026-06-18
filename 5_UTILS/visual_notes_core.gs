/**
 * ✅ EXECUTE ESTA FUNÇÃO.
 */
function GFP_HOTFIX_GEMINI_VISUAL_NOTES_14_1_1() {
  GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1();
  const result = GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Hotfix aplicado. Notas compactadas: ${result.updated}`,
    "GFP 14.1.1"
  );

  Logger.log(`[GFP_HOTFIX_GEMINI_VISUAL_NOTES_14_1_1] ${JSON.stringify(result)}`);

  return result;
}


/**
 * Reaplica as cores do Gemini/Modelo na DB_TRANSACOES sem usar OR/Ou.
 *
 * Range colorido:
 * F:J = CATEGORIA, PARC_ATUAL, PARC_TOTAL, STATUS, NOTAS
 */
function GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const maxRows = Math.max(sh.getMaxRows() - 1, 1);
  const range = sh.getRange(2, 6, maxRows, 5); // F:J

  const existing = sh.getConditionalFormatRules() || [];

  const kept = existing.filter(rule => {
    try {
      const bc = rule.getBooleanCondition();
      if (!bc) return true;

      const vals = bc.getCriteriaValues();
      const formula = vals && vals[0] ? String(vals[0]) : "";

      // Remove apenas regras antigas relacionadas a Gemini/Modelo/Bloqueada.
      if (formula.indexOf("GEMINI_") >= 0) return false;
      if (formula.indexOf("MODELO_") >= 0) return false;
      if (formula.indexOf("BLOQUEADA") >= 0) return false;

      return true;
    } catch (e) {
      return true;
    }
  });

  const rules = kept.slice();

  // FORTE — verde claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_FORTE', '#d9ead3', '#14532d');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'MODELO_FORTE', '#d9ead3', '#14532d');

  // MEDIA — amarelo claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_MEDIO', '#fff2cc', '#7c5e00');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'MODELO_MEDIO', '#fff2cc', '#7c5e00');

  // FRACA — laranja claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_FRACO', '#fce5cd', '#9a3412');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'MODELO_FRACO', '#fce5cd', '#9a3412');

  // BAIXO — cinza claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_BAIXO', '#f3f4f6', '#4b5563');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'MODELO_BAIXO', '#f3f4f6', '#4b5563');

  // BLOQUEADO — vermelho claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_BLOQUEADO', '#f4cccc', '#991b1b');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'MODELO_BLOQUEADO', '#f4cccc', '#991b1b');
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'BLOQUEADA', '#f4cccc', '#991b1b');

  // LEGACY — azul claro
  GFP_addSimpleStatusRule14_1_1_(rules, range, 'GEMINI_SUGERIDO', '#dbeafe', '#1e3a8a');

  sh.setConditionalFormatRules(rules);

  // Ajuste visual da coluna NOTAS.
  sh.setColumnWidth(10, 360); // J
  sh.getRange(2, 10, maxRows, 1)
    .setWrap(false)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  Logger.log("[GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1] Regras visuais reaplicadas com fórmulas simples.");
}


/**
 * Helper para criar regra por status sem OR.
 */
function GFP_addSimpleStatusRule14_1_1_(rules, range, status, bg, font) {
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$I2="${status}"`)
      .setBackground(bg)
      .setFontColor(font)
      .setRanges([range])
      .build()
  );
}


/**
 * Move notas longas do Gemini da coluna J para nota de célula.
 *
 * Antes:
 * J = "[Gemini FORTE 98%] categoria preenchida como sugestão: ..."
 *
 * Depois:
 * J = "Gemini FORTE 98% — ver nota"
 * Nota da célula J = texto completo antigo + metadados úteis.
 */
function GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return { scanned: 0, updated: 0 };
  }

  const numRows = lastRow - 1;
  const values = sh.getRange(2, 1, numRows, 14).getValues();
  const notesRange = sh.getRange(2, 10, numRows, 1); // J
  const existingNotes = notesRange.getNotes();

  let updated = 0;

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const status = String(row[8] || "").trim().toUpperCase(); // I
    const visibleNote = String(row[9] || "").trim(); // J
    const metadata = GFP_parseMetadataForGemini14_1_1_(row[13]); // N
    const currentCellNote = String(existingNotes[idx][0] || "").trim();

    if (!GFP_isGeminiOrModeloStatus14_1_1_(status)) return;

    const cp = metadata && metadata.classificationParams ? metadata.classificationParams : {};
    const confidence = GFP_extractConfidence14_1_1_(visibleNote, cp);
    const faixa = GFP_labelFaixa14_1_1_(status);
    const categoriaVisivel = String(row[5] || "").trim();
    const categoriaSugerida = String(cp.suggestedCategory || categoriaVisivel || "").trim();
    const reason = String(cp.reason || "").trim();

    // Se a célula já está compactada e já tem nota, não precisa refazer.
    const alreadyCompact =
      visibleNote.length <= 80 &&
      visibleNote.toUpperCase().indexOf("VER NOTA") >= 0 &&
      currentCellNote;

    if (alreadyCompact) return;

    const compact = GFP_buildCompactGeminiVisibleNote14_1_1_(
      status,
      faixa,
      confidence,
      categoriaVisivel,
      categoriaSugerida
    );

    const fullParts = [];

    fullParts.push("GFP — Detalhe da sugestão automática");
    fullParts.push("");
    fullParts.push(`Status: ${status}`);
    if (faixa) fullParts.push(`Faixa: ${faixa}`);
    if (confidence) fullParts.push(`Confiança: ${confidence}%`);
    if (categoriaSugerida) fullParts.push(`Categoria sugerida: ${categoriaSugerida}`);
    if (categoriaVisivel) fullParts.push(`Categoria preenchida na célula: ${categoriaVisivel}`);
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

    if (metadata && Object.keys(metadata).length) {
      fullParts.push("");
      fullParts.push("Metadados:");
      fullParts.push(JSON.stringify(metadata, null, 2));
    }

    const fullNote = fullParts.join("\n");

    sh.getRange(sheetRow, 10)
      .setValue(compact)
      .setNote(fullNote);

    updated++;
  });

  sh.setColumnWidth(10, 360); // coluna J
  sh.getRange(2, 10, numRows, 1)
    .setWrap(false)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  Logger.log(`[GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1] scanned=${numRows} | updated=${updated}`);

  return {
    scanned: numRows,
    updated: updated
  };
}


function GFP_isGeminiOrModeloStatus14_1_1_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s.indexOf("GEMINI_") === 0 || s.indexOf("MODELO_") === 0 || s === "BLOQUEADA";
}


function GFP_extractConfidence14_1_1_(txt, cp) {
  if (cp && cp.confidence) {
    const n = Number(cp.confidence);
    if (!isNaN(n) && n > 0) return Math.max(0, Math.min(100, n));
  }

  const m = String(txt || "").match(/(\d{1,3})%/);
  if (!m) return "";

  const n = Number(m[1]);
  if (isNaN(n)) return "";

  return Math.max(0, Math.min(100, n));
}


function GFP_labelFaixa14_1_1_(status) {
  const s = String(status || "").trim().toUpperCase();

  if (s.indexOf("FORTE") >= 0) return "FORTE";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0 || s.indexOf("MEDIA") >= 0 || s.indexOf("MÉDIA") >= 0) return "MEDIA";
  if (s.indexOf("FRACO") >= 0 || s.indexOf("FRACA") >= 0) return "FRACA";
  if (s.indexOf("BAIXO") >= 0 || s.indexOf("BAIXA") >= 0) return "BAIXA_NAO_PREENCHER";
  if (s.indexOf("BLOQUE") >= 0) return "BLOQUEADA";
  if (s.indexOf("SUGERIDO") >= 0) return "SUGERIDO";

  return "";
}


function GFP_buildCompactGeminiVisibleNote14_1_1_(status, faixa, confidence, categoriaVisivel, categoriaSugerida) {
  const origem = String(status || "").indexOf("MODELO_") === 0 ? "Modelo" : "Gemini";

  let label = faixa || status.replace(/^GEMINI_/, "").replace(/^MODELO_/, "");
  if (label === "BAIXA_NAO_PREENCHER") label = "BAIXO";
  if (label === "MEDIA") label = "MÉDIO";
  if (label === "FRACA") label = "FRACO";

  const confTxt = confidence ? ` ${confidence}%` : "";

  if (String(status || "").indexOf("BAIXO") >= 0) {
    return `${origem} ${label}${confTxt} — sem preencher; ver nota`;
  }

  if (String(status || "").indexOf("BLOQUE") >= 0) {
    return `${origem} BLOQUEADO${confTxt} — não sugerir; ver nota`;
  }

  return `${origem} ${label}${confTxt} — ver nota`;
}


function GFP_parseMetadataForGemini14_1_1_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}
