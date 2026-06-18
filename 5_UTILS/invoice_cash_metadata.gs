/**
 * 📂 ARQUIVO: 5_UTILS/invoice_cash_metadata.gs
 * 💳 MÓDULO: METADADOS DE CAIXA PARA FATURAS DE CARTÃO
 * 🔢 VERSÃO: 1.0 (DRE CASH BASIS)
 * 📅 DATA: 09/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * 📝 OBJETIVO:
 * Enriquecer lançamentos de fatura de cartão com metadados de vencimento,
 * permitindo que a DRE_GERENCIAL use regime de caixa:
 *
 * - Conta corrente: usa data da movimentação.
 * - Cartão de crédito: usa mês de vencimento da fatura.
 *
 * 🛡️ NÚCLEO IMUTÁVEL:
 * - Não altera parser PicPay V10.19.
 * - Não altera valor, descrição, ID, hash ou rawLine.
 * - Apenas adiciona metadados de caixa em item._meta / METADADOS.
 * -----------------------------------------------------------------------------
 */

/**
 * Enriquece itens extraídos de PDFs de fatura com metadados de caixa.
 *
 * @param {Array<Object>} items Itens extraídos pelo parser especialista.
 * @param {string} textContext Texto bruto extraído do PDF.
 * @param {string} fileName Nome do arquivo processado.
 * @param {string} bancoDetectado Banco/módulo detectado pelo core_pdf_bridge.
 * @return {Array<Object>}
 */
function enrichCardInvoiceCashMetadata_(items, textContext, fileName, bancoDetectado) {
  if (!items || !Array.isArray(items) || items.length === 0) return items;

  const shouldTry = isLikelyCardInvoiceFile_(fileName, bancoDetectado, textContext);
  if (!shouldTry) return items;

  const invoiceMeta = buildInvoiceCashMetadata_(textContext, fileName, bancoDetectado);

  if (!invoiceMeta || !invoiceMeta.cashMonth) {
    try {
      Logger.warn(
        `[invoice_cash_metadata] Não foi possível definir cashMonth para '${fileName}'. ` +
        `DRE usará DATA normal como fallback.`
      );
    } catch (e) {}
    return items;
  }

  items.forEach(item => {
    if (!item || typeof item !== "object") return;
    item._meta = Object.assign({}, item._meta || {}, invoiceMeta);
  });

  try {
    Logger.log(
      `[invoice_cash_metadata] ${items.length} itens enriquecidos | ` +
      `file='${fileName}' | cashMonth=${invoiceMeta.cashMonth} | source=${invoiceMeta.invoiceDateSource}`
    );
  } catch (e) {}

  return items;
}


/**
 * Decide se vale tentar extrair vencimento de fatura.
 *
 * V1.0.1:
 * - NÃO usa mais o nome do banco isoladamente como sinal.
 * - Exige indício de fatura/cartão no nome do arquivo OU no texto do PDF.
 * - Evita marcar extratos/contas PicPay como fatura só por conter "PICPAY".
 */
function isLikelyCardInvoiceFile_(fileName, bancoDetectado, textContext) {
  const name = normalizeInvoiceText_(fileName || "");
  const text = normalizeInvoiceText_(String(textContext || "").slice(0, 8000));

  const hasFileSignal =
    name.includes("FATURA") ||
    name.includes("CARTAO") ||
    name.includes("CARTÃO") ||
    name.includes("CARD") ||
    name.includes("INVOICE");

  const hasTextSignal =
    (
      text.includes("FATURA") ||
      text.includes("CARTAO") ||
      text.includes("CARTÃO") ||
      text.includes("CARTAO DE CREDITO") ||
      text.includes("CARTÃO DE CRÉDITO")
    ) &&
    (
      text.includes("VENCIMENTO") ||
      text.includes("DATA DE VENCIMENTO") ||
      text.includes("TOTAL DA FATURA") ||
      text.includes("FECHAMENTO")
    );

  return !!(hasFileSignal || hasTextSignal);
}


/**
 * Monta metadados de vencimento/caixa a partir do texto da fatura.
 */
