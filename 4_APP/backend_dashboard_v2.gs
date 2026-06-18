/**
 * 📂 ARQUIVO: 4_APP/backend_dashboard_v2.gs
 * 🖥️ MÓDULO: DASHBOARD 2.0 / COCKPIT EXECUTIVO GFP
 * 🔢 VERSÃO: 15.2.0
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Dashboard executivo final sobre DB_TRANSACOES, respeitando:
 * - DRE em regime de caixa;
 * - cartões agrupados por cashMonth/competência da fatura quando houver METADADOS;
 * - categorias 99.* e T fora da DRE;
 * - visão de qualidade/revisão da base;
 * - drill-down por grupo/categoria/conta.
 * -----------------------------------------------------------------------------
 */

const GFP_DASH_V2_VERSION = "15.5.0";
const GFP_DASH_V2_DB = "DB_TRANSACOES";

/**
 * Ponto de entrada do Dashboard 2.0.
 */
function openDashboardV2() {
  const html = HtmlService
    .createTemplateFromFile("4_UI/dashboard_cockpit_v2")
    .evaluate()
    .setTitle("GFP — Dashboard 2.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setWidth(1380)
    .setHeight(900);

  SpreadsheetApp.getUi().showModalDialog(html, "GFP — Dashboard 2.0");
}

/**
 * Opções de filtro.
 */
function apiDashboardV2GetOptions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_DASH_V2_DB);

  if (!sh) {
    return {
      ok: false,
      error: "Aba DB_TRANSACOES não encontrada.",
      version: GFP_DASH_V2_VERSION,
      years: [new Date().getFullYear()],
      months: [],
      accounts: [],
      defaultYear: new Date().getFullYear(),
      defaultMonth: new Date().getMonth() + 1
    };
  }

  const sourceRows = GFP_DASH_V2_getSourceRows_();

  if (!sourceRows.length) {
    return {
      ok: true,
      version: GFP_DASH_V2_VERSION,
      years: [new Date().getFullYear()],
      months: [],
      accounts: [],
      defaultYear: new Date().getFullYear(),
      defaultMonth: new Date().getMonth() + 1
    };
  }

  const yearsSet = {};
  const monthsSet = {};
  const accountsSet = {};

  let latestMonthKey = "";

  sourceRows.forEach(function(src) {
    const parsed = GFP_DASH_V2_parseRow_(src.row, src.rowNumber, src.sheetName);
    if (!parsed.validDate && !parsed.effectiveMonth) return;

    if (parsed.account) accountsSet[parsed.account] = true;

    const mk = parsed.effectiveMonth;
    if (!mk) return;

    monthsSet[mk] = true;
    yearsSet[mk.slice(0, 4)] = true;

    if (!latestMonthKey || mk > latestMonthKey) latestMonthKey = mk;
  });

  const years = Object.keys(yearsSet).map(Number).sort(function(a, b) { return b - a; });
  const months = Object.keys(monthsSet).sort().reverse();

  const def = latestMonthKey || (new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0"));

  return {
    ok: true,
    version: GFP_DASH_V2_VERSION,
    years: years.length ? years : [new Date().getFullYear()],
    months: months,
    accounts: Object.keys(accountsSet).sort(),
    defaultYear: Number(def.slice(0, 4)),
    defaultMonth: Number(def.slice(5, 7))
  };
}

/**
 * API principal do Dashboard 2.0.
 *
 * filters:
 * {
 *   year: 2026,
 *   month: 5,
 *   account: "Tudo",
 *   status: "Tudo"
 * }
 */
function apiDashboardV2GetData(filters) {
  filters = filters || {};

  const year = Number(filters.year || new Date().getFullYear());
  const month = Number(filters.month || (new Date().getMonth() + 1));
  const accountFilter = String(filters.account || "Tudo");
  const statusFilter = String(filters.status || "Tudo");

  const targetMonthKey = year + "-" + String(month).padStart(2, "0");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_DASH_V2_DB);

  if (!sh) {
    return {
      ok: false,
      error: "Aba DB_TRANSACOES não encontrada.",
      version: GFP_DASH_V2_VERSION
    };
  }

  const result = GFP_DASH_V2_emptyResult_(targetMonthKey, year, month, accountFilter, statusFilter);

  const sourceRows = GFP_DASH_V2_getSourceRows_();

  if (!sourceRows.length) return result;

  const allParsed = [];
  sourceRows.forEach(function(src) {
    const parsed = GFP_DASH_V2_parseRow_(src.row, src.rowNumber, src.sheetName, src.archived);
    allParsed.push(parsed);
  });

  result.meta.sourceWorkRows = allParsed.filter(function(x) { return !x.archived; }).length;
  result.meta.sourceHistRows = allParsed.filter(function(x) { return x.archived; }).length;

  const selected = [];

  allParsed.forEach(function(item) {
    if (accountFilter !== "Tudo" && item.account !== accountFilter) return;
    if (statusFilter !== "Tudo" && item.statusKey !== statusFilter) return;
    if (item.effectiveMonth !== targetMonthKey) return;

    selected.push(item);
  });

  result.meta.totalRows = allParsed.length;
  result.meta.selectedRows = selected.length;

  selected.forEach(function(item) {
    GFP_DASH_V2_accumulateQuality_(result, item);

    if (!GFP_DASH_V2_isDreEligible_(item)) {
      result.quality.technicalIgnored++;
      return;
    }

    GFP_DASH_V2_accumulateDre_(result, item);
  });

  result.series = GFP_DASH_V2_buildSeries_(allParsed, year, month, accountFilter, statusFilter);
  result.parcelamentos = GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_(allParsed, {
    year: year,
    month: month,
    accountFilter: accountFilter
  });
  result.topExpenses = GFP_DASH_V2_sortTop_(result.topExpensesMap, 12, true);
  result.topRevenue = GFP_DASH_V2_sortTop_(result.topRevenueMap, 8, false);
  result.byAccount = GFP_DASH_V2_sortTop_(result.byAccountMap, 20, false);

  result.transactions = result.transactions
    .sort(function(a, b) {
      return Math.abs(b.value) - Math.abs(a.value);
    })
    .slice(0, 120);

  result.issues = result.issues.slice(0, 100);

  delete result.topExpensesMap;
  delete result.topRevenueMap;
  delete result.byAccountMap;

  result.kpis.operatingResult = result.kpis.revenue + result.kpis.expenses;
  result.kpis.cashFlow = result.kpis.revenue + result.kpis.expenses + result.kpis.investments;

  result.kpis.expensesAbs = Math.abs(result.kpis.expenses);
  result.kpis.investmentsAbs = Math.abs(result.kpis.investments);
  result.kpis.margin = result.kpis.revenue ? (result.kpis.operatingResult / result.kpis.revenue) : 0;

  result.health = GFP_DASH_V2_buildHealth_(result);

  return result;
}


