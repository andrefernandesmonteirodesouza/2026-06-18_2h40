/**
 * 📂 ARQUIVO: 5_UTILS/ordenacao_mesa_16_1_18_3.gs
 * 🧭 MÓDULO: REORGANIZAÇÃO OFICIAL DA MESA
 * 🔢 VERSÃO: 16.1.18.3
 *
 * Não é recalibração.
 * Não muda categoria.
 * Não muda classificação por IA.
 * Apenas normaliza NOTA VISÍVEL incoerente e recalcula O:S para ordenar.
 */

const GFP_SORT_MESA_PATCH_16_1_18_3 = "16.1.18.3";


function GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    throw new Error("DB_TRANSACOES não encontrada.");
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    throw new Error("Não foi possível obter lock para reorganizar a mesa. Tente novamente.");
  }

  try {
    const out = GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(sh, {
      normalizeVisibleNotes: true,
      sort: true
    });

    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Mesa reorganizada: " + out.rows + " linha(s). Notas ajustadas: " + out.notesAdjusted + ".",
      "GFP 16.1.18.3",
      8
    );

    return out;

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function GFP_RECALCULAR_SORT_MESA_SEM_NOTAS_16_1_18_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    throw new Error("DB_TRANSACOES não encontrada.");
  }

  return GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(sh, {
    normalizeVisibleNotes: false,
    sort: true
  });
}


function GFP_NORMALIZAR_NOTAS_VISIVEIS_MESA_16_1_18_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    throw new Error("DB_TRANSACOES não encontrada.");
  }

  return GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(sh, {
    normalizeVisibleNotes: true,
    sort: false
  });
}


function GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(sh, options) {
  const opt = options || {};
  const lastRow = sh.getLastRow();

  GFP_SORT_MESA_ENSURE_AS_16_1_18_3_(sh);

  if (lastRow < 2) {
    return {
      ok: true,
      patch: GFP_SORT_MESA_PATCH_16_1_18_3,
      rows: 0,
      notesAdjusted: 0,
      sorted: false
    };
  }

  const numRows = lastRow - 1;
  const rangeAS = sh.getRange(2, 1, numRows, 19);
  const values = rangeAS.getValues();

  const auxRows = [];
  const visibleNotes = [];
  let notesAdjusted = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const info = GFP_SORT_MESA_CLASSIFICAR_LINHA_16_1_18_3_(row);

    auxRows.push([
      info.group,
      info.subPriority,
      info.sortDate,
      info.effectiveStatus,
      info.audit
    ]);

    const currentNote = String(row[9] || "").trim();
    const desiredNote = GFP_SORT_MESA_NOTA_VISIVEL_16_1_18_3_(info, currentNote);

    if (opt.normalizeVisibleNotes && desiredNote && currentNote !== desiredNote) {
      visibleNotes.push([desiredNote]);
      notesAdjusted++;
    } else {
      visibleNotes.push([currentNote]);
    }
  }

  // Colunas O:S.
  sh.getRange(2, 15, numRows, 5).setValues(auxRows);

  // Coluna J, apenas se solicitado.
  if (opt.normalizeVisibleNotes) {
    sh.getRange(2, 10, numRows, 1).setValues(visibleNotes);
  }

  SpreadsheetApp.flush();

  if (opt.sort !== false && numRows > 1) {
    sh.getRange(2, 1, numRows, 19).sort([
      { column: 15, ascending: true },  // SYS_SORT_GRUPO
      { column: 16, ascending: true },  // SYS_SORT_SUBPRIORIDADE
      { column: 17, ascending: true },  // SYS_SORT_DATA; negativo = mais recente primeiro
      { column: 5,  ascending: true },  // CONTA
      { column: 2,  ascending: true },  // DESCRICAO
      { column: 3,  ascending: true }   // VALOR
    ]);
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    patch: GFP_SORT_MESA_PATCH_16_1_18_3,
    rows: numRows,
    notesAdjusted: notesAdjusted,
    sorted: opt.sort !== false,
    criteria: "O:P:Q:E:B:C",
    notePolicy: "NOTAS não participa da ordenação; NOTAS só é normalizada visualmente quando contradiz STATUS."
  };
}


