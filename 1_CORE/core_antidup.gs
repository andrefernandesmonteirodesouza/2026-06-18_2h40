/**
 * =============================================================================
 * 📂 ARQUIVO: 1_CORE/core_antidup.gs
 * 🛡️ MÓDULO: MOTOR DE ANTI-DUPLICIDADE
 * 🔢 VERSÃO: 15.3 (SPLIT ESTRUTURAL — SOMENTE MOTOR DE ANTI-DUPLICIDADE)
 * 📅 DATA: 18/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & Claude (split) / André Fernandes & ChatGPT (origem v15.2)
 * =============================================================================
 *
 * 🎯 OBJETIVO
 * Bloquear duplicidades antes da persistência, consultando mesa de trabalho e histórico.
 *
 * 🛠️ MELHORIA V9.4 (preservada da v15.2)
 * - Mantém a assinatura padrão para extratos comuns:
 *   DATA | DESCRICAO | VALOR_ABS | CONTA | TIPO
 *
 * - Para fatura PicPay com rawLine técnico:
 *   usa SOURCE_KEY baseada no rawLine gerado pelo parser.
 *
 * Isso evita barrar compras repetidas legítimas na mesma fatura, mas continua
 * barrando reimportação da mesma fatura.
 *
 * 📝 RESUMO/HISTÓRICO
 * - v15.2 (07/06/2026) — ANTI-DUP DB + HIST. Versão original, autoria André Fernandes &
 *   ChatGPT. Conteúdo: motor de anti-duplicidade completo (assinatura universal + hash).
 * - v15.3 (18/06/2026) — SPLIT ESTRUTURAL, autoria André Fernandes & Claude. Este arquivo
 *   ao longo do tempo havia acumulado, além do motor real de anti-dup, mais 46 funções e
 *   5 constantes de ferramentas de auditoria/saúde/limpeza/organização (subsistemas GFP
 *   15.4, 15.7, 15.8, 15.9, 15.9.3.1 e 15.9.4.1) — o que contrariava a filosofia modular
 *   (Lego) do projeto, em que cada arquivo deve ter uma responsabilidade só.
 *   André autorizou explicitamente, em 18/06/2026, extrair tudo que não é motor de
 *   anti-dup para um arquivo próprio. Esta versão 15.3 contém SOMENTE as 7 funções
 *   originais do motor (runAntiDupFilter, getExistingHashesFromDatalake,
 *   antiDupGenerateHashV94_, antiDupBuildSourceKey_, antiDupBuildUniversalSignature_,
 *   antiDupMd5Hex_, antiDupAmountAbsToFixed2_). NENHUMA LINHA DE CÓDIGO DENTRO DESSAS
 *   FUNÇÕES FOI ALTERADA — apenas removidas as 46 funções/5 constantes que não pertenciam
 *   aqui, agora residentes em 6_GOVERNANCA/auditoria_saude_importacao.gs.
 *   Verificação de integridade: diff de nomes de função/constante entre este arquivo v15.2
 *   original (53 funções / 5 constantes) e a soma deste arquivo v15.3 (7 funções / 0
 *   constantes) + o novo arquivo (46 funções / 5 constantes) = equivalência 100%, sem
 *   perda, duplicação ou renomeação de símbolo nenhum.
 * =============================================================================
 */

function runAntiDupFilter(payload) {
  const functionName = "runAntiDupFilter";

  if (!payload || !payload.normalized || !Array.isArray(payload.normalized)) {
    Logger.log(`[${functionName}] 🚨 ERRO CRÍTICO: Payload inválido.`);
    return payload;
  }

  Logger.log(`[${functionName}] 🛡️ Iniciando blindagem 15.2.4 com hash V9.4 para ${payload.normalized.length} itens...`);

  const existingHashes = getExistingHashesFromDatalake();
  Logger.log(`[${functionName}] 🧠 Memória carregada: ${existingHashes.size} IDs/hashes protegidos.`);

  const newItems = [];
  let ignoredCount = 0;
  let errorCount = 0;

  const batchHashes = new Set();

  payload.normalized.forEach((item, index) => {
    try {
      if (!item) {
        errorCount++;
        return;
      }

      const hash = antiDupGenerateHashV94_(item);
      item.hash = hash;

      let isDuplicate = false;
      let reason = "";

      if (existingHashes.has(hash)) {
        isDuplicate = true;
        reason = "DB_MATCH";
        Logger.warn(`[DUPLICATA DB] Já existe: ${item.date} | ${item.description} | ${item.amount} | ${item.account} | ${item.type}`);
      } else if (batchHashes.has(hash)) {
        isDuplicate = true;
        reason = "INTERNAL_MATCH";
        Logger.warn(`[DUPLICATA INTERNA] Item repetido no arquivo/lote: ${item.date} | ${item.description} | ${item.amount} | ${item.account} | ${item.type}`);
      }

      if (isDuplicate) {
        ignoredCount++;
        if (!payload.warnings) payload.warnings = [];
        payload.warnings.push(`[AntiDup:${reason}] ${item.date} | ${item.description} | ${item.amount}`);
      } else {
        newItems.push(item);
        batchHashes.add(hash);
      }

    } catch (e) {
      Logger.error(`[${functionName}] ❌ Erro Item ${index}: ${e.message}`);
      errorCount++;
    }
  });

  if (!payload.meta) payload.meta = {};
  payload.meta.antiDup = {
    version: "15.2.4_HASH_V9.4",
    input: payload.normalized.length,
    output: newItems.length,
    ignored: ignoredCount,
    errors: errorCount
  };

  payload.normalized = newItems;

  Logger.log(`[${functionName}] ✅ Filtragem concluída. Novos: ${newItems.length} | Barrados: ${ignoredCount} | Erros: ${errorCount}`);

  return payload;
}