/**
 * Resultado vazio.
 */
function GFP_DASH_V2_emptyResult_(monthKey, year, month, accountFilter, statusFilter) {
  return {
    ok: true,
    version: GFP_DASH_V2_VERSION,
    filters: {
      year: year,
      month: month,
      monthKey: monthKey,
      monthLabel: GFP_DASH_V2_monthLabel_(monthKey),
      account: accountFilter,
      status: statusFilter
    },
    meta: {
      totalRows: 0,
      selectedRows: 0,
      generatedAt: new Date().toISOString(),
      regime: "caixa",
      cardRule: "cartões usam cashMonth/competência da fatura quando disponível"
    },
    kpis: {
      revenue: 0,
      expenses: 0,
      expensesAbs: 0,
      investments: 0,
      investmentsAbs: 0,
      operatingResult: 0,
      cashFlow: 0,
      margin: 0
    },
    health: {
      label: "Sem dados",
      tone: "muted",
      message: "Não há dados para o filtro selecionado."
    },
    dre: {
      Receitas: { label: "Receitas", value: 0, groups: {} },
      Despesas: { label: "Despesas", value: 0, groups: {} },
      Investimentos: { label: "Investimentos", value: 0, groups: {} }
    },
    quality: {
      total: 0,
      reviewed: 0,
      pending: 0,
      unidentified: 0,
      technicalIgnored: 0,
      transfers: 0
    },
    series: [],
    topExpensesMap: {},
    topRevenueMap: {},
    byAccountMap: {},
    topExpenses: [],
    topRevenue: [],
    byAccount: [],
    transactions: [],
    issues: []
  };
}


/**
 * Fonte unificada do Dashboard 2.0.
 *
 * GFP 15.2:
 * - se existir o helper do core_datalake, lê DB_TRANSACOES + DB_TRANSACOES_HIST;
 * - caso contrário, mantém fallback lendo apenas DB_TRANSACOES.
 */
function GFP_DASH_V2_getSourceRows_() {
  let sourceRows = [];

  // Preferência: helper oficial do datalake, se existir.
  if (typeof GFP_DATALAKE_GET_ACTIVE_ROWS_15_2 === "function") {
    try {
      sourceRows = GFP_DATALAKE_GET_ACTIVE_ROWS_15_2() || [];
    } catch (e) {
      sourceRows = [];
    }
  }

  // Fallback robusto: lê mesa + histórico diretamente.
  if (!sourceRows.length) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const work = ss.getSheetByName("DB_TRANSACOES");
    const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

    if (work && work.getLastRow() >= 2) {
      const values = work.getRange(2, 1, work.getLastRow() - 1, 14).getValues();

      values.forEach(function(row, idx) {
        sourceRows.push({
          row: row,
          sheetName: "DB_TRANSACOES",
          rowNumber: idx + 2,
          archived: false
        });
      });
    }

    if (hist && hist.getLastRow() >= 2) {
      const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();

      values.forEach(function(fullRow, idx) {
        const histStatus = GFP_DASH_V2_norm_(fullRow[19]);

        // GFP 15.5 — Dashboard só lê histórico ativo.
        if (histStatus !== "ARQUIVADO") return;

        sourceRows.push({
          row: fullRow.slice(0, 14),
          sheetName: "DB_TRANSACOES_HIST",
          rowNumber: idx + 2,
          archived: true
        });
      });
    }
  }

  return GFP_DASH_V2_dedupeSourceRows_15_5_(sourceRows);
}


/**
 * Parseia uma linha da DB_TRANSACOES.
 *
 * Colunas:
 * A DATA
 * B DESCRICAO
 * C VALOR
 * D TIPO
 * E CONTA
 * F CATEGORIA
 * G PARC_ATUAL
 * H PARC_TOTAL
 * I STATUS
 * J NOTAS
 * K ID_TRANSACAO
 * L ID_ARQUIVO
 * M HASH_LINHA
 * N METADADOS
 */
