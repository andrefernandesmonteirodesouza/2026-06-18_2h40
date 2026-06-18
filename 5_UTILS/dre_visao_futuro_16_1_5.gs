/**
 * 📂 ARQUIVO: 5_UTILS/dre_visao_futuro_16_1_5.gs
 * 📊 MÓDULO: DRE + VISÃO FUTURO DOMÉSTICAS
 * 🔢 VERSÃO: 16.1.5
 *
 * Reconstrói:
 * - DRE_GERENCIAL
 * - VISAO_FUTURO
 *
 * Fontes:
 * - DB_TRANSACOES
 * - DB_TRANSACOES_HIST
 *
 * Não usa QUERY.
 * Não cria auditorias.
 * Não cria relatórios técnicos.
 */

const GFP_DRE_VISAO_VERSION_16_1_5 = "16.1.5";

function GFP_DRE_VISAO_RECONSTRUIR_16_1_5() {
  const result = {
    version: GFP_DRE_VISAO_VERSION_16_1_5,
    mode: "DRE_ONLY_AFTER_VISAO_FUTURO_DEPRECATED_16_1_6_2",
    startedAt: new Date().toISOString(),
    dre: null,
    futuro: {
      skipped: true,
      reason: "VISAO_FUTURO foi descontinuada. A visão oficial de parcelamentos está no Dashboard 2.0."
    },
    ok: true,
    errors: []
  };

  try {
    result.dre = GFP_DRE_RECONSTRUIR_16_1_5();
  } catch (e) {
    result.ok = false;
    result.errors.push("DRE: " + e.message);
  }

  result.finishedAt = new Date().toISOString();

  GFP_DRE_VISAO_LOG_16_1_5_(
    result.ok ? "OK" : "WARN",
    result.ok
      ? "DRE atualizada."
      : "DRE atualizada com alertas: " + result.errors.join(" | ")
  );

  return result;
}




// =============================================================================
// DRE GERENCIAL
// =============================================================================

function GFP_DRE_RECONSTRUIR_16_1_5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = GFP_DRE_VISAO_GET_OR_CREATE_SHEET_16_1_5_("DRE_GERENCIAL");

  const txs = GFP_DRE_VISAO_GET_TRANSACOES_16_1_5_();

  const dreRows = txs.filter(function(t) {
    return GFP_DRE_IS_ELEGIVEL_16_1_5_(t);
  });

  const monthsSet = {};
  const data = {};

  dreRows.forEach(function(t) {
    const month = GFP_DRE_CASH_MONTH_16_1_5_(t);
    if (!month) return;

    const cat = t.categoria || "Sem categoria";
    const valor = Number(t.valor || 0);

    monthsSet[month] = true;

    if (!data[cat]) data[cat] = {};
    if (!data[cat][month]) data[cat][month] = 0;

    data[cat][month] += valor;
  });

  const months = Object.keys(monthsSet).sort();
  const cats = Object.keys(data).sort();

  sh.clear();

  sh.getRange(1, 1, 1, Math.max(2, months.length + 1)).merge();
  sh.getRange(1, 1).setValue("📊 DRE GERENCIAL (FLUXO DE CAIXA REALIZADO)");

  sh.getRange(3, 1).setValue("CATEGORIA / MÊS");

  months.forEach(function(m, idx) {
    sh.getRange(3, idx + 2).setValue(m);
  });

  if (!cats.length || !months.length) {
    sh.getRange(5, 1).setValue("Nenhum lançamento realizado encontrado para a DRE.");
    GFP_DRE_FORMAT_16_1_5_(sh, 5, Math.max(2, months.length + 1));
    return { ok: true, categorias: 0, meses: months.length, linhasFonte: dreRows.length };
  }

  const output = cats.map(function(cat) {
    const row = [cat];

    months.forEach(function(m) {
      row.push(data[cat][m] || 0);
    });

    return row;
  });

  sh.getRange(4, 1, output.length, output[0].length).setValues(output);

  const totalRow = output.length + 4;
  sh.getRange(totalRow, 1).setValue("TOTAL");

  for (let c = 2; c <= months.length + 1; c++) {
    const col = GFP_DRE_COL_LETTER_16_1_5_(c);
    sh.getRange(totalRow, c).setFormula("=SUM(" + col + "4:" + col + (totalRow - 1) + ")");
  }

  GFP_DRE_FORMAT_16_1_5_(sh, totalRow, months.length + 1);

  return {
    ok: true,
    categorias: cats.length,
    meses: months.length,
    linhasFonte: dreRows.length
  };
}

