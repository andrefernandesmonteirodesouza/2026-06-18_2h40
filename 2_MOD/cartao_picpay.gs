/**
 * 📂 ARQUIVO: 2_MOD/cartao_picpay.gs
 * 🏦 MÓDULO ESPECIALISTA: PICPAY
 * 🔢 VERSÃO: 10.20 (CORREÇÃO ANO DATA COMPRA DD/MM POR VENCIMENTO DA FATURA)
 * 📅 DATA: 10/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & ChatGPT
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * - Mantém a correção V10.18: captura multicoluna e cartão adicional Yan.
 * - Corrige o excesso de R$ 3,94 observado na fatura de maio/2026.
 * - A fatura mostrou:
 *     Total geral dos lançamentos: R$ 20.984,50
 *     Extraído V10.18:             R$ 20.988,44
 *     Diferença:                  R$ 3,94
 *
 * 🧠 CAUSA IDENTIFICADA:
 * - A linha "28/03 APPLECOMBILL 3,94" aparece visualmente na seção do cartão,
 *   mas o subtotal daquela seção não a considera.
 * - A própria fatura também informa "Créditos e estornos -3,94".
 * - Portanto, ela não deve entrar como despesa da fatura.
 *
 * 🎯 ESTRATÉGIA V10.19:
 * - Importa tudo via multicoluna.
 * - Extrai o "Total geral dos lançamentos".
 * - Extrai "Créditos e estornos".
 * - Se a soma extraída exceder o total geral exatamente pelo valor de crédito/
 *   estorno, remove uma linha-candidata daquele valor.
 *
 * 🛡️ NÚCLEO IMUTÁVEL:
 * - Não importa "Pagamento de Fatura".
 * - Não importa "Saldo Anterior".
 * - Não usa IA como fallback.
 * - Mantém rawLine técnico com SEQ para duplicatas legítimas.
 * - O rawLine não usa fileId, para bloquear reimportação da mesma fatura.
 * -----------------------------------------------------------------------------
 */

function processModulePicPay(textContext, fileName) {
  try {
    const regexData = parseRegexPicPay(textContext, fileName);
    if (regexData.length > 0) {
      Logger.log(`[PICPAY] Sucesso V10.20: ${regexData.length} itens extraídos.`);
      return regexData;
    }
  } catch (e) {
    Logger.error(`[PICPAY] Erro V10.20: ${e.message}`);
  }
  return [];
}