function GFP_DASH_V2_parseRow_(row, rowNumber, sourceSheet, archived) {
  const date = GFP_DASH_V2_asDate_(row[0]);
  const dateKey = date ? GFP_DASH_V2_dateKey_(date) : "";
  const meta = GFP_DASH_V2_parseJson_(row[13]);

  const cashMonth = GFP_DASH_V2_extractCashMonth_(meta);
  const effectiveMonth = cashMonth || (dateKey ? dateKey.slice(0, 7) : "");

  const rawValue = row[2];
  const value = typeof rawValue === "number" ? rawValue : Number(String(rawValue || "0").replace(/\./g, "").replace(",", "."));

  const tipo = String(row[3] || "").trim().toUpperCase();
  const account = String(row[4] || "").trim();
  const category = String(row[5] || "").trim();
  const status = String(row[8] || "").trim();

  const categoryParts = GFP_DASH_V2_parseCategory_(category);

  return {
    rowNumber: rowNumber || 0,
    sourceSheet: sourceSheet || GFP_DASH_V2_DB,
    archived: archived === true,
    date: date,
    dateKey: dateKey,
    effectiveMonth: effectiveMonth,
    cashMonth: cashMonth,
    description: String(row[1] || "").trim(),
    value: isNaN(value) ? 0 : value,
    tipo: tipo,
    account: account,
    category: category,
    categoryCode: categoryParts.code,
    className: categoryParts.className,
    groupName: categoryParts.groupName,
    detailName: categoryParts.detailName,
    installmentCurrent: row[6] || "",
    installmentTotal: row[7] || "",
    status: status,
    statusKey: GFP_DASH_V2_statusKey_(status),
    notes: String(row[9] || ""),
    id: String(row[10] || ""),
    fileId: String(row[11] || ""),
    hash: String(row[12] || ""),
    meta: meta,
    isTechnical99: GFP_DASH_V2_isTechnical99_(category, meta),
    isTransfer: tipo === "T"
  };
}

/**
 * Acumula na DRE.
 */
function GFP_DASH_V2_accumulateDre_(result, item) {
  const bucket = GFP_DASH_V2_bucketFromItem_(item);

  if (!bucket) return;

  result.kpis[bucket.kpi] += item.value;

  const root = result.dre[bucket.root];
  root.value += item.value;

  const groupName = item.groupName || "Geral";
  const detailName = item.detailName || "Outros";
  const categoryLabel = item.category || "Sem categoria";

  if (!root.groups[groupName]) {
    root.groups[groupName] = { label: groupName, value: 0, details: {} };
  }

  root.groups[groupName].value += item.value;

  if (!root.groups[groupName].details[detailName]) {
    root.groups[groupName].details[detailName] = { label: detailName, value: 0, categories: {} };
  }

  root.groups[groupName].details[detailName].value += item.value;

  if (!root.groups[groupName].details[detailName].categories[categoryLabel]) {
    root.groups[groupName].details[detailName].categories[categoryLabel] = {
      label: categoryLabel,
      value: 0,
      transactions: []
    };
  }

  root.groups[groupName].details[detailName].categories[categoryLabel].value += item.value;
  root.groups[groupName].details[detailName].categories[categoryLabel].transactions.push({
    rowNumber: item.rowNumber,
    sourceSheet: item.sourceSheet,
    archived: item.archived,
    date: item.dateKey ? GFP_DASH_V2_dateBrFromKey_(item.dateKey) : "",
    cashMonth: item.effectiveMonth || "",
    description: item.description,
    account: item.account,
    status: item.status,
    value: item.value,
    id: item.id
  });

  const topKey = detailName || categoryLabel;
  if (bucket.root === "Despesas") {
    if (!result.topExpensesMap[topKey]) result.topExpensesMap[topKey] = 0;
    result.topExpensesMap[topKey] += item.value;
  }

  if (bucket.root === "Receitas") {
    if (!result.topRevenueMap[topKey]) result.topRevenueMap[topKey] = 0;
    result.topRevenueMap[topKey] += item.value;
  }

  const acc = item.account || "Sem conta";
  if (!result.byAccountMap[acc]) result.byAccountMap[acc] = 0;
  result.byAccountMap[acc] += item.value;

  result.transactions.push({
    rowNumber: item.rowNumber,
    sourceSheet: item.sourceSheet,
    archived: item.archived,
    date: item.dateKey ? GFP_DASH_V2_dateBrFromKey_(item.dateKey) : "",
    cashMonth: item.effectiveMonth,
    description: item.description,
    value: item.value,
    tipo: item.tipo,
    account: item.account,
    category: item.category,
    status: item.status,
    id: item.id
  });
}

/**
 * Qualidade da base no mês.
 */
function GFP_DASH_V2_accumulateQuality_(result, item) {
  result.quality.total++;

  if (item.isTransfer) result.quality.transfers++;

  if (
    item.statusKey === "OK" ||
    item.statusKey === "REVISADO" ||
    item.statusKey === "VALIDADO" ||
    item.statusKey === "APROVADO"
  ) {
    result.quality.reviewed++;
  } else {
    result.quality.pending++;
  }

  const catNorm = GFP_DASH_V2_norm_(item.category);

  const unidentified =
    !item.category ||
    catNorm.indexOf("A IDENTIFICAR") >= 0 ||
    /^02\.98/.test(item.category) ||
    /^01\.98/.test(item.category) ||
    /^03\.98/.test(item.category);

  if (unidentified) {
    result.quality.unidentified++;
    result.issues.push({
      type: "Categoria pendente",
      rowNumber: item.rowNumber,
      date: item.dateKey ? GFP_DASH_V2_dateBrFromKey_(item.dateKey) : "",
      description: item.description,
      value: item.value,
      account: item.account,
      category: item.category || "Sem categoria",
      status: item.status
    });
  } else if (
    item.statusKey !== "OK" &&
    item.statusKey !== "REVISADO" &&
    item.statusKey !== "VALIDADO" &&
    item.statusKey !== "APROVADO"
  ) {
    result.issues.push({
      type: "Status pendente",
      rowNumber: item.rowNumber,
      date: item.dateKey ? GFP_DASH_V2_dateBrFromKey_(item.dateKey) : "",
      description: item.description,
      value: item.value,
      account: item.account,
      category: item.category,
      status: item.status || "Sem status"
    });
  }
}