function GFP_SORT_MESA_CLASSIFICAR_LINHA_16_1_18_3_(row) {
  const data = row[0];
  const descricao = String(row[1] || "").trim();
  const valor = Number(row[2] || 0);
  const conta = String(row[4] || "").trim();
  const categoria = String(row[5] || "").trim();
  const status = String(row[8] || "").trim();
  const statusUpper = status.toUpperCase();
  const meta = GFP_SORT_MESA_PARSE_JSON_16_1_18_3_(row[13]);
  const cp = meta && meta.classificationParams ? meta.classificationParams : {};

  const categoryIs99 = /^99\./.test(categoria);
  const hasCategory = !!categoria;
  const cpStatus = String(cp.status || "").trim().toUpperCase();
  const source = String(cp.source || "").trim().toUpperCase();
  const faixa = GFP_SORT_MESA_FAIXA_16_1_18_3_(statusUpper, cp);
  const confidence = GFP_SORT_MESA_CONFIDENCE_16_1_18_3_(statusUpper, cp, faixa);

  let effectiveStatus = statusUpper || cpStatus || "";
  let group = 50;
  let sub = 900;

  if (statusUpper === "OK" || statusUpper === "CONFERIDO" || statusUpper === "ARQUIVADO" || categoryIs99) {
    group = 90;
    sub = categoryIs99 ? 910 : 900;
    effectiveStatus = statusUpper || "OK";

  } else if (!hasCategory) {
    group = 30;
    sub = 900;
    effectiveStatus = statusUpper || "SEM_CATEGORIA";

  } else if (statusUpper === "PENDENTE_CATEGORIZADA") {
    group = 20;
    sub = 500;
    effectiveStatus = "PENDENTE_CATEGORIZADA";

  } else {
    const prefix = GFP_SORT_MESA_PREFIX_16_1_18_3_(statusUpper, cpStatus, source);

    if (prefix) {
      group = 10;
      effectiveStatus = prefix + "_" + faixa;

      if (prefix === "MODELO" && faixa === "FORTE") sub = 10;
      else if (prefix === "GEMINI" && faixa === "FORTE") sub = 20;
      else if (prefix === "MODELO" && faixa === "MEDIO") sub = 30;
      else if (prefix === "GEMINI" && faixa === "MEDIO") sub = 40;
      else if (prefix === "MODELO" && faixa === "FRACO") sub = 50;
      else if (prefix === "GEMINI" && faixa === "FRACO") sub = 60;
      else if (faixa === "BAIXO") sub = 70;
      else sub = 80;

      // Ajuste fino por confiança, sem usar NOTAS.
      // Maior confiança sobe dentro da mesma faixa.
      sub += Math.max(0, 100 - confidence) / 1000;

    } else if (statusUpper === "REVISAR" || statusUpper === "MANUAL") {
      group = 10;
      sub = 80;
      effectiveStatus = statusUpper;

    } else {
      group = 20;
      sub = 500;
      effectiveStatus = statusUpper || "PENDENTE_CATEGORIZADA";
    }
  }

  const epochDay = GFP_SORT_MESA_DATE_TO_EPOCH_DAY_16_1_18_3_(data);
  const sortDate = epochDay ? -epochDay : 99999999;

  return {
    group: group,
    subPriority: Math.round(sub * 1000) / 1000,
    sortDate: sortDate,
    effectiveStatus: effectiveStatus,
    faixa: faixa,
    confidence: confidence,
    audit: [
      group,
      Math.round(sub * 1000) / 1000,
      GFP_SORT_MESA_DATE_KEY_16_1_18_3_(data),
      conta,
      descricao,
      valor
    ].join("|"),
    categoria: categoria,
    statusUpper: statusUpper,
    cpStatus: cpStatus,
    source: source
  };
}


function GFP_SORT_MESA_NOTA_VISIVEL_16_1_18_3_(info, currentNote) {
  const s = String(info.effectiveStatus || info.statusUpper || "").toUpperCase();

  if (!s || s === "OK" || s === "CONFERIDO" || s === "ARQUIVADO") {
    return currentNote;
  }

  let expected = "";

  if (s.indexOf("MODELO_FORTE") >= 0) expected = "Modelo FORTE " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("MODELO_MEDIO") >= 0) expected = "Modelo MÉDIO " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("MODELO_FRACO") >= 0) expected = "Modelo FRACO " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("GEMINI_FORTE") >= 0) expected = "Gemini FORTE " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("GEMINI_MEDIO") >= 0) expected = "Gemini MÉDIO " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("GEMINI_FRACO") >= 0) expected = "Gemini FRACO " + (info.confidence || "") + "% — ver nota";
  else if (s.indexOf("BAIXO") >= 0) expected = "Baixa confiança — revisar";
  else if (s === "PENDENTE_CATEGORIZADA") expected = "Categoria sugerida — revisar";
  else if (s === "REVISAR" || s === "MANUAL") expected = "Revisar manualmente";
  else return currentNote;

  expected = expected.replace(" 0%", "").replace(" %", "");

  const n = String(currentNote || "").toUpperCase();

  // Só altera quando o texto visível contradiz claramente a faixa/status.
  const hasContradiction =
    (s.indexOf("MEDIO") >= 0 && (n.indexOf("FRACO") >= 0 || n.indexOf("BAIX") >= 0 || n.indexOf("FORTE") >= 0)) ||
    (s.indexOf("FRACO") >= 0 && (n.indexOf("MÉDIO") >= 0 || n.indexOf("MEDIO") >= 0 || n.indexOf("FORTE") >= 0)) ||
    (s.indexOf("FORTE") >= 0 && (n.indexOf("FRACO") >= 0 || n.indexOf("MÉDIO") >= 0 || n.indexOf("MEDIO") >= 0 || n.indexOf("BAIX") >= 0)) ||
    (s === "PENDENTE_CATEGORIZADA" && (n.indexOf("GEMINI") >= 0 || n.indexOf("MODELO") >= 0));

  if (!currentNote || hasContradiction) return expected;

  return currentNote;
}


