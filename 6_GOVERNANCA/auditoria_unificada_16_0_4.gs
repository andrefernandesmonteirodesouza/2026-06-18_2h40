/**
 * =============================================================================
 * GFP 16.0.4 — SYS_AUDITORIA + ordenação de relatórios
 * =============================================================================
 *
 * SYS_LOGS       = histórico operacional/eventos.
 * SYS_RELATORIOS = journal/resumo técnico consolidado.
 * SYS_AUDITORIA  = auditoria tabular legível, uma linha por checagem.
 * =============================================================================
 */

const GFP_AUDITORIA_VERSION_16_0_4 = "16.0.4";

function GFP_AUDITORIA_RECONSTRUIR_DE_SYS_RELATORIOS_16_0_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rel = ss.getSheetByName("SYS_RELATORIOS");

  if (!rel) {
    SpreadsheetApp.getActive().toast("SYS_RELATORIOS não encontrada.", "GFP 16.0.4");
    return { ok: false, error: "SYS_RELATORIOS não encontrada." };
  }

  const audit = GFP_AUDITORIA_ENSURE_16_0_4_();

  // Recria a SYS_AUDITORIA de forma limpa.
  audit.clear();
  GFP_AUDITORIA_WRITE_HEADER_16_0_4_(audit);

  const lastRow = rel.getLastRow();
  const lastCol = rel.getLastColumn();

  if (lastRow < 2) {
    GFP_AUDITORIA_SORT_ALL_16_0_4();
    return { ok: true, imported: 0 };
  }

  const headers = rel.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) {
    return String(v || "").trim();
  });

  const values = rel.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idx = GFP_AUDITORIA_HEADER_INDEX_16_0_4_(headers);
  const rows = [];

  values.forEach(function(row, i) {
    const origemLinha = i + 2;

    const ts = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "TIMESTAMP_CONSOLIDACAO") || new Date();
    const origem = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "ORIGEM_ABA") || "SYS_RELATORIOS";
    const tipo = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "TIPO") || "RELATORIO";
    const status = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "STATUS") || "INFO";
    const etapa = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "ETAPA_CODIGO") || "";
    const detalhe = GFP_AUDITORIA_PICK_16_0_4_(row, idx, "DETALHE") || "";
    const payloadText = String(GFP_AUDITORIA_PICK_16_0_4_(row, idx, "PAYLOAD_JSON") || "").trim();

    // Linha-resumo do relatório.
    rows.push(GFP_AUDITORIA_ROW_16_0_4_({
      timestamp: ts,
      severidade: status,
      area: tipo,
      checagem: etapa,
      resultado: status,
      detalhe: detalhe,
      acao: "",
      origem: origem,
      origemLinha: origemLinha,
      payload: payloadText
    }));

    const payload = GFP_AUDITORIA_SAFE_PARSE_16_0_4_(payloadText);

    if (!payload) return;

    // Caso comum da promoção 16.0: payload.rows[]
    if (payload.rows && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(r) {
        rows.push(GFP_AUDITORIA_ROW_16_0_4_({
          timestamp: r.timestamp || ts,
          severidade: r.status || status,
          area: tipo,
          checagem: r.etapa || etapa,
          resultado: r.status || status,
          detalhe: r.detalhe || "",
          acao: "",
          origem: origem,
          origemLinha: origemLinha,
          payload: r.retorno || ""
        }));
      });
    }

    // Caso comum de Dashboard/Painel: payload.issues[]
    if (payload.issues && Array.isArray(payload.issues)) {
      payload.issues.forEach(function(issue) {
        if (Array.isArray(issue)) {
          rows.push(GFP_AUDITORIA_ROW_16_0_4_({
            timestamp: issue[0] || ts,
            severidade: issue[1] || status,
            area: issue[3] || tipo,
            checagem: issue[2] || etapa,
            resultado: issue[1] || status,
            detalhe: issue.slice(4).map(function(v) { return String(v || ""); }).join(" | "),
            acao: "",
            origem: origem,
            origemLinha: origemLinha,
            payload: JSON.stringify(issue)
          }));
        } else if (issue && typeof issue === "object") {
          rows.push(GFP_AUDITORIA_ROW_16_0_4_({
            timestamp: issue.timestamp || ts,
            severidade: issue.status || issue.severity || status,
            area: issue.area || tipo,
            checagem: issue.check || issue.code || etapa,
            resultado: issue.resultado || issue.status || status,
            detalhe: issue.message || issue.detalhe || JSON.stringify(issue).substring(0, 800),
            acao: issue.acao || issue.action || "",
            origem: origem,
            origemLinha: origemLinha,
            payload: JSON.stringify(issue)
          }));
        }
      });
    }
  });

  if (rows.length) {
    audit.getRange(2, 1, rows.length, 10).setValues(rows);
  }

  GFP_AUDITORIA_FORMAT_16_0_4_(audit);
  GFP_AUDITORIA_SORT_ALL_16_0_4();

  GFP_AUDITORIA_LOG_16_0_4_("AUDITORIA_UNIFICADA", "RECONSTRUIR", "OK", "SYS_AUDITORIA reconstruída a partir da SYS_RELATORIOS.", {
    importedRows: rows.length
  });

  SpreadsheetApp.getActive().toast(
    "SYS_AUDITORIA atualizada: " + rows.length + " linha(s).",
    "GFP 16.0.4"
  );

  return { ok: true, imported: rows.length };
}

function GFP_AUDITORIA_SORT_ALL_16_0_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ["SYS_RELATORIOS", "SYS_AUDITORIA"].forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 3) return;

    try {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
        .sort([{ column: 1, ascending: false }]);

      if (sh.getFilter()) sh.getFilter().remove();
      sh.getDataRange().createFilter();
      sh.setFrozenRows(1);
    } catch (e) {
      GFP_AUDITORIA_LOG_16_0_4_("AUDITORIA_UNIFICADA", "ORDENAR_" + name, "WARN", e.message, {});
    }
  });

  SpreadsheetApp.getActive().toast("SYS_RELATORIOS e SYS_AUDITORIA ordenadas.", "GFP 16.0.4");
}

function GFP_AUDITORIA_FINAL_16_0_4() {
  let result = null;

  if (typeof GFP_16_PROMOVER_ESTAVEL_FINAL === "function") {
    result = GFP_16_PROMOVER_ESTAVEL_FINAL();
  }

  const auditResult = GFP_AUDITORIA_RECONSTRUIR_DE_SYS_RELATORIOS_16_0_4();
  GFP_AUDITORIA_SORT_ALL_16_0_4();

  return {
    ok: !result || result.ok !== false,
    promocao16: result,
    auditoria: auditResult
  };
}

function GFP_AUDITORIA_ENSURE_16_0_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_AUDITORIA");

  if (!sh) sh = ss.insertSheet("SYS_AUDITORIA");

  if (sh.getLastRow() === 0) {
    GFP_AUDITORIA_WRITE_HEADER_16_0_4_(sh);
  }

  return sh;
}

function GFP_AUDITORIA_WRITE_HEADER_16_0_4_(sh) {
  const header = [
    "TIMESTAMP",
    "SEVERIDADE",
    "ÁREA",
    "CHECAGEM",
    "RESULTADO",
    "DETALHE",
    "AÇÃO SUGERIDA",
    "ORIGEM",
    "ORIGEM_LINHA",
    "PAYLOAD_JSON"
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);
  GFP_AUDITORIA_FORMAT_16_0_4_(sh);
}

function GFP_AUDITORIA_FORMAT_16_0_4_(sh) {
  const lastCol = Math.max(10, sh.getLastColumn());

  sh.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.autoResizeColumns(1, Math.min(lastCol, 10)); } catch (e) {}
  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e2) {}
  try { sh.getRange("F:J").setWrap(true); } catch (e3) {}
}

function GFP_AUDITORIA_HEADER_INDEX_16_0_4_(headers) {
  const idx = {};

  headers.forEach(function(h, i) {
    idx[GFP_AUDITORIA_NORM_16_0_4_(h)] = i;
  });

  return idx;
}

function GFP_AUDITORIA_PICK_16_0_4_(row, idx, name) {
  const i = idx[GFP_AUDITORIA_NORM_16_0_4_(name)];
  return i === undefined ? "" : row[i];
}

function GFP_AUDITORIA_ROW_16_0_4_(obj) {
  return [
    GFP_AUDITORIA_AS_DATE_16_0_4_(obj.timestamp),
    String(obj.severidade || "INFO").toUpperCase(),
    String(obj.area || ""),
    String(obj.checagem || ""),
    String(obj.resultado || ""),
    String(obj.detalhe || ""),
    String(obj.acao || ""),
    String(obj.origem || ""),
    obj.origemLinha || "",
    String(obj.payload || "")
  ];
}

function GFP_AUDITORIA_AS_DATE_16_0_4_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

function GFP_AUDITORIA_SAFE_PARSE_16_0_4_(text) {
  try {
    if (!text) return null;
    return JSON.parse(String(text));
  } catch (e) {
    return null;
  }
}

function GFP_AUDITORIA_NORM_16_0_4_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function GFP_AUDITORIA_LOG_16_0_4_(modulo, acao, status, detalhe, payload) {
  try {
    if (typeof GFP_SYS_LOG_15_9_7 === "function") {
      GFP_SYS_LOG_15_9_7(modulo, acao, status, detalhe, payload || {});
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("SYS_LOGS");
    if (!sh) return;

    sh.appendRow([
      new Date(),
      modulo || "AUDITORIA",
      acao || "EVENTO",
      status || "INFO",
      String(detalhe || "") + (payload ? " | payload=" + JSON.stringify(payload) : "")
    ]);
  } catch (e) {}
}