/**
 * Elegibilidade DRE.
 */
function GFP_DASH_V2_isDreEligible_(item) {
  if (!item) return false;
  if (!item.effectiveMonth) return false;
  if (item.isTransfer) return false;
  if (item.isTechnical99) return false;
  if (!item.category) return false;

  const bucket = GFP_DASH_V2_bucketFromItem_(item);
  return !!bucket;
}

/**
 * Bucket.
 */
function GFP_DASH_V2_bucketFromItem_(item) {
  const cls = GFP_DASH_V2_norm_(item.className || item.category || "");
  const code = String(item.categoryCode || "");

  if (code.indexOf("01.") === 0 || cls.indexOf("RECEITA") >= 0) {
    return { root: "Receitas", kpi: "revenue" };
  }

  if (code.indexOf("02.") === 0 || cls.indexOf("DESPESA") >= 0) {
    return { root: "Despesas", kpi: "expenses" };
  }

  if (code.indexOf("03.") === 0 || cls.indexOf("INVEST") >= 0) {
    return { root: "Investimentos", kpi: "investments" };
  }

  return null;
}

/**
 * Série 12 meses.
 */
function GFP_DASH_V2_buildSeries_(allItems, year, month, accountFilter, statusFilter) {
  const months = [];

  let cursor = new Date(year, month - 1, 1);

  for (let i = 11; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const mk = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
    months.push({
      monthKey: mk,
      label: GFP_DASH_V2_monthLabelShort_(mk),
      revenue: 0,
      expenses: 0,
      investments: 0,
      result: 0,
      cashFlow: 0
    });
  }

  const map = {};
  months.forEach(function(m) { map[m.monthKey] = m; });

  allItems.forEach(function(item) {
    if (!item.effectiveMonth || !map[item.effectiveMonth]) return;
    if (accountFilter !== "Tudo" && item.account !== accountFilter) return;
    if (statusFilter !== "Tudo" && item.statusKey !== statusFilter) return;
    if (!GFP_DASH_V2_isDreEligible_(item)) return;

    const bucket = GFP_DASH_V2_bucketFromItem_(item);
    if (!bucket) return;

    if (bucket.root === "Receitas") map[item.effectiveMonth].revenue += item.value;
    if (bucket.root === "Despesas") map[item.effectiveMonth].expenses += item.value;
    if (bucket.root === "Investimentos") map[item.effectiveMonth].investments += item.value;
  });

  months.forEach(function(m) {
    m.result = m.revenue + m.expenses;
    m.cashFlow = m.revenue + m.expenses + m.investments;
  });

  return months;
}

/**
 * Saúde financeira.
 */
function GFP_DASH_V2_buildHealth_(result) {
  const margin = result.kpis.margin;
  const pending = result.quality.pending;
  const unidentified = result.quality.unidentified;
  const revenue = result.kpis.revenue;
  const op = result.kpis.operatingResult;

  let label = "Sem receita";
  let tone = "muted";
  let message = "Não há receita no período selecionado.";

  if (revenue > 0) {
    if (op < 0) {
      label = "Crítico";
      tone = "danger";
      message = "Resultado operacional negativo. Atenção a despesas, categorias pendentes e possíveis saídas relevantes.";
    } else if (margin < 0.10) {
      label = "Atenção";
      tone = "warning";
      message = "Resultado positivo, mas margem baixa. Bom revisar maiores despesas e pendências.";
    } else if (margin < 0.25) {
      label = "Bom";
      tone = "good";
      message = "Resultado positivo com margem razoável.";
    } else {
      label = "Excelente";
      tone = "success";
      message = "Resultado positivo com margem forte.";
    }
  }

  if (pending > 0 || unidentified > 0) {
    message += " Há pendências de revisão/categoria que podem alterar a leitura final.";
  }

  return { label: label, tone: tone, message: message };
}

/**
 * Top list.
 */
function GFP_DASH_V2_sortTop_(map, limit, byAbs) {
  return Object.keys(map || {}).map(function(k) {
    return { label: k, value: map[k] };
  }).sort(function(a, b) {
    const av = byAbs ? Math.abs(a.value) : a.value;
    const bv = byAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  }).slice(0, limit || 10);
}

/**
 * Categoria.
 */
function GFP_DASH_V2_parseCategory_(category) {
  const s = String(category || "").trim();

  if (!s) return { code: "", className: "", groupName: "", detailName: "" };

  const parts = s.split(/\s+—\s+|\s+-\s+/).map(function(p) { return String(p || "").trim(); });

  return {
    code: parts[0] || "",
    className: parts[1] || "",
    groupName: parts[2] || "Geral",
    detailName: parts[3] || "Outros"
  };
}

/**
 * Categorias técnicas 99.*.
 */