function GFP_SORT_MESA_PREFIX_16_1_18_3_(statusUpper, cpStatus, source) {
  const s = String(statusUpper || "");
  const c = String(cpStatus || "");
  const src = String(source || "");

  if (s.indexOf("MODELO_") === 0 || c.indexOf("MODELO_") === 0 || src.indexOf("MODELO") >= 0) return "MODELO";
  if (s.indexOf("GEMINI_") === 0 || c.indexOf("GEMINI_") === 0 || src.indexOf("GEMINI") >= 0) return "GEMINI";

  return "";
}


function GFP_SORT_MESA_FAIXA_16_1_18_3_(statusUpper, cp) {
  const s = String(statusUpper || "").toUpperCase();
  const cpStatus = String(cp && cp.status || "").toUpperCase();
  const cpFaixa = String(cp && cp.faixa || "").toUpperCase();

  const raw = [cpStatus, cpFaixa, s].join(" ");

  if (raw.indexOf("FORTE") >= 0) return "FORTE";
  if (raw.indexOf("MEDIO") >= 0 || raw.indexOf("MÉDIO") >= 0 || raw.indexOf("MEDIA") >= 0 || raw.indexOf("MÉDIA") >= 0) return "MEDIO";
  if (raw.indexOf("FRACO") >= 0 || raw.indexOf("FRACA") >= 0) return "FRACO";
  if (raw.indexOf("BAIXO") >= 0 || raw.indexOf("BAIXA") >= 0) return "BAIXO";

  const conf = GFP_SORT_MESA_CONFIDENCE_16_1_18_3_(s, cp, "");

  if (conf >= 95) return "FORTE";
  if (conf >= 80) return "MEDIO";
  if (conf > 0) return "FRACO";

  return "FRACO";
}


function GFP_SORT_MESA_CONFIDENCE_16_1_18_3_(statusUpper, cp, faixa) {
  const direct = Number(cp && cp.confidence);
  if (!isNaN(direct) && direct > 0) return Math.max(0, Math.min(100, direct));

  const modelScore = Number(cp && cp.modelScore);
  if (!isNaN(modelScore) && modelScore > 0) return Math.max(0, Math.min(100, modelScore));

  const conf = String(cp && cp.confidence || "").toUpperCase();
  if (conf === "HIGH" || conf === "ALTA" || conf === "FORTE") {
    const s = String(statusUpper || "").toUpperCase();
    if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return 85;
    if (s.indexOf("FRACO") >= 0) return 65;
    if (s.indexOf("FORTE") >= 0) return 95;
    return 85;
  }

  const f = String(faixa || "").toUpperCase();
  if (f.indexOf("FORTE") >= 0) return 95;
  if (f.indexOf("MEDIO") >= 0 || f.indexOf("MÉDIO") >= 0) return 85;
  if (f.indexOf("FRACO") >= 0) return 65;

  const s2 = String(statusUpper || "").toUpperCase();
  if (s2.indexOf("FORTE") >= 0) return 95;
  if (s2.indexOf("MEDIO") >= 0 || s2.indexOf("MÉDIO") >= 0) return 85;
  if (s2.indexOf("FRACO") >= 0) return 65;

  return 0;
}


function GFP_SORT_MESA_ENSURE_AS_16_1_18_3_(sh) {
  if (sh.getMaxColumns() < 19) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 19 - sh.getMaxColumns());
  }

  const headers = [
    "SYS_SORT_GRUPO",
    "SYS_SORT_SUBPRIORIDADE",
    "SYS_SORT_DATA",
    "SYS_SORT_STATUS",
    "SYS_SORT_AUDIT"
  ];

  sh.getRange(1, 15, 1, 5).setValues([headers]);
}


function GFP_SORT_MESA_DATE_TO_EPOCH_DAY_16_1_18_3_(value) {
  const d = GFP_SORT_MESA_TO_DATE_16_1_18_3_(value);
  if (!d) return null;

  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}


function GFP_SORT_MESA_DATE_KEY_16_1_18_3_(value) {
  const d = GFP_SORT_MESA_TO_DATE_16_1_18_3_(value);
  if (!d) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return y + "-" + m + "-" + day;
}


function GFP_SORT_MESA_TO_DATE_16_1_18_3_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const s = String(value || "").trim();

  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  return null;
}


function GFP_SORT_MESA_PARSE_JSON_16_1_18_3_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}