function buildInvoiceCashMetadata_(textContext, fileName, bancoDetectado) {
  const extracted = extractInvoiceDatesFromText_(textContext, fileName);
  const tz = Session.getScriptTimeZone();

  let cashMonth = "";
  let source = "";
  let dueDateIso = "";
  let closingDateIso = "";

  if (extracted && extracted.dueDate instanceof Date && !isNaN(extracted.dueDate)) {
    dueDateIso = Utilities.formatDate(extracted.dueDate, tz, "yyyy-MM-dd");
    cashMonth = Utilities.formatDate(extracted.dueDate, tz, "yyyy-MM");
    source = "PDF_TEXT";
  }

  if (extracted && extracted.closingDate instanceof Date && !isNaN(extracted.closingDate)) {
    closingDateIso = Utilities.formatDate(extracted.closingDate, tz, "yyyy-MM-dd");
  }

  if (!cashMonth) {
    const fallbackMonth = inferInvoiceCashMonthFromFileName_(fileName);
    if (fallbackMonth) {
      cashMonth = fallbackMonth;
      source = "FILE_NAME_FALLBACK";
    }
  }

  if (!cashMonth) return null;

  return {
    cashMonth: cashMonth,
    invoiceDueDate: dueDateIso || "",
    invoiceClosingDate: closingDateIso || "",
    invoiceReference: cashMonth,
    invoiceDateSource: source,
    dreDatePolicy: "CARD_INVOICE_DUE_DATE",
    invoiceFileName: fileName || "",
    invoiceBankName: bancoDetectado || "",
    invoiceParserVersion: "invoice_cash_metadata_v1.0"
  };
}

/**
 * Extrai datas relevantes do texto da fatura.
 */
function extractInvoiceDatesFromText_(textContext, fileName) {
  const text = String(textContext || "");
  if (!text.trim()) return { dueDate: null, closingDate: null };

  const lines = text.split(/\r?\n/).map(l => String(l || "").trim()).filter(Boolean);

  const fallbackYear = inferYearFromFileName_(fileName) || new Date().getFullYear();

  const dueDate = extractDateNearKeywordFromLines_(lines, "VENCIMENTO", fallbackYear) ||
                  extractDateNearKeywordFromLines_(lines, "DATA DE VENCIMENTO", fallbackYear) ||
                  extractDateNearKeywordFromLines_(lines, "VENCE", fallbackYear);

  const closingDate = extractDateNearKeywordFromLines_(lines, "FECHAMENTO", fallbackYear) ||
                      extractDateNearKeywordFromLines_(lines, "DATA DE FECHAMENTO", fallbackYear);

  return { dueDate: dueDate, closingDate: closingDate };
}

/**
 * Procura uma data próxima a uma palavra-chave nas primeiras linhas da fatura.
 */
function extractDateNearKeywordFromLines_(lines, keyword, fallbackYear) {
  const key = normalizeInvoiceText_(keyword);
  const max = Math.min(lines.length, 120);

  for (let i = 0; i < max; i++) {
    const line = String(lines[i] || "");
    const norm = normalizeInvoiceText_(line);

    if (!norm.includes(key)) continue;

    const joined = [
      line,
      lines[i + 1] || "",
      lines[i + 2] || ""
    ].join(" ");

    const normJoined = normalizeInvoiceText_(joined);
    const keyPos = normJoined.indexOf(key);

    let afterKeywordOriginal = joined;
    if (keyPos >= 0) {
      // Corte aproximado no texto original. O objetivo é priorizar a data depois da palavra-chave.
      afterKeywordOriginal = joined.slice(Math.max(0, keyPos));
    }

    const afterDate = findFirstDateInText_(afterKeywordOriginal, fallbackYear);
    if (afterDate) return afterDate;

    const anyDate = findFirstDateInText_(joined, fallbackYear);
    if (anyDate) return anyDate;
  }

  return null;
}

/**
 * Encontra a primeira data em formatos comuns:
 * - 10/05/2026
 * - 10-05-2026
 * - 2026-05-10
 * - 10 maio 2026
 * - 10 mai 26
 */