function GFP_DASH_V2_isTechnical99_(category, meta) {
  const cat = String(category || "").trim();

  if (/^99(?:\.| —| -|$)/.test(cat)) return true;

  if (meta && typeof meta === "object") {
    const candidates = [
      meta.categoria,
      meta.category,
      meta.suggestedCategory,
      meta.rubrica,
      meta.classificationParams && meta.classificationParams.suggestedCategory,
      meta.classificationParams && meta.classificationParams.finalCategory,
      meta.reviewPanelV2Fast && meta.reviewPanelV2Fast.newCategory,
      meta.reviewPanelV2Fast && meta.reviewPanelV2Fast.finalCategory
    ];

    for (let i = 0; i < candidates.length; i++) {
      if (/^99(?:\.| —| -|$)/.test(String(candidates[i] || "").trim())) return true;
    }
  }

  return false;
}


/**
 * Extrai cashMonth/competência.
 */
function GFP_DASH_V2_extractCashMonth_(meta) {
  if (!meta || typeof meta !== "object") return "";

  const candidates = [
    meta.cashMonth,
    meta.cash_month,
    meta.competencia_fatura,
    meta.competenciaFatura,
    meta.invoiceCashMonth,
    meta.invoiceMonth,
    meta.faturaMonth,
    meta.mesCaixa,
    meta.cardCashMonth,
    meta.cardInvoiceCashMonth,
    meta.invoiceReference,
    meta.invoice && meta.invoice.cashMonth,
    meta.invoice && meta.invoice.month,
    meta.invoice && meta.invoice.reference,
    meta.fatura && meta.fatura.cashMonth,
    meta.fatura && meta.fatura.competencia,
    meta.cardInvoice && meta.cardInvoice.cashMonth
  ];

  for (let i = 0; i < candidates.length; i++) {
    const cm = GFP_DASH_V2_normalizeCashMonth_(candidates[i]);

    if (cm) return cm;
  }

  // GFP 15.5:
  // Não fazer fallback genérico em JSON.stringify(meta).match(/20\d{2}-\d{2}/),
  // porque isso pode capturar suggestedAt, reviewedAt, fileName de CSV etc.
  //
  // Derivação por nome de fatura só é aceita quando a própria chave é de fatura.
  const invoiceName = String(
    meta.invoiceFileName ||
    meta.faturaFileName ||
    meta.cardInvoiceFileName ||
    ""
  );

  const byName = GFP_DASH_V2_extractCashMonthFromInvoiceName_15_5_(invoiceName);

  if (byName) return byName;

  return "";
}


/**
 * Normaliza YYYY-MM.
 */
function GFP_DASH_V2_normalizeCashMonth_(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  let m = s.match(/^(20\d{2})-(\d{2})$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(\d{2})\/(20\d{2})$/);
  if (m) return m[2] + "-" + m[1];

  m = s.match(/^(20\d{2})\/(\d{2})$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(20\d{2})-(\d{2})-\d{2}$/);
  if (m) return m[1] + "-" + m[2];

  return "";
}

function GFP_DASH_V2_statusKey_(status) {
  const s = GFP_DASH_V2_norm_(status);

  if (!s) return "PENDENTE";
  if (s === "OK") return "OK";
  if (s.indexOf("VALID") >= 0) return "VALIDADO";
  if (s.indexOf("REVIS") >= 0) return "REVISADO";
  if (s.indexOf("APROV") >= 0) return "APROVADO";
  if (s.indexOf("PEND") >= 0) return "PENDENTE";
  if (s.indexOf("IGNOR") >= 0) return "IGNORADO";

  return s;
}