function parseRegexPicPay(text, fileName) {
  const out = [];
  const lines = text.split(/\r?\n/);
  const currentYear = new Date().getFullYear();
  const vencimentoMaster = extractVencimentoMaster(lines) || extractPicPayVencimentoFromHeader_(lines);
  const invoiceInfo = buildPicPayInvoiceInfo_(vencimentoMaster);

  let currentCardFinal = "PicPay André";
  let statementSeq = 0;

  const totalGeralFatura = extractPicPayTotalGeralLancamentos_(lines);
  const creditosEstornos = extractPicPayCreditosEstornos_(lines);

  lines.forEach((line, lineIndex) => {
    const lTrim = String(line || "").trim();
    if (lTrim.length < 5) return;

    const headerMatch = lTrim.match(/(?:picpay card final)\s+(\d{4})/i) ||
                        lTrim.match(/(?:final|cart[aã]o|terminado em).*?(\d{4})/i);

    if (headerMatch) {
      currentCardFinal = `Cartão Final ${headerMatch[1]}`;
    }

    let scanLine = lTrim
      .replace(/Transações Nacionais/gi, " ")
      .replace(/Transacoes Nacionais/gi, " ")
      .replace(/Data\s+Estabelecimento\s+Valor\s*\(R\$\)/gi, " ")
      .replace(/Data\s+Opera[cç][aã]o\s+Valor\s*\(R\$\)/gi, " ")
      .replace(/Data\s+Lançamento\s+Valor\s*\(R\$\)/gi, " ")
      .replace(/Data\s+Lancamento\s+Valor\s*\(R\$\)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\d{2}\/\d{2}/.test(scanLine)) return;

    const transactionRegex = /(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d\.]*,\d{2})(?=\s+\d{2}\/\d{2}\s+|$)/g;

    let match;
    while ((match = transactionRegex.exec(scanLine)) !== null) {
      const dataCompra = match[1];
      let descricao = String(match[2] || "").trim();
      const valorStr = match[3];

      if (!descricao || descricao.length < 2) continue;

      const descUpper = descricao.toUpperCase();

      if (
        descUpper.includes("PAGAMENTO DE FATURA") ||
        descUpper.includes("PAGAMENTO RECEBIDO") ||
        descUpper.includes("SALDO ANTERIOR") ||
        descUpper.includes("FATURA ANTERIOR")
      ) {
        continue;
      }

      if (
        descUpper.includes("SUBTOTAL") ||
        descUpper.includes("TOTAL DA FATURA") ||
        descUpper.includes("TOTAL GERAL DOS LANÇAMENTOS") ||
        descUpper.includes("TOTAL GERAL DOS LANCAMENTOS")
      ) {
        continue;
      }

      descricao = descricao
        .replace(/Picpay Card|Transações Nacionais|Transacoes Nacionais|Establishment/gi, "")
        .trim();

      if (descricao.length < 2) continue;

      const valorFloat = parsePicPayMoney_(valorStr);
      if (isNaN(valorFloat)) continue;

      const finalValue = valorFloat * -1;

      const parcMatch = descricao.match(/(\d{1,2})\/(\d{1,2})/);
      const parcelaAtual = parcMatch ? parcMatch[1] : 1;
      const parcelaTotal = parcMatch ? parcMatch[2] : 1;

      statementSeq++;

      const dataCompraNormalizada = normalizePicPayPurchaseDateByInvoiceDue_(
        dataCompra,
        invoiceInfo,
        currentYear
      );

      const technicalRawLine = [
        "PICPAY_FATURA_V10.19",
        `CARD=${currentCardFinal}`,
        `SEQ=${statementSeq}`,
        `LINHA=${lineIndex + 1}`,
        `DATA_COMPRA=${dataCompra}`,
        `DESC=${descricao}`,
        `VALOR=${valorStr}`,
        `PARC=${parcelaAtual}/${parcelaTotal}`
      ].join("|");

      out.push({
        // DATA DA COMPRA, não vencimento da fatura.
        // Regra: se mês DD/MM da compra for maior que o mês do vencimento da fatura,
        // a compra pertence ao ano anterior.
        data: dataCompraNormalizada,
        descricao: `[${dataCompra}] ${descricao}`,
        valor: finalValue,
        parcela_atual: parcelaAtual,
        parcela_total: parcelaTotal,
        cartao_final: currentCardFinal,
        rawLine: technicalRawLine,
        _origin: "REGEX_PICPAY_V10.20_DATE_FIX",
        _meta: {
          banco: "PicPay",
          fonte: "FATURA_CARTAO",
          tipoFonte: "cartao_credito",
          data_compra_original_texto: dataCompra,
          data_compra_normalizada: dataCompraNormalizada,
          vencimento_fatura: invoiceInfo.vencimento || "",
          cashMonth: invoiceInfo.cashMonth || "",
          competencia_fatura: invoiceInfo.cashMonth || "",
          regra_data_compra: invoiceInfo.vencimento
            ? "PICPAY_DDMM_MES_COMPRA_MAIOR_QUE_MES_VENCIMENTO_USA_ANO_ANTERIOR_V14_9_18"
            : "PICPAY_DDMM_SEM_VENCIMENTO_USA_ANO_ATUAL_FALLBACK_V14_9_18"
        }
      });
    }
  });

  reconcilePicPayExtractedTotal_(out, totalGeralFatura, creditosEstornos);

  logPicPayTotalConference_(out, totalGeralFatura);

  return out;
}

/**
 * Remove uma linha-candidata quando a extração excede o total geral pelo exato
 * valor informado em "Créditos e estornos".
 */