function GFP_DRE_IS_ELEGIVEL_16_1_5_(t) {
  const tipo = String(t.tipo || "").toUpperCase().trim();
  const status = String(t.status || "").toUpperCase().trim();
  const categoria = String(t.categoria || "").trim();

  if (!t.data || !categoria) return false;

  if (tipo === "T" || tipo === "S") return false;
  if (categoria.indexOf("99.") === 0) return false;

  // A DRE realizada deve considerar apenas lançamentos já confirmados.
  // Em regra, eles estarão no histórico com status OK.
  if (status && ["OK", "CONCILIADO", "VALIDADO", "APROVADO"].indexOf(status) < 0) {
    return false;
  }

  return true;
}

function GFP_DRE_CASH_MONTH_16_1_5_(t) {
  const meta = t.metadados || "";

  const cash = GFP_DRE_VISAO_META_FIELD_16_1_5_(meta, "cashMonth");

  if (cash && /^\d{4}-\d{2}$/.test(cash)) {
    return cash;
  }

  const d = GFP_DRE_VISAO_TO_DATE_16_1_5_(t.data);
  if (!d) return "";

  return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM");
}

function GFP_DRE_FORMAT_16_1_5_(sh, lastRow, lastCol) {
  lastRow = Math.max(lastRow || sh.getLastRow(), 5);
  lastCol = Math.max(lastCol || sh.getLastColumn(), 2);

  const COLOR_TITLE = "#1E293B";       // azul escuro / slate
  const COLOR_HEADER = "#1F4E78";      // azul principal da tabela
  const COLOR_HEADER_SOFT = "#E2E8F0"; // azul/cinza suave
  const COLOR_TEXT = "#0F172A";
  const COLOR_MUTED = "#64748B";
  const COLOR_RECEITA = "#0B8043";
  const COLOR_DESPESA = "#CC0000";
  const COLOR_ATENCAO = "#B45309";
  const COLOR_BLUE = "#2563EB";
  const COLOR_TOTAL_BG = "#E2E8F0";

  sh.setFrozenRows(3);

  // Título — mesmo espírito visual da VISAO_FUTURO azul.
  sh.getRange(1, 1, 1, lastCol)
    .merge()
    .setBackground(COLOR_TITLE)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(13)
    .setHorizontalAlignment("center")
    .setValue("📊 DRE GERENCIAL (FLUXO DE CAIXA REALIZADO)");

  // Linha de apoio, discreta.
  try {
    sh.getRange(2, 1, 1, lastCol).merge();
    sh.getRange(2, 1)
      .setValue("Receitas em verde, despesas em vermelho. Base realizada: DB_TRANSACOES + DB_TRANSACOES_HIST.")
      .setFontColor(COLOR_MUTED)
      .setFontSize(9)
      .setHorizontalAlignment("center")
      .setBackground("#ffffff");
  } catch (e) {}

  // Cabeçalho.
  sh.getRange(3, 1, 1, lastCol)
    .setBackground(COLOR_HEADER)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBorder(false, false, true, false, false, false, COLOR_HEADER_SOFT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Formato monetário.
  if (lastRow >= 4 && lastCol >= 2) {
    sh.getRange(4, 2, Math.max(1, lastRow - 3), Math.max(1, lastCol - 1))
      .setNumberFormat('R$ #,##0.00;R$ -#,##0.00;R$ 0.00');
  }

  if (lastRow >= 4) {
    const labels = sh.getRange(4, 1, lastRow - 3, 1).getValues();

    labels.forEach(function(row, idx) {
      const sheetRow = idx + 4;
      const label = String(row[0] || "").trim();
      const upper = label.toUpperCase();

      let rowColor = COLOR_TEXT;
      let rowBg = "#ffffff";
      let weight = "normal";

      if ((sheetRow - 4) % 2 === 1) {
        rowBg = "#F8FAFC";
      }

      if (upper === "TOTAL") {
        rowColor = COLOR_TEXT;
        rowBg = COLOR_TOTAL_BG;
        weight = "bold";
      } else if (
        upper.indexOf("RECEITA") >= 0 ||
        upper.indexOf("RECEITAS") >= 0 ||
        upper.indexOf("01.") === 0
      ) {
        rowColor = COLOR_RECEITA;
        weight = "bold";
      } else if (
        upper.indexOf("DESPESA") >= 0 ||
        upper.indexOf("DESPESAS") >= 0 ||
        upper.indexOf("02.") === 0
      ) {
        rowColor = COLOR_DESPESA;
        weight = "bold";
      } else if (
        upper.indexOf("SEM CATEGORIA") >= 0 ||
        upper.indexOf("NÃO IDENTIFICADA") >= 0 ||
        upper.indexOf("NAO IDENTIFICADA") >= 0
      ) {
        rowColor = COLOR_ATENCAO;
        weight = "bold";
      }

      // Linha inteira recebe a cor-base da categoria.
      sh.getRange(sheetRow, 1, 1, lastCol)
        .setFontColor(rowColor)
        .setFontWeight(weight)
        .setBackground(rowBg);

      // Mas os valores são ajustados célula a célula:
      // positivo verde, negativo vermelho, zero cinza/azul discreto.
      if (lastCol >= 2) {
        const valueRange = sh.getRange(sheetRow, 2, 1, lastCol - 1);
        const values = valueRange.getValues()[0];

        const fontColors = values.map(function(v) {
          const n = Number(v || 0);

          if (upper === "TOTAL") {
            if (n > 0) return COLOR_RECEITA;
            if (n < 0) return COLOR_DESPESA;
            return COLOR_TEXT;
          }

          if (n > 0) return COLOR_RECEITA;
          if (n < 0) return COLOR_DESPESA;

          // Zero fica discreto, para não poluir a DRE.
          return COLOR_MUTED;
        });

        valueRange.setFontColors([fontColors]);
      }
    });
  }

  // Linha total, se existir.
  const totalFinder = sh.createTextFinder("TOTAL").matchEntireCell(true).findNext();
  if (totalFinder) {
    const totalRow = totalFinder.getRow();

    sh.getRange(totalRow, 1, 1, lastCol)
      .setFontWeight("bold")
      .setBackground(COLOR_TOTAL_BG)
      .setBorder(true, false, false, false, false, false, COLOR_HEADER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  // Larguras parecidas com a VISAO_FUTURO: mais respiro e leitura melhor.
  sh.setColumnWidth(1, 430);

  for (let c = 2; c <= lastCol; c++) {
    sh.setColumnWidth(c, 115);
  }

  // Visual limpo.
  try {
    sh.getRange(1, 1, lastRow, lastCol).setWrap(false);
  } catch (e2) {}

  try {
    if (lastRow >= 4) {
      sh.setRowHeights(4, lastRow - 3, 24);
    }
  } catch (e3) {}

  // Alinhamentos.
  try {
    sh.getRange(4, 1, Math.max(1, lastRow - 3), 1).setHorizontalAlignment("left");
    if (lastCol >= 2) {
      sh.getRange(4, 2, Math.max(1, lastRow - 3), lastCol - 1).setHorizontalAlignment("right");
    }
  } catch (e4) {}
}



// =============================================================================
// VISAO FUTURO
// =============================================================================

function GFP_VISAO_FUTURO_RECONSTRUIR_16_1_5() {
  return {
    ok: true,
    skipped: true,
    deprecated: true,
    version: "16.1.6.2",
    reason: "VISAO_FUTURO foi descontinuada. Use Dashboard 2.0 > Parcelamentos."
  };
}

function GFP_VISAO_FUTURO_KEY_16_1_5_(t) {
  return [
    GFP_VISAO_FUTURO_CLEAN_DESC_16_1_5_(t.descricao).toUpperCase(),
    String(t.conta || "").toUpperCase(),
    String(t.categoria || "").toUpperCase(),
    String(t.parcTotal || ""),
    String(Math.abs(Number(t.valor || 0)).toFixed(2))
  ].join("|");
}

function GFP_VISAO_FUTURO_CLEAN_DESC_16_1_5_(desc) {
  return String(desc || "")
    .replace(/^\[\d{1,2}\/\d{1,2}\]\s*/g, "")
    .replace(/\bPARC\s*\d{1,2}\/\d{1,2}\b/gi, "")
    .replace(/\bPARC\d{1,2}\/\d{1,2}\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_VISAO_FUTURO_BASE_DUE_DATE_16_1_5_(t) {
  const meta = t.metadados || "";

  const invoiceDueDate = GFP_DRE_VISAO_META_FIELD_16_1_5_(meta, "invoiceDueDate");

  if (invoiceDueDate) {
    const d = GFP_DRE_VISAO_TO_DATE_16_1_5_(invoiceDueDate);
    if (d) return d;
  }

  const cashMonth = GFP_DRE_VISAO_META_FIELD_16_1_5_(meta, "cashMonth");
  if (cashMonth && /^\d{4}-\d{2}$/.test(cashMonth)) {
    return new Date(Number(cashMonth.substring(0, 4)), Number(cashMonth.substring(5, 7)) - 1, 10);
  }

  return GFP_DRE_VISAO_TO_DATE_16_1_5_(t.data);
}

function GFP_VISAO_FUTURO_ADD_MONTHS_16_1_5_(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();

  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));

  return d;
}

function GFP_VISAO_FUTURO_FORMAT_16_1_5_(sh, lastRow) {
  lastRow = Math.max(lastRow || sh.getLastRow(), 5);

  const COLOR_TITLE = "#1E293B";       // azul escuro inspirado na DRE antiga
  const COLOR_HEADER = "#1F4E78";      // azul clássico do sistema
  const COLOR_HEADER_SOFT = "#E2E8F0"; // azul/cinza suave
  const COLOR_BLUE = "#2563EB";        // azul principal do Dashboard 2.0
  const COLOR_TEXT = "#0F172A";
  const COLOR_MUTED = "#64748B";
  const COLOR_RED = "#CC0000";

  sh.setFrozenRows(3);

  // Título
  sh.getRange(1, 1, 1, 6)
    .setBackground(COLOR_TITLE)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(13)
    .setHorizontalAlignment("center");

  // Cabeçalho da tabela
  sh.getRange(3, 1, 1, 6)
    .setBackground(COLOR_HEADER)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBorder(false, false, true, false, false, false, COLOR_HEADER_SOFT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Corpo
  if (lastRow >= 4) {
    const bodyRows = Math.max(1, lastRow - 3);

    sh.getRange(4, 1, bodyRows, 6)
      .setFontColor(COLOR_TEXT)
      .setBackground("#ffffff")
      .setWrap(false);

    sh.getRange(4, 1, bodyRows, 1).setNumberFormat("dd/mm/yyyy");
    sh.getRange(4, 3, bodyRows, 1).setNumberFormat('R$ #,##0.00;R$ -#,##0.00;R$ 0.00');

    // Valores de parcelas normalmente são saídas; ficam em vermelho.
    sh.getRange(4, 3, bodyRows, 1).setFontColor(COLOR_RED);

    // Dias restantes em azul para ficar fácil de bater o olho.
    sh.getRange(4, 6, bodyRows, 1)
      .setFontColor(COLOR_BLUE)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");

    // Datas com leve destaque.
    sh.getRange(4, 1, bodyRows, 1)
      .setFontColor(COLOR_TEXT)
      .setFontWeight("bold");

    // Linhas alternadas discretas.
    for (let r = 4; r <= lastRow; r++) {
      if ((r - 4) % 2 === 1) {
        sh.getRange(r, 1, 1, 6).setBackground("#F8FAFC");
      }
    }
  }

  // Total futuro, se existir.
  const totalFinder = sh.createTextFinder("TOTAL FUTURO").matchEntireCell(true).findNext();
  if (totalFinder) {
    const totalRow = totalFinder.getRow();

    sh.getRange(totalRow, 1, 1, 6)
      .setBackground(COLOR_HEADER_SOFT)
      .setFontColor(COLOR_TEXT)
      .setFontWeight("bold")
      .setBorder(true, false, false, false, false, false, COLOR_HEADER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    sh.getRange(totalRow, 3)
      .setFontColor(COLOR_RED)
      .setNumberFormat('R$ #,##0.00;R$ -#,##0.00;R$ 0.00');
  }

  // Larguras
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 400);
  sh.setColumnWidth(3, 115);
  sh.setColumnWidth(4, 190);
  sh.setColumnWidth(5, 410);
  sh.setColumnWidth(6, 120);

  // Altura normal.
  try {
    if (lastRow >= 4) {
      sh.setRowHeights(4, lastRow - 3, 24);
    }
  } catch (e) {}

  // Observação visual: esta aba é base tabular temporária.
  try {
    sh.getRange(2, 1, 1, 6).merge();
    sh.getRange(2, 1)
      .setValue("Base tabular dos parcelamentos futuros. A visão definitiva deverá ficar no Dashboard 2.0.")
      .setFontColor(COLOR_MUTED)
      .setFontSize(9)
      .setHorizontalAlignment("center");
  } catch (e2) {}
}




// =============================================================================
// LEITURA DE TRANSAÇÕES
// =============================================================================

function GFP_DRE_VISAO_GET_TRANSACOES_16_1_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let all = [];

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    all = all.concat(GFP_DRE_VISAO_READ_SHEET_16_1_5_(sh, sheetName));
  });

  return all;
}

function GFP_DRE_VISAO_READ_SHEET_16_1_5_(sh, sourceName) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(h) {
    return String(h || "").trim().toUpperCase();
  });

  function idx(name) {
    return headers.indexOf(name);
  }

  const iData = idx("DATA");
  const iDescricao = idx("DESCRICAO");
  const iValor = idx("VALOR");
  const iTipo = idx("TIPO");
  const iConta = idx("CONTA");
  const iCategoria = idx("CATEGORIA");
  const iParcAtual = idx("PARC_ATUAL");
  const iParcTotal = idx("PARC_TOTAL");
  const iStatus = idx("STATUS");
  const iMetadados = idx("METADADOS");

  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    if (!row[iData] && !row[iDescricao]) continue;

    out.push({
      source: sourceName,
      rowNumber: r + 1,
      data: iData >= 0 ? row[iData] : null,
      descricao: iDescricao >= 0 ? row[iDescricao] : "",
      valor: iValor >= 0 ? row[iValor] : 0,
      tipo: iTipo >= 0 ? row[iTipo] : "",
      conta: iConta >= 0 ? row[iConta] : "",
      categoria: iCategoria >= 0 ? row[iCategoria] : "",
      parcAtual: iParcAtual >= 0 ? row[iParcAtual] : "",
      parcTotal: iParcTotal >= 0 ? row[iParcTotal] : "",
      status: iStatus >= 0 ? row[iStatus] : "",
      metadados: iMetadados >= 0 ? row[iMetadados] : ""
    });
  }

  return out;
}