function GFP_DASH_V2_parseJson_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_DASH_V2_asDate_(value) {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const s = String(value || "").trim();

  let m = s.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = s.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function GFP_DASH_V2_dateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function GFP_DASH_V2_dateBrFromKey_(key) {
  const m = String(key || "").match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  return m ? (m[3] + "/" + m[2] + "/" + m[1]) : "";
}

function GFP_DASH_V2_monthLabel_(monthKey) {
  const m = String(monthKey || "").match(/^(20\d{2})-(\d{2})$/);
  if (!m) return monthKey || "";

  const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return names[Number(m[2]) - 1] + "/" + m[1];
}

function GFP_DASH_V2_monthLabelShort_(monthKey) {
  const m = String(monthKey || "").match(/^(20\d{2})-(\d{2})$/);
  if (!m) return monthKey || "";

  const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return names[Number(m[2]) - 1];
}

function GFP_DASH_V2_norm_(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Debug rápido.
 */
function GFP_DASHBOARD_V2_DEBUG_14_10() {
  const opt = apiDashboardV2GetOptions();
  const data = apiDashboardV2GetData({
    year: opt.defaultYear,
    month: opt.defaultMonth,
    account: "Tudo",
    status: "Tudo"
  });

  Logger.log(JSON.stringify({
    options: opt,
    kpis: data.kpis,
    quality: data.quality,
    health: data.health
  }, null, 2));

  SpreadsheetApp.getActive().toast("Dashboard 2.0 debug executado. Veja o Logger.", "GFP 15.2");
}


/**
 * =============================================================================
 * 📊 GFP 15.5.0 — HELPERS FINAIS DO DASHBOARD 2.0
 * =============================================================================
 */

function GFP_DASH_V2_dedupeSourceRows_15_5_(sourceRows) {
  sourceRows = sourceRows || [];

  const seen = {};
  const out = [];

  sourceRows.forEach(function(src) {
    if (!src || !src.row) return;

    const row = src.row;
    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();
    const key = id || hash;

    // Sem chave, mantém. A auditoria é que apontará fragilidade.
    if (!key) {
      out.push(src);
      return;
    }

    // Se por alguma razão a mesma chave vier duas vezes:
    // 1. histórico arquivado tem preferência sobre mesa, pois já foi validado;
    // 2. senão mantém o primeiro.
    if (!seen[key]) {
      seen[key] = {
        idx: out.length,
        src: src
      };
      out.push(src);
      return;
    }

    const current = seen[key].src;

    if (!current.archived && src.archived) {
      out[seen[key].idx] = src;
      seen[key].src = src;
    }
  });

  return out;
}

function GFP_DASH_V2_extractCashMonthFromInvoiceName_15_5_(fileName) {
  fileName = String(fileName || "");

  if (!fileName) return "";

  // Exemplos aceitos:
  // PicPay_Fatura_052026.pdf -> 2026-05
  // Fatura_05_2026.pdf      -> 2026-05
  // fatura-2026-05.pdf      -> 2026-05
  const n = fileName.toLowerCase();

  if (n.indexOf("fatura") < 0 && n.indexOf("invoice") < 0) return "";

  let m = fileName.match(/(?:fatura|invoice)[^\d]*(\d{2})[^\d]*(20\d{2})/i);
  if (m) {
    return m[2] + "-" + m[1];
  }

  m = fileName.match(/(20\d{2})[^\d]*(\d{2})/);
  if (m) {
    return m[1] + "-" + m[2];
  }

  return "";
}

/**
 * Auditoria própria do Dashboard.
 *
 * Gera/atualiza:
 *   SYS_DASHBOARD_2_AUDIT
 */
function GFP_DASHBOARD_V2_AUDITAR_15_5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceRows = GFP_DASH_V2_getSourceRows_();

  const issues = [];
  const seen = {};

  const stats = {
    version: "15.5.0",
    generatedAt: new Date().toISOString(),
    totalSourceRows: sourceRows.length,
    workRows: 0,
    histRows: 0,
    dreEligible: 0,
    ignoredTransferOr99: 0,
    missingCategory: 0,
    missingCashMonthCard: 0,
    duplicateKeys: 0
  };

  sourceRows.forEach(function(src) {
    const item = GFP_DASH_V2_parseRow_(src.row, src.rowNumber, src.sheetName, src.archived);

    if (src.archived) stats.histRows++;
    else stats.workRows++;

    const key = item.id || item.hash;

    if (key) {
      if (!seen[key]) seen[key] = [];
      seen[key].push(item);
    }

    if (item.isTransfer || item.isTechnical99) {
      stats.ignoredTransferOr99++;
    }

    if (!item.category) {
      stats.missingCategory++;
      GFP_DASHBOARD_V2_AUDIT_addIssue_15_5_(issues, "WARN", "SEM_CATEGORIA", item, "Linha sem categoria. Não entra na DRE.");
    }

    if (GFP_DASH_V2_isCardLike_15_5_(item) && !item.cashMonth) {
      stats.missingCashMonthCard++;
      GFP_DASHBOARD_V2_AUDIT_addIssue_15_5_(issues, "WARN", "CARTAO_SEM_CASHMONTH_EXPLICITO", item, "Linha parece cartão/fatura, mas não possui cashMonth explícito. Dashboard usará DATA como fallback.");
    }

    if (GFP_DASH_V2_isDreEligible_(item)) {
      stats.dreEligible++;
    }
  });

  Object.keys(seen).forEach(function(key) {
    if (seen[key].length <= 1) return;

    stats.duplicateKeys++;

    seen[key].forEach(function(item) {
      GFP_DASHBOARD_V2_AUDIT_addIssue_15_5_(
        issues,
        "FATAL",
        "DUPLICIDADE_FONTE_DASHBOARD",
        item,
        "Mesma chave aparece mais de uma vez na fonte do Dashboard: " + key
      );
    });
  });

  GFP_DASHBOARD_V2_AUDIT_write_15_5_(ss, issues, stats);

  if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_5 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_5({ silent: true });
  } else if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_4 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_4({ silent: true });
  }

  ss.toast(
    "Dashboard auditado: " + issues.length + " apontamento(s).",
    "GFP 15.5"
  );

  return {
    ok: true,
    stats: stats,
    issues: issues
  };
}

function GFP_DASH_V2_isCardLike_15_5_(item) {
  const account = String(item.account || "").toLowerCase();
  const desc = String(item.description || "").toLowerCase();
  const meta = item.meta || {};
  const origin = String(meta.origin || "").toLowerCase();
  const fileName = String(meta.fileName || meta.invoiceFileName || "").toLowerCase();

  if (account.indexOf("cartão") >= 0 || account.indexOf("cartao") >= 0) return true;
  if (/parc\d{2}\/\d{2}/i.test(desc) || /parc\d+\/\d+/i.test(desc)) return true;
  if (origin.indexOf("fatura") >= 0 || origin.indexOf("invoice") >= 0) return true;
  if (fileName.indexOf("fatura") >= 0 || fileName.indexOf("invoice") >= 0) return true;

  return false;
}

function GFP_DASHBOARD_V2_AUDIT_addIssue_15_5_(issues, severity, code, item, detail) {
  issues.push([
    new Date(),
    severity,
    code,
    item.sourceSheet,
    item.rowNumber,
    item.dateKey ? GFP_DASH_V2_dateBrFromKey_(item.dateKey) : "",
    item.effectiveMonth || "",
    item.cashMonth || "",
    item.description,
    item.value,
    item.tipo,
    item.account,
    item.category,
    item.status,
    item.id || "",
    item.hash || "",
    detail
  ]);
}