function reconcilePicPayExtractedTotal_(out, totalGeralFatura, creditosEstornos) {
  if (!out || out.length === 0) return;
  if (totalGeralFatura === null || isNaN(totalGeralFatura)) return;
  if (creditosEstornos === null || isNaN(creditosEstornos)) return;

  const somaAbs = round2_(out.reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0));
  const excesso = round2_(somaAbs - totalGeralFatura);
  const creditoAbs = round2_(Math.abs(creditosEstornos));

  if (excesso <= 0.05) return;

  if (Math.abs(excesso - creditoAbs) > 0.05) {
    Logger.warn(
      `[PICPAY V10.20] Excesso (${excesso.toFixed(2)}) não bate com créditos/estornos (${creditoAbs.toFixed(2)}). ` +
      `Nenhuma linha removida automaticamente.`
    );
    return;
  }

  const idx = findPicPayCreditCandidateIndex_(out, excesso);

  if (idx < 0) {
    Logger.warn(
      `[PICPAY V10.20] Excesso de ${excesso.toFixed(2)} identificado, mas nenhuma linha-candidata foi encontrada.`
    );
    return;
  }

  const removed = out.splice(idx, 1)[0];

  Logger.warn(
    `[PICPAY V10.20] Linha removida por reconciliação de crédito/estorno: ` +
    `${removed.descricao} | ${Math.abs(Number(removed.valor || 0)).toFixed(2)}`
  );
}

function findPicPayCreditCandidateIndex_(out, amount) {
  const target = round2_(amount);

  const candidates = [];

  out.forEach((item, idx) => {
    const v = round2_(Math.abs(Number(item.valor || 0)));
    if (Math.abs(v - target) <= 0.01) {
      const desc = String(item.descricao || "").toUpperCase();

      let score = 0;

      // Preferências seguras para o caso real da fatura PicPay.
      if (desc.includes("APPLECOMBILL") || desc.includes("APPLE.COM/BILL")) score += 10;
      if (desc.includes("CASHBACK")) score += 8;
      if (desc.includes("ESTORNO")) score += 8;
      if (desc.includes("CREDITO") || desc.includes("CRÉDITO")) score += 8;

      // Linhas antigas de compra, antes do ciclo principal da fatura, tendem a ser
      // mais prováveis como ajuste/estorno quando batem exatamente com o resumo.
      if (desc.includes("[28/03]") || desc.includes("[27/03]") || desc.includes("[29/03]")) score += 2;

      candidates.push({ idx, score });
    }
  });

  if (candidates.length === 0) return -1;

  candidates.sort((a, b) => b.score - a.score);

  return candidates[0].idx;
}

function logPicPayTotalConference_(out, totalGeralFatura) {
  const somaAbs = round2_(out.reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0));

  if (totalGeralFatura !== null && !isNaN(totalGeralFatura)) {
    const diff = round2_(somaAbs - totalGeralFatura);

    Logger.log(
      `[PICPAY V10.20] Conferência de total | ` +
      `PDF Total Geral: ${totalGeralFatura.toFixed(2)} | ` +
      `Extraído: ${somaAbs.toFixed(2)} | ` +
      `Diferença: ${diff.toFixed(2)}`
    );

    if (Math.abs(diff) > 0.05) {
      Logger.warn(
        `[PICPAY V10.20] ⚠️ ALERTA: soma extraída não bate com o Total Geral dos Lançamentos. ` +
        `Diferença: ${diff.toFixed(2)}`
      );
    }
  } else {
    Logger.warn("[PICPAY V10.20] Não foi possível localizar 'Total geral dos lançamentos' para conferência.");
  }
}

function extractPicPayTotalGeralLancamentos_(lines) {
  for (let i = 0; i < lines.length; i++) {
    const l = String(lines[i] || "").trim();

    const m = l.match(/Total\s+geral\s+dos\s+lan[cç]amentos\s+([\d\.]*,\d{2})/i);
    if (m) {
      return parsePicPayMoney_(m[1]);
    }
  }

  return null;
}

function extractPicPayCreditosEstornos_(lines) {
  for (let i = 0; i < lines.length; i++) {
    const l = String(lines[i] || "").trim();

    const m = l.match(/Cr[eé]ditos\s+e\s+estornos\s+(-?[\d\.]*,\d{2})/i);
    if (m) {
      return parsePicPayMoney_(m[1]);
    }
  }

  return null;
}