// =============================================================================
// HELPERS
// =============================================================================

function GFP_DRE_VISAO_GET_OR_CREATE_SHEET_16_1_5_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  if (sh.isSheetHidden()) {
    sh.showSheet();
  }

  return sh;
}

function GFP_DRE_VISAO_TO_DATE_16_1_5_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    const d = new Date(value.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const s = String(value || "").trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    d.setHours(0, 0, 0, 0);
    return d;
  }

  return null;
}

function GFP_DRE_VISAO_META_FIELD_16_1_5_(meta, field) {
  const text = String(meta || "");

  if (!text) return "";

  try {
    const obj = JSON.parse(text);
    if (obj && obj[field] != null) return String(obj[field]);
  } catch (e) {}

  const re = new RegExp('"' + field + '"\\s*:\\s*"([^"]+)"');
  const m = text.match(re);

  return m ? m[1] : "";
}

function GFP_DRE_COL_LETTER_16_1_5_(col) {
  let temp = "";
  let letter = "";

  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }

  return letter;
}

function GFP_DRE_VISAO_LOG_16_1_5_(level, message) {
  try {
    if (typeof Logger === "function") {
      Logger(message, "Visões financeiras", null, level || "INFO");
      return;
    }
  } catch (e) {}

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) sh = ss.insertSheet("SYS_LOGS");

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      level || "INFO",
      "Visões financeiras",
      message || "",
      ""
    ]]);
  } catch (e2) {}
}