function getExistingHashesFromDatalake() {
  // GFP 15.2 — anti-duplicidade consulta mesa de trabalho + histórico ativo.
  if (typeof GFP_DATALAKE_GET_EXISTING_KEYS_15_2 === "function") {
    return GFP_DATALAKE_GET_EXISTING_KEYS_15_2({
      includeWork: true,
      includeHist: true
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.flush();

  const sheetsToRead = ["DB_TRANSACOES", "DB_TRANSACOES_HIST"];
  const existingMap = new Set();

  sheetsToRead.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      .map(h => String(h).toUpperCase().trim());

    const hashColIndex = headers.indexOf("HASH_LINHA") + 1;
    const idColIndex = headers.indexOf("ID_TRANSACAO") + 1;
    const histStatusIndex = headers.indexOf("HIST_STATUS") + 1;

    if (hashColIndex <= 0 && idColIndex <= 0) return;

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    data.forEach(row => {
      if (histStatusIndex > 0) {
        const histStatus = String(row[histStatusIndex - 1] || "").trim().toUpperCase();
        if (histStatus === "DESARQUIVADO") return;
      }

      if (hashColIndex > 0) {
        const hash = String(row[hashColIndex - 1] || "").trim();
        if (hash) {
          existingMap.add(hash);
          existingMap.add("HASH:" + hash);
        }
      }

      if (idColIndex > 0) {
        const id = String(row[idColIndex - 1] || "").trim();
        if (id) {
          existingMap.add(id);
          existingMap.add("ID:" + id);
        }
      }
    });
  });

  return existingMap;
}

/**
 * 🔐 Fórmula V9.4
 * Prioridade:
 * 1. SOURCE_KEY técnica para fatura PicPay.
 * 2. Fórmula universal para demais fontes.
 */
function antiDupGenerateHashV94_(item) {
  const sourceKey = antiDupBuildSourceKey_(item);

  if (sourceKey) {
    return antiDupMd5Hex_(`SOURCE|${sourceKey}`);
  }

  return antiDupMd5Hex_(antiDupBuildUniversalSignature_(item));
}

/**
 * SOURCE_KEY: usada apenas para fontes que precisam de identidade por ocorrência,
 * como fatura de cartão com compras repetidas legítimas.
 */
function antiDupBuildSourceKey_(item) {
  const raw = String((item && item.rawLine) || "").trim();

  if (!raw) return "";

  // Por enquanto, só ativamos para a fatura PicPay V10.16+.
  // Isso evita alterar o comportamento de extratos bancários comuns.
  if (/^PICPAY_FATURA_V\d+\.\d+\|/i.test(raw)) {
    return raw.toUpperCase().replace(/\s+/g, " ").trim();
  }

  return "";
}

function antiDupBuildUniversalSignature_(item) {
  const d = item && item.date ? String(item.date).trim() : "NODATE";

  const desc = item && item.description
    ? String(item.description).toUpperCase().trim()
    : "NODESC";

  const val = antiDupAmountAbsToFixed2_(item ? item.amount : null);

  const acc = item && item.account
    ? String(item.account).toUpperCase().trim()
    : "NOACC";

  const type = item && item.type
    ? String(item.type).toUpperCase().trim()
    : "D";

  return `${d}|${desc}|${val}|${acc}|${type}`;
}

function antiDupMd5Hex_(signature) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, signature)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
}

function antiDupAmountAbsToFixed2_(amount) {
  if (amount === undefined || amount === null || amount === "") return "0.00";

  let n;

  if (typeof amount === "number") {
    n = amount;
  } else {
    let s = String(amount).trim();

    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.indexOf(",") >= 0) {
      s = s.replace(",", ".");
    }

    s = s.replace(/[^\d.-]/g, "");
    n = parseFloat(s);
  }

  if (isNaN(n)) n = 0;

  return Math.abs(n).toFixed(2);
}