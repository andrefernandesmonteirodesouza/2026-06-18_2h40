/**
 * =============================================================================
 * 📂 ARQUIVO: 2_MOD/conta_picpay.gs
 * 🏦 MÓDULO: PARSER ESPECIALISTA — CONTA PICPAY
 * 🔢 VERSÃO: 1.1.0 (HEADER FLEX + DELIMITADOR AUTO)
 * 📅 DATA: 08/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & ChatGPT
 * =============================================================================
 *
 * 🎯 OBJETIVO
 * Ler o CSV de extrato da CONTA PicPay.
 *
 * 🛠️ CORREÇÃO V1.1.0
 * - O V1.0 reconheceu o arquivo como PicPay, mas retornou:
 *   "Colunas obrigatórias ausentes: data"
 *
 * - Isso ocorre quando o cabeçalho vem com variação, por exemplo:
 *   "Data de lançamento", "data_transacao", BOM invisível, delimitador diferente,
 *   ou exportação usando ";" em vez de ",".
 *
 * - Esta versão:
 *   1. Detecta automaticamente "," ou ";".
 *   2. Aceita cabeçalhos flexíveis que contenham "data", "hora", "tipo", etc.
 *   3. Mantém a mesma saída padrão para o pipeline.
 *
 * 🧠 REGRA CONTÁBIL
 * - Valor positivo no CSV  => type "C"
 * - Valor negativo no CSV  => type "D"
 * - value sempre vai absoluto, seguindo o padrão dos demais módulos.
 *
 * =============================================================================
 */


function processModulePicPayConta(content) {
  const functionName = "processModulePicPayConta";
  const out = [];

  if (!content || String(content).trim() === "") {
    Logger.warn(`[${functionName}] Conteúdo vazio.`);
    return out;
  }

  let csvData = [];

  try {
    csvData = parsePicPayContaCsvAuto_(content);
  } catch (e) {
    Logger.error(`[${functionName}] Falha ao parsear CSV: ${e.message}`);
    return out;
  }

  if (!csvData || csvData.length < 2) {
    Logger.warn(`[${functionName}] CSV sem dados suficientes.`);
    return out;
  }

  const headerIndex = findPicPayContaHeaderIndex_(csvData);

  if (headerIndex < 0) {
    Logger.warn(`[${functionName}] Cabeçalho da Conta PicPay não encontrado.`);
    Logger.warn(`[${functionName}] Primeira linha detectada: ${JSON.stringify(csvData[0] || [])}`);
    return out;
  }

  const headers = csvData[headerIndex].map(h => normalizePicPayContaHeader_(h));
  const col = buildPicPayContaHeaderMap_(headers);

  const required = ["data", "tipo", "origem_destino", "valor"];
  const missing = required.filter(k => col[k] === undefined);

  if (missing.length > 0) {
    Logger.warn(`[${functionName}] Colunas obrigatórias ausentes: ${missing.join(", ")}`);
    Logger.warn(`[${functionName}] Headers normalizados: ${headers.join(" | ")}`);
    return out;
  }

  for (let i = headerIndex + 1; i < csvData.length; i++) {
    const row = csvData[i];

    if (!row || row.length < 3) continue;

    const data = safePicPayContaCell_(row, col.data);
    const hora = col.hora !== undefined ? safePicPayContaCell_(row, col.hora) : "";
    const tipoRaw = safePicPayContaCell_(row, col.tipo);
    const origemDestino = safePicPayContaCell_(row, col.origem_destino);
    const valorRaw = safePicPayContaCell_(row, col.valor);
    const formaPagamento = col.forma_pagamento !== undefined
      ? safePicPayContaCell_(row, col.forma_pagamento)
      : "";

    if (!data || !valorRaw) continue;

    const valorSigned = parsePicPayContaMoney_(valorRaw);

    if (isNaN(valorSigned) || Math.abs(valorSigned) < 0.01) continue;

    const type = valorSigned < 0 ? "D" : "C";

    const desc = buildPicPayContaDescription_({
      hora: hora,
      tipo: tipoRaw,
      origemDestino: origemDestino,
      formaPagamento: formaPagamento
    });

    out.push({
      data: data,
      desc: desc,
      value: Math.abs(valorSigned),
      type: type,
      account: "PicPay André",
      rawLine: row.join(",")
    });
  }

  Logger.log(`[${functionName}] Processamento finalizado. ${out.length} linhas extraídas com sucesso.`);
  return out;
}


/**
 * Detecta automaticamente delimitador "," ou ";".
 */
function parsePicPayContaCsvAuto_(content) {
  const comma = Utilities.parseCsv(content, ",");
  const semicolon = Utilities.parseCsv(content, ";");

  const commaScore = scorePicPayContaCsv_(comma);
  const semicolonScore = scorePicPayContaCsv_(semicolon);

  if (semicolonScore > commaScore) {
    Logger.log(`[processModulePicPayConta] Delimitador detectado: ;`);
    return semicolon;
  }

  Logger.log(`[processModulePicPayConta] Delimitador detectado: ,`);
  return comma;
}


function scorePicPayContaCsv_(csvData) {
  if (!csvData || csvData.length === 0) return 0;

  let bestScore = 0;

  for (let i = 0; i < Math.min(csvData.length, 10); i++) {
    const row = csvData[i] || [];
    const headers = row.map(h => normalizePicPayContaHeader_(h));
    const joined = headers.join("|");

    let score = 0;

    if (row.length >= 4) score += 3;
    if (joined.includes("data")) score += 2;
    if (joined.includes("hora")) score += 1;
    if (joined.includes("tipo")) score += 2;
    if (joined.includes("origem") && joined.includes("destino")) score += 2;
    if (joined.includes("valor")) score += 2;
    if (joined.includes("pagamento")) score += 1;

    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}


function findPicPayContaHeaderIndex_(csvData) {
  for (let i = 0; i < Math.min(csvData.length, 20); i++) {
    const headers = (csvData[i] || []).map(h => normalizePicPayContaHeader_(h));
    const col = buildPicPayContaHeaderMap_(headers);

    if (
      col.data !== undefined &&
      col.tipo !== undefined &&
      col.origem_destino !== undefined &&
      col.valor !== undefined
    ) {
      return i;
    }
  }

  return -1;
}


function buildPicPayContaHeaderMap_(headers) {
  const map = {};

  headers.forEach((h, idx) => {
    if (!h) return;

    // DATA
    if (
      map.data === undefined &&
      (
        h === "data" ||
        h === "date" ||
        h.startsWith("data_") ||
        h.includes("data")
      )
    ) {
      map.data = idx;
      return;
    }

    // HORA
    if (
      map.hora === undefined &&
      (
        h === "hora" ||
        h === "time" ||
        h.includes("hora") ||
        h.includes("horario")
      )
    ) {
      map.hora = idx;
      return;
    }

    // TIPO
    if (
      map.tipo === undefined &&
      (
        h === "tipo" ||
        h.includes("tipo") ||
        h.includes("descricao_movimento")
      )
    ) {
      map.tipo = idx;
      return;
    }

    // ORIGEM / DESTINO
    if (
      map.origem_destino === undefined &&
      (
        h === "origem_destino" ||
        h === "origemdestino" ||
        (h.includes("origem") && h.includes("destino")) ||
        h.includes("contraparte") ||
        h.includes("favorecido") ||
        h.includes("destinatario")
      )
    ) {
      map.origem_destino = idx;
      return;
    }

    // VALOR
    if (
      map.valor === undefined &&
      (
        h === "valor" ||
        h.includes("valor") ||
        h.includes("amount")
      )
    ) {
      map.valor = idx;
      return;
    }

    // FORMA DE PAGAMENTO
    if (
      map.forma_pagamento === undefined &&
      (
        h === "forma_pagamento" ||
        (h.includes("forma") && h.includes("pagamento")) ||
        h.includes("payment_method")
      )
    ) {
      map.forma_pagamento = idx;
      return;
    }
  });

  return map;
}


function normalizePicPayContaHeader_(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\/\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}


function safePicPayContaCell_(row, idx) {
  if (idx === undefined || idx === null) return "";
  return String(row[idx] || "").trim();
}


function parsePicPayContaMoney_(rawValue) {
  let s = String(rawValue || "").trim();

  if (!s) return NaN;

  // PicPay pode usar sinal unicode.
  s = s.replace(/−/g, "-");
  s = s.replace(/\u2212/g, "-");

  s = s.replace(/R\$/gi, "");
  s = s.replace(/\+/g, "");
  s = s.trim();

  // Formato BR: 4.300,00 -> 4300.00
  s = s.replace(/\./g, "");
  s = s.replace(",", ".");

  s = s.replace(/[^\d.-]/g, "");

  if (!s || s === "-" || s === ".") return NaN;

  return parseFloat(s);
}


function buildPicPayContaDescription_(data) {
  const hora = String(data.hora || "").trim();
  const tipo = String(data.tipo || "").trim();
  const origemDestino = String(data.origemDestino || "").trim();
  const formaPagamento = String(data.formaPagamento || "").trim();

  let desc = "";

  if (hora) desc += `[${hora}] `;

  desc += tipo || "Movimentação PicPay";

  if (origemDestino) desc += ` - ${origemDestino}`;

  if (formaPagamento) desc += ` (${formaPagamento})`;

  return desc.replace(/\s+/g, " ").trim();
}


/**
 * =============================================================================
 * ✅ FIM DO ARQUIVO
 * =============================================================================
 */