/**
 * GFP 16.1.6.2 — Descontinua fisicamente a aba VISAO_FUTURO.
 *
 * Execute uma vez:
 *
 *   GFP_VISAO_FUTURO_DESCONTINUAR_16_1_6_2()
 *
 * Depois disso, a aba não deve voltar a ser criada, porque:
 * - GFP_DRE_VISAO_RECONSTRUIR_16_1_5 agora só atualiza DRE;
 * - GFP_VISAO_FUTURO_RECONSTRUIR_16_1_5 agora é no-op seguro.
 */
function GFP_VISAO_FUTURO_DESCONTINUAR_16_1_6_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("VISAO_FUTURO");

  let removed = false;

  if (sh) {
    const fallback =
      ss.getSheetByName("DRE_GERENCIAL") ||
      ss.getSheetByName("DB_TRANSACOES") ||
      ss.getSheetByName("SYS_LOGS") ||
      ss.getSheets()[0];

    if (fallback) {
      ss.setActiveSheet(fallback);
    }

    ss.deleteSheet(sh);
    removed = true;
  }

  try {
    GFP_DRE_RECONSTRUIR_16_1_5();
  } catch (e) {
    // Não interrompe a descontinuação se a DRE falhar por outro motivo.
  }

  const msg = removed
    ? "Aba VISAO_FUTURO removida. A visão de parcelamentos agora fica no Dashboard 2.0 > Parcelamentos."
    : "Aba VISAO_FUTURO já não existia. A visão de parcelamentos fica no Dashboard 2.0 > Parcelamentos.";

  try {
    if (typeof Logger === "function") {
      Logger(msg, "Sistema", null, "OK");
    }
  } catch (e2) {}

  SpreadsheetApp.getActive().toast(
    removed
      ? "VISAO_FUTURO removida. Use Dashboard > Parcelamentos."
      : "VISAO_FUTURO já estava removida.",
    "GFP 16.1.6.2"
  );

  return {
    ok: true,
    removed: removed,
    replacement: "Dashboard 2.0 > Parcelamentos"
  };
}