function GFP_DASHBOARD_V2_AUDIT_write_15_5_(ss, issues, stats) {
  const name = "SYS_DASHBOARD_2_AUDIT";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "GRAVIDADE",
    "CODIGO",
    "ABA",
    "LINHA",
    "DATA",
    "MES_EFETIVO",
    "CASHMONTH",
    "DESCRICAO",
    "VALOR",
    "TIPO",
    "CONTA",
    "CATEGORIA",
    "STATUS",
    "ID_TRANSACAO",
    "HASH_LINHA",
    "DETALHE"
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);

  if (issues.length) {
    sh.getRange(2, 1, issues.length, header.length).setValues(issues);
  }

  sh.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange("J:J").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("S1").setValue("RESUMO");
  sh.getRange("S2").setValue(JSON.stringify(stats));
}

/**
 * =============================================================================
 * 🔮 GFP 16.1.6 — DASHBOARD 2.0 / PARCELAMENTOS
 * =============================================================================
 *
 * Gera dados para a nova aba "Parcelamentos" do Dashboard 2.0.
 * Fonte: DB_TRANSACOES + DB_TRANSACOES_HIST via allParsed.
 * =============================================================================
 */

function GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_(allParsed, opts) {
  opts = opts || {};
  allParsed = allParsed || [];

  const year = Number(opts.year || new Date().getFullYear());
  const month = Number(opts.month || (new Date().getMonth() + 1));
  const accountFilter = String(opts.accountFilter || "Tudo");

  const startMonth = year + "-" + String(month).padStart(2, "0");
  const startDate = new Date(year, month - 1, 1);

  const grupos = {};

  allParsed.forEach(function(item) {
    if (!item) return;

    if (accountFilter !== "Tudo" && item.account !== accountFilter) return;

    const tipo = String(item.tipo || "").toUpperCase();
    if (tipo === "T" || tipo === "S") return;

    if (!GFP_DASH_V2_PARC_IS_CARD_OR_INSTALLMENT_16_1_6_(item)) return;

    const inst = GFP_DASH_V2_PARC_PARSE_INSTALLMENT_16_1_6_(item);
    if (!inst || inst.total <= 1 || inst.current >= inst.total) return;

    const key = GFP_DASH_V2_PARC_KEY_16_1_6_(item, inst);

    // Se o mesmo parcelamento aparecer em mais de uma fatura, usa a parcela mais recente.
    if (!grupos[key] || inst.current > grupos[key].inst.current) {
      grupos[key] = {
        item: item,
        inst: inst
      };
    }
  });

  const installments = [];
  const endings = [];
  const monthMap = {};
  const cardMap = {};
  let totalFuture = 0;
  let totalInstallments = 0;

  Object.keys(grupos).forEach(function(key) {
    const g = grupos[key];
    const item = g.item;
    const inst = g.inst;

    const baseDue = GFP_DASH_V2_PARC_BASE_DUE_DATE_16_1_6_(item, startDate);
    if (!baseDue) return;

    const cleanDesc = GFP_DASH_V2_PARC_CLEAN_DESC_16_1_6_(item.description);
    const monthlyValue = Number(item.value || 0);
    const monthlyAbs = Math.abs(monthlyValue);
    const remaining = inst.total - inst.current;

    let finalDue = null;

    for (let p = inst.current + 1; p <= inst.total; p++) {
      const due = GFP_DASH_V2_PARC_ADD_MONTHS_16_1_6_(baseDue, p - inst.current);
      const dueMonth = GFP_DASH_V2_PARC_MONTH_KEY_16_1_6_(due);

      if (dueMonth < startMonth) continue;

      finalDue = due;

      if (!monthMap[dueMonth]) monthMap[dueMonth] = 0;
      monthMap[dueMonth] += monthlyAbs;

      const card = item.account || "Sem cartão";
      if (!cardMap[card]) cardMap[card] = 0;
      cardMap[card] += monthlyAbs;

      totalFuture += monthlyAbs;
      totalInstallments++;

      installments.push({
        dueKey: GFP_DASH_V2_dateKey_(due),
        dueLabel: GFP_DASH_V2_dateBrFromKey_(GFP_DASH_V2_dateKey_(due)),
        monthKey: dueMonth,
        monthLabel: GFP_DASH_V2_monthLabel_(dueMonth),
        description: cleanDesc,
        installmentLabel: p + "/" + inst.total,
        value: monthlyValue,
        valueAbs: monthlyAbs,
        account: item.account || "",
        category: item.category || "",
        monthsLeft: GFP_DASH_V2_PARC_MONTH_DIFF_16_1_6_(startDate, due),
        rowNumber: item.rowNumber,
        sourceSheet: item.sourceSheet
      });
    }

    if (finalDue) {
      const finalMonth = GFP_DASH_V2_PARC_MONTH_KEY_16_1_6_(finalDue);

      endings.push({
        description: cleanDesc,
        account: item.account || "",
        category: item.category || "",
        monthlyValue: monthlyValue,
        monthlyAbs: monthlyAbs,
        remaining: remaining,
        current: inst.current,
        total: inst.total,
        finalMonth: finalMonth,
        finalMonthLabel: GFP_DASH_V2_monthLabel_(finalMonth),
        finalDateLabel: GFP_DASH_V2_dateBrFromKey_(GFP_DASH_V2_dateKey_(finalDue))
      });
    }
  });

  const series = Object.keys(monthMap)
    .sort()
    .slice(0, 18)
    .map(function(m) {
      return {
        monthKey: m,
        label: GFP_DASH_V2_monthLabelShort_(m) + "/" + m.slice(2, 4),
        fullLabel: GFP_DASH_V2_monthLabel_(m),
        value: monthMap[m] || 0
      };
    });

  const cards = Object.keys(cardMap)
    .map(function(card) {
      return {
        label: card,
        value: cardMap[card]
      };
    })
    .sort(function(a, b) { return b.value - a.value; });

  installments.sort(function(a, b) {
    if (a.monthKey !== b.monthKey) return a.monthKey < b.monthKey ? -1 : 1;
    return b.valueAbs - a.valueAbs;
  });

  endings.sort(function(a, b) {
    if (a.finalMonth !== b.finalMonth) return a.finalMonth < b.finalMonth ? -1 : 1;
    return b.monthlyAbs - a.monthlyAbs;
  });

  const nextMonth = startMonth;
  const nextMonthTotal = monthMap[nextMonth] || 0;

  let relief = GFP_DASH_V2_PARC_RELIEF_16_1_6_(series);
  let biggestCard = cards.length ? cards[0] : { label: "—", value: 0 };

  return {
    ok: true,
    version: "16.1.6",
    startMonth: startMonth,
    startMonthLabel: GFP_DASH_V2_monthLabel_(startMonth),
    kpis: {
      totalFuture: totalFuture,
      nextMonthTotal: nextMonthTotal,
      totalInstallments: totalInstallments,
      activePlans: endings.length,
      biggestCard: biggestCard.label,
      biggestCardValue: biggestCard.value,
      reliefMonth: relief.monthLabel,
      reliefValue: relief.value
    },
    series: series,
    cards: cards,
    endings: endings.slice(0, 40),
    installments: installments.slice(0, 180),
    empty: totalInstallments === 0
  };
}

function GFP_DASH_V2_PARC_IS_CARD_OR_INSTALLMENT_16_1_6_(item) {
  const account = String(item.account || "").toLowerCase();
  const desc = String(item.description || "").toLowerCase();

  if (account.indexOf("cartão") >= 0 || account.indexOf("cartao") >= 0) return true;
  if (Number(item.installmentTotal || 0) > 1) return true;
  if (/\(?\d{1,2}\/\d{1,2}\)?/.test(desc)) return true;
  if (/parc\s*\d{1,2}\/\d{1,2}/i.test(desc)) return true;

  return false;
}

function GFP_DASH_V2_PARC_PARSE_INSTALLMENT_16_1_6_(item) {
  let current = Number(item.installmentCurrent || 0);
  let total = Number(item.installmentTotal || 0);

  const desc = String(item.description || "");

  if (!current || !total) {
    let m = desc.match(/\((\d{1,2})\/(\d{1,2})\)/);
    if (!m) m = desc.match(/\b(\d{1,2})\/(\d{1,2})\b/);

    if (m) {
      current = Number(m[1]);
      total = Number(m[2]);
    }
  }

  if (!current || !total) return null;

  return {
    current: current,
    total: total
  };
}

function GFP_DASH_V2_PARC_KEY_16_1_6_(item, inst) {
  return [
    GFP_DASH_V2_PARC_CLEAN_DESC_16_1_6_(item.description).toUpperCase(),
    String(item.account || "").toUpperCase(),
    String(item.category || "").toUpperCase(),
    String(inst.total || ""),
    String(Math.abs(Number(item.value || 0)).toFixed(2))
  ].join("|");
}

function GFP_DASH_V2_PARC_CLEAN_DESC_16_1_6_(desc) {
  return String(desc || "")
    .replace(/^\[\d{1,2}\/\d{1,2}\]\s*/g, "")
    .replace(/\bPARC\s*\d{1,2}\/\d{1,2}\b/gi, "")
    .replace(/\bPARC\d{1,2}\/\d{1,2}\b/gi, "")
    .replace(/\(\s*\d{1,2}\/\d{1,2}\s*\)/g, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_DASH_V2_PARC_BASE_DUE_DATE_16_1_6_(item, startDate) {
  const meta = item.meta || {};

  const candidates = [
    meta.invoiceDueDate,
    meta.dueDate,
    meta.vencimento,
    meta.fatura && meta.fatura.vencimento,
    meta.invoice && meta.invoice.dueDate
  ];

  for (let i = 0; i < candidates.length; i++) {
    const d = GFP_DASH_V2_asDate_(candidates[i]);
    if (d) return d;
  }

  const monthKey = item.effectiveMonth || item.cashMonth || "";
  if (/^20\d{2}-\d{2}$/.test(monthKey)) {
    const day = item.date instanceof Date ? item.date.getDate() : 10;
    return new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, day);
  }

  if (item.date instanceof Date) return item.date;

  return startDate;
}

function GFP_DASH_V2_PARC_ADD_MONTHS_16_1_6_(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();

  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));

  return d;
}

function GFP_DASH_V2_PARC_MONTH_KEY_16_1_6_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM");
}

function GFP_DASH_V2_PARC_MONTH_DIFF_16_1_6_(startDate, targetDate) {
  return (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
    (targetDate.getMonth() - startDate.getMonth());
}

function GFP_DASH_V2_PARC_RELIEF_16_1_6_(series) {
  if (!series || series.length < 2) {
    return { monthLabel: "—", value: 0 };
  }

  let best = { monthLabel: "—", value: 0 };

  for (let i = 1; i < series.length; i++) {
    const prev = Number(series[i - 1].value || 0);
    const curr = Number(series[i].value || 0);
    const drop = prev - curr;

    if (drop > best.value) {
      best = {
        monthLabel: series[i].fullLabel,
        value: drop
      };
    }
  }

  return best;
}