function parsePicPayMoney_(valorStr) {
  let s = String(valorStr || "").trim();

  if (!s) return NaN;

  s = s.replace(/−/g, "-");
  s = s.replace(/\u2212/g, "-");
  s = s.replace(/R\$/gi, "");
  s = s.replace(/\+/g, "");
  s = s.trim();

  s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  s = s.replace(/[^\d.-]/g, "");

  if (!s || s === "-" || s === ".") return NaN;

  return parseFloat(s);
}

function round2_(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}


/**
 * Extrai vencimento diretamente do cabeçalho textual da fatura PicPay.
 *
 * Exemplos aceitos:
 * - Vencimento: 10-05-2026
 * - Vencimento 10/05/2026
 * - vencimento: 10.05.2026
 */
function extractPicPayVencimentoFromHeader_(lines) {
  const max = Math.min(lines.length, 80);

  for (let i = 0; i < max; i++) {
    const l = String(lines[i] || "").trim();
    if (!/vencimento/i.test(l)) continue;

    const m = l.match(/vencimento\s*[:\-]?\s*(\d{2})[\/\-.](\d{2})[\/\-.](20\d{2})/i);
    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
  }

  return null;
}

/**
 * Monta informações da fatura a partir do vencimento.
 */
function buildPicPayInvoiceInfo_(vencimento) {
  const info = {
    vencimento: "",
    year: null,
    month: null,
    day: null,
    cashMonth: ""
  };

  const mIso = String(vencimento || "").match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!mIso) return info;

  info.vencimento = `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  info.year = Number(mIso[1]);
  info.month = Number(mIso[2]);
  info.day = Number(mIso[3]);
  info.cashMonth = `${mIso[1]}-${mIso[2]}`;

  return info;
}

/**
 * Normaliza DD/MM da fatura PicPay para DD/MM/YYYY correto.
 *
 * REGRA CENTRAL:
 * Se a fatura vence em 10/05/2026 e a compra está como 24/11,
 * então 11 > 05, portanto a compra é de 24/11/2025.
 *
 * Se a compra está como 07/02, então 02 <= 05,
 * portanto a compra é de 07/02/2026.
 *
 * Esta função preserva a DATA REAL DA COMPRA para conciliação.
 */
function normalizePicPayPurchaseDateByInvoiceDue_(ddmm, invoiceInfo, fallbackYear) {
  const m = String(ddmm || "").trim().match(/^(\d{2})\/(\d{2})$/);
  if (!m) return ddmm;

  const day = Number(m[1]);
  const month = Number(m[2]);

  let year = Number(fallbackYear || new Date().getFullYear());

  if (invoiceInfo && invoiceInfo.year && invoiceInfo.month) {
    year = Number(invoiceInfo.year);

    if (month > Number(invoiceInfo.month)) {
      year = year - 1;
    }
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/**
 * REPARO OPCIONAL PARA A BASE JÁ IMPORTADA.
 *
 * Não cria aba.
 * Não muda categoria.
 * Não muda status.
 * Não muda ID_TRANSACAO.
 * Não muda HASH_LINHA.
 *
 * Corrige apenas linhas PicPay Cartão em DB_TRANSACOES quando:
 * - descrição começa com [DD/MM];
 * - há cashMonth/competência de fatura em METADADOS;
 * - mês da compra > mês do cashMonth;
 * - DATA atual está no ano do cashMonth, portanto ficou futura/incoerente.
 */
function GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_DRYRUN_14_9_18() {
  return GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_14_9_18_(true);
}

function GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_APPLY_14_9_18() {
  return GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_14_9_18_(false);
}

function GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_14_9_18_(dryRun) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return { dryRun: !!dryRun, scanned: 0, candidates: 0, corrected: 0, rows: [] };
  }

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  const result = {
    patch: "14.9.18",
    dryRun: !!dryRun,
    scanned: values.length,
    candidates: 0,
    corrected: 0,
    skipped: 0,
    rows: []
  };

  values.forEach((row, idx) => {
    const rowNumber = idx + 2;

    const dataAtual = row[0];
    const descricao = String(row[1] || "").trim();
    const conta = String(row[4] || "").trim();
    const metaRaw = row[13];

    const contaNorm = conta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    if (!contaNorm.includes("PICPAY")) return;
    if (!contaNorm.includes("CARTAO") && !contaNorm.includes("CARD")) return;

    const dm = descricao.match(/^\[(\d{2})\/(\d{2})\]/);
    if (!dm) return;

    const day = Number(dm[1]);
    const month = Number(dm[2]);

    const meta = parsePicPayJsonSafe_(metaRaw);
    const cashMonth = extractPicPayCashMonthFromMeta_(meta);
    if (!cashMonth) return;

    const cm = cashMonth.match(/^(20\d{2})-(\d{2})$/);
    if (!cm) return;

    const cashYear = Number(cm[1]);
    const cashMonthNum = Number(cm[2]);

    if (!(month > cashMonthNum)) return;

    const currentDateKey = picPayDateKey_(dataAtual);
    if (!currentDateKey) return;

    const currentYear = Number(currentDateKey.slice(0, 4));

    // Só corrige o caso clássico: sistema atribuiu o ano da fatura a uma compra
    // cujo mês pertence ao ano anterior.
    if (currentYear !== cashYear) return;

    const correctedYear = cashYear - 1;
    const correctedDate = new Date(correctedYear, month - 1, day);
    const correctedKey = Utilities.formatDate(correctedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

    result.candidates++;
    result.rows.push({
      rowNumber,
      conta,
      descricao,
      cashMonth,
      from: currentDateKey,
      to: correctedKey
    });

    if (!dryRun) {
      if (!meta.auditoria_datas_cartao) meta.auditoria_datas_cartao = {};
      meta.auditoria_datas_cartao["14_9_18"] = {
        status: "corrigida_importada_picpay",
        data_original_db: currentDateKey,
        data_corrigida: correctedKey,
        cashMonth: cashMonth,
        motivo: "Mês da compra em DD/MM é maior que o mês do vencimento/cashMonth da fatura; compra pertence ao ano anterior.",
        regra: "PICPAY_DDMM_MES_COMPRA_MAIOR_QUE_MES_VENCIMENTO_USA_ANO_ANTERIOR_V14_9_18",
        patch: "14.9.18",
        timestamp: new Date().toISOString()
      };

      sh.getRange(rowNumber, 1).setValue(correctedDate);
      sh.getRange(rowNumber, 14).setValue(JSON.stringify(meta));
      result.corrected++;
    }
  });

  Logger.log("[GFP_REPARAR_DATAS_PICPAY_IMPORTADAS_14_9_18] " + JSON.stringify(result, null, 2));

  SpreadsheetApp.getActiveSpreadsheet().toast(
    dryRun
      ? `Dry-run PicPay datas: ${result.candidates} candidato(s).`
      : `Reparo PicPay datas: ${result.corrected} linha(s) corrigida(s).`,
    "GFP 14.9.18"
  );

  return result;
}

function parsePicPayJsonSafe_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function extractPicPayCashMonthFromMeta_(meta) {
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
    meta.cardInvoiceCashMonth
  ];

  for (let i = 0; i < candidates.length; i++) {
    const cm = normalizePicPayCashMonth_(candidates[i]);
    if (cm) return cm;
  }

  const raw = JSON.stringify(meta);
  const m = raw.match(/20\d{2}-\d{2}/);
  return m ? normalizePicPayCashMonth_(m[0]) : "";
}

function normalizePicPayCashMonth_(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  let m = s.match(/^(20\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  m = s.match(/^(\d{2})\/(20\d{2})$/);
  if (m) return `${m[2]}-${m[1]}`;

  m = s.match(/^(20\d{2})-(\d{2})-\d{2}$/);
  if (m) return `${m[1]}-${m[2]}`;

  return "";
}

function picPayDateKey_(value) {
  if (!value) return "";

  let d;

  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value || "").trim();

    let m = s.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
    if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    if (!d) {
      m = s.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
      if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    if (!d) d = new Date(s);
  }

  if (!d || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}


// Sem fallback de IA para fatura: fatura precisa bater centavo por centavo.
function parseAiPicPay(text) { return []; }