function findFirstDateInText_(text, fallbackYear) {
  const raw = String(text || "");

  // yyyy-mm-dd
  let m = raw.match(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (m) {
    return buildValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // dd/mm/yyyy ou dd-mm-yyyy
  m = raw.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return buildValidDate_(y, Number(m[2]), Number(m[1]));
  }

  // dd mês yyyy
  const norm = normalizeInvoiceText_(raw);
  m = norm.match(/\b(\d{1,2})\s+(JAN|JANEIRO|FEV|FEVEREIRO|MAR|MARCO|MARÇO|ABR|ABRIL|MAI|MAIO|JUN|JUNHO|JUL|JULHO|AGO|AGOSTO|SET|SETEMBRO|OUT|OUTUBRO|NOV|NOVEMBRO|DEZ|DEZEMBRO)\s*(\d{2,4})?\b/);
  if (m) {
    const day = Number(m[1]);
    const month = monthNameToNumber_(m[2]);
    let year = m[3] ? Number(m[3]) : Number(fallbackYear || new Date().getFullYear());
    if (year < 100) year += 2000;
    return buildValidDate_(year, month, day);
  }

  return null;
}

function buildValidDate_(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (isNaN(d)) return null;
  if (d.getFullYear() !== year) return null;
  if (d.getMonth() !== month - 1) return null;
  if (d.getDate() !== day) return null;

  return d;
}

function monthNameToNumber_(m) {
  const key = normalizeInvoiceText_(m || "");
  const map = {
    JAN: 1, JANEIRO: 1,
    FEV: 2, FEVEREIRO: 2,
    MAR: 3, MARCO: 3, MARÇO: 3,
    ABR: 4, ABRIL: 4,
    MAI: 5, MAIO: 5,
    JUN: 6, JUNHO: 6,
    JUL: 7, JULHO: 7,
    AGO: 8, AGOSTO: 8,
    SET: 9, SETEMBRO: 9,
    OUT: 10, OUTUBRO: 10,
    NOV: 11, NOVEMBRO: 11,
    DEZ: 12, DEZEMBRO: 12
  };
  return map[key] || null;
}

/**
 * Fallback por nome de arquivo.
 * Exemplos:
 * - PicPay_Fatura_052026.pdf -> 2026-05
 * - fatura-2026-05.pdf -> 2026-05
 */
function inferInvoiceCashMonthFromFileName_(fileName) {
  const name = String(fileName || "");

  let m = name.match(/(?:^|[^\d])([01]\d)(20\d{2})(?:[^\d]|$)/);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  m = name.match(/\b(20\d{2})[^\d]?([01]\d)\b/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  const norm = normalizeInvoiceText_(name);
  m = norm.match(/\b(JAN|JANEIRO|FEV|FEVEREIRO|MAR|MARCO|MARÇO|ABR|ABRIL|MAI|MAIO|JUN|JUNHO|JUL|JULHO|AGO|AGOSTO|SET|SETEMBRO|OUT|OUTUBRO|NOV|NOVEMBRO|DEZ|DEZEMBRO)\D*(20\d{2})\b/);
  if (m) {
    const month = monthNameToNumber_(m[1]);
    const year = Number(m[2]);
    if (month) return `${year}-${String(month).padStart(2, "0")}`;
  }

  return "";
}

function inferYearFromFileName_(fileName) {
  const name = String(fileName || "");
  const m = name.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function normalizeInvoiceText_(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function parseMetadataJsonSafe_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

/**
 * Retorna cashMonth a partir de uma linha da DB_TRANSACOES.
 * Usado por DRE/Dashboard.
 */
function getCashMonthFromDbRow_(row) {
  if (!row) return "";

  const meta = parseMetadataJsonSafe_(row[13]);
  if (meta && meta.cashMonth) {
    const cm = String(meta.cashMonth).trim();
    if (/^\d{4}-\d{2}$/.test(cm)) return cm;
  }

  const d = row[0];
  if (d instanceof Date && !isNaN(d)) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
  }

  return "";
}

/**
 * BACKFILL DRY-RUN: simula preenchimento de cashMonth em linhas já importadas.
 */
function GFP_BACKFILL_INVOICE_CASH_METADATA_DRYRUN() {
  return GFP_BACKFILL_INVOICE_CASH_METADATA_(true);
}

/**
 * BACKFILL APLICAR: preenche cashMonth em linhas já importadas.
 */
function GFP_BACKFILL_INVOICE_CASH_METADATA_APPLY() {
  return GFP_BACKFILL_INVOICE_CASH_METADATA_(false);
}

/**
 * Atualiza METADADOS de linhas já gravadas na DB_TRANSACOES.
 *
 * Agrupa por fileId/fileName, extrai vencimento uma vez por arquivo, e grava:
 * - cashMonth
 * - invoiceDueDate
 * - invoiceClosingDate
 * - invoiceDateSource
 * - dreDatePolicy
 */
function GFP_BACKFILL_INVOICE_CASH_METADATA_(dryRun) {
  const functionName = "GFP_BACKFILL_INVOICE_CASH_METADATA_";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");

  if (!sheet) {
    Logger.warn(`[${functionName}] DB_TRANSACOES não encontrada.`);
    return { updated: 0, dryRun: dryRun };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log(`[${functionName}] Sem linhas para processar.`);
    return { updated: 0, dryRun: dryRun };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  const cacheByFileKey = {};
  const updates = [];

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "");
    const categoria = String(row[5] || "");
    const fileId = String(row[11] || "").trim();
    const metaRaw = row[13];

    if (tipo === "T" || tipo === "S") return;
    if (categoria.indexOf("99.") >= 0) return;

    const meta = parseMetadataJsonSafe_(metaRaw);
    if (meta.cashMonth) return;

    const fileName = String(meta.fileName || "");
    const origin = String(meta.origin || "");
    const isCard = isDbRowCardInvoiceCandidate_(row, meta);

    if (!isCard) return;
    if (!fileId && !fileName) return;

    const fileKey = fileId || fileName;

    if (!cacheByFileKey[fileKey]) {
      cacheByFileKey[fileKey] = resolveInvoiceCashMetadataForExistingFile_(fileId, fileName, origin);
    }

    const invoiceMeta = cacheByFileKey[fileKey];
    if (!invoiceMeta || !invoiceMeta.cashMonth) return;

    const newMeta = Object.assign({}, meta, invoiceMeta);
    updates.push({
      sheetRow: sheetRow,
      oldMeta: metaRaw,
      newMeta: JSON.stringify(newMeta),
      cashMonth: invoiceMeta.cashMonth,
      source: invoiceMeta.invoiceDateSource
    });
  });

  if (!dryRun) {
    updates.forEach(u => {
      sheet.getRange(u.sheetRow, 14).setValue(u.newMeta);
    });
  }

  Logger.log(
    `[${functionName}] ${dryRun ? "DRY-RUN" : "APLICADO"} | ` +
    `linhas_com_update=${updates.length}`
  );

  updates.slice(0, 20).forEach(u => {
    Logger.log(
      `[${functionName}] ${dryRun ? "[DRY]" : "[OK]"} linha=${u.sheetRow} ` +
      `cashMonth=${u.cashMonth} source=${u.source}`
    );
  });

  return {
    dryRun: !!dryRun,
    updated: updates.length,
    examples: updates.slice(0, 20).map(u => ({
      row: u.sheetRow,
      cashMonth: u.cashMonth,
      source: u.source
    }))
  };
}

function resolveInvoiceCashMetadataForExistingFile_(fileId, fileName, origin) {
  let text = "";

  try {
    if (fileId && typeof convertPdfToText === "function") {
      text = convertPdfToText(fileId);
    }
  } catch (e) {
    Logger.warn(
      `[resolveInvoiceCashMetadataForExistingFile_] Falha ao extrair PDF '${fileName || fileId}': ${e.message}`
    );
  }

  return buildInvoiceCashMetadata_(text, fileName, origin);
}

/**
 * Critério central seguro para saber se uma linha da DB_TRANSACOES é fatura/cartão.
 *
 * NÃO usa banco isoladamente como sinal, para evitar contaminar extratos de conta.
 */
function isDbRowCardInvoiceCandidate_(row, meta) {
  if (!row) return false;

  const conta = normalizeInvoiceText_(row[4] || "");
  const fileName = normalizeInvoiceText_((meta && meta.fileName) || "");
  const origin = normalizeInvoiceText_((meta && meta.origin) || "");

  const byAccount =
    conta.includes("CARTAO") ||
    conta.includes("CARTÃO");

  const byFileName =
    fileName.includes("FATURA") ||
    fileName.includes("CARTAO") ||
    fileName.includes("CARTÃO") ||
    fileName.includes("CARD") ||
    fileName.includes("INVOICE");

  const byOrigin =
    origin.includes("CARTAO") ||
    origin.includes("CARTÃO") ||
    origin.includes("FATURA") ||
    origin.includes("REGEX_PICPAY_V10");

  return !!(byAccount || byFileName || byOrigin);
}

/**
 * DRY-RUN: remove metadados de fatura aplicados indevidamente em linhas não-cartão.
 */
function GFP_CLEAN_NON_CARD_CASH_METADATA_DRYRUN() {
  return GFP_CLEAN_NON_CARD_CASH_METADATA_(true);
}

/**
 * APPLY: remove metadados de fatura aplicados indevidamente em linhas não-cartão.
 */
function GFP_CLEAN_NON_CARD_CASH_METADATA_APPLY() {
  return GFP_CLEAN_NON_CARD_CASH_METADATA_(false);
}

/**
 * Remove cashMonth/invoiceDueDate/etc. de linhas que NÃO são fatura/cartão.
 */
function GFP_CLEAN_NON_CARD_CASH_METADATA_(dryRun) {
  const functionName = "GFP_CLEAN_NON_CARD_CASH_METADATA_";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");

  if (!sheet) {
    Logger.warn(`[${functionName}] DB_TRANSACOES não encontrada.`);
    return { dryRun: !!dryRun, cleaned: 0 };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log(`[${functionName}] Sem linhas para processar.`);
    return { dryRun: !!dryRun, cleaned: 0 };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  const keysToRemove = [
    "cashMonth",
    "invoiceDueDate",
    "invoiceClosingDate",
    "invoiceReference",
    "invoiceDateSource",
    "dreDatePolicy",
    "invoiceFileName",
    "invoiceBankName",
    "invoiceParserVersion"
  ];

  const updates = [];

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;
    const meta = parseMetadataJsonSafe_(row[13]);

    if (!meta || !meta.cashMonth) return;

    const isCard = isDbRowCardInvoiceCandidate_(row, meta);
    if (isCard) return;

    const newMeta = Object.assign({}, meta);
    keysToRemove.forEach(k => delete newMeta[k]);

    updates.push({
      sheetRow: sheetRow,
      oldCashMonth: meta.cashMonth,
      conta: row[4],
      fileName: meta.fileName || "",
      origin: meta.origin || "",
      newMeta: JSON.stringify(newMeta)
    });
  });

  if (!dryRun) {
    updates.forEach(u => {
      sheet.getRange(u.sheetRow, 14).setValue(u.newMeta);
    });
  }

  Logger.log(
    `[${functionName}] ${dryRun ? "DRY-RUN" : "APLICADO"} | ` +
    `linhas_limpas=${updates.length}`
  );

  updates.slice(0, 30).forEach(u => {
    Logger.log(
      `[${functionName}] ${dryRun ? "[DRY]" : "[OK]"} linha=${u.sheetRow} ` +
      `cashMonth_removido=${u.oldCashMonth} conta='${u.conta}' file='${u.fileName}' origin='${u.origin}'`
    );
  });

  return {
    dryRun: !!dryRun,
    cleaned: updates.length,
    examples: updates.slice(0, 30).map(u => ({
      row: u.sheetRow,
      oldCashMonth: u.oldCashMonth,
      conta: u.conta,
      fileName: u.fileName,
      origin: u.origin
    }))
  };
}

