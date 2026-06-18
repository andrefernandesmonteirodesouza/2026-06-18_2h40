/**
 * =============================================================================
 * 📂 ARQUIVO: 1_CORE/core_id.gs
 * 🆔 MÓDULO: GERADOR DE IDENTIDADE ÚNICA
 * 🔢 VERSÃO: 4.2 (SOURCE-KEY PARA FATURA PICPAY)
 * 📅 DATA: 07/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & ChatGPT
 * =============================================================================
 *
 * 🎯 OBJETIVO
 * Gerar ID_TRANSACAO e HASH_LINHA em sincronia com o AntiDup V9.4.
 *
 * 🛡️ REGRA
 * - Se o AntiDup já gerou line.hash, usa esse hash.
 * - Se precisar recalcular, usa a mesma regra V9.4:
 *   SOURCE_KEY para fatura PicPay; fórmula universal para demais fontes.
 * =============================================================================
 */

function coreIdPipeline(payload) {
  const functionName = "coreIdPipeline";
  Logger.log(`[START] ${functionName}: Iniciando geração de IDs (Protocolo V9.4).`, functionName);

  if (!payload || !Array.isArray(payload.normalized)) return payload;

  try {
    if (!payload.ids) payload.ids = [];
    if (!payload.warnings) payload.warnings = [];

    const batchTracker = new Set();

    payload.normalized = payload.normalized.map(function(line) {
      if (!line) return line;

      const hashId = line.hash || generateUniversalHashV9(line);

      line.id = hashId;
      line.hash = hashId;

      payload.ids.push(hashId);

      if (batchTracker.has(hashId)) {
        const valFormatado = Number(line.amount || 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        });

        const msg = `• ${line.date} | ${line.description} | ${valFormatado}`;
        Logger.warn(`[DUPLICATA INTERNA - ID] ${msg}`, functionName);
        payload.warnings.push(msg);
      } else {
        batchTracker.add(hashId);
      }

      line.signature = generateEnhancedSignature(line);
      return line;
    });

    Logger.log(`[SUCCESS] ${functionName}: IDs gerados no Padrão V9.4.`, functionName);
    return payload;

  } catch (error) {
    Logger.error(`[CRITICAL ERROR] ${functionName}: Falha na geração de ID.`, functionName, error);
    throw error;
  }
}

/**
 * 🔐 FÓRMULA UNIVERSAL
 * Mantém o nome generateUniversalHashV9 por compatibilidade.
 */
function generateUniversalHashV9(item) {
  try {
    const sourceKey = coreIdBuildSourceKey_(item);

    if (sourceKey) {
      return coreIdMd5Hex_(`SOURCE|${sourceKey}`);
    }

    return coreIdMd5Hex_(coreIdBuildUniversalSignature_(item));

  } catch (e) {
    Logger.error(`[generateUniversalHashV9] Falha ao gerar hash: ${e.message}`);
    return "ERROR_" + Math.floor(Math.random() * 100000000);
  }
}

function generateUniversalHashV92(item) {
  return generateUniversalHashV9(item);
}

function coreIdBuildSourceKey_(item) {
  const raw = String((item && item.rawLine) || "").trim();

  if (!raw) return "";

  if (/^PICPAY_FATURA_V\d+\.\d+\|/i.test(raw)) {
    return raw.toUpperCase().replace(/\s+/g, " ").trim();
  }

  return "";
}

function coreIdBuildUniversalSignature_(item) {
  const d = item && item.date ? String(item.date).trim() : "NODATE";

  const desc = item && item.description
    ? String(item.description).toUpperCase().trim()
    : "NODESC";

  const val = coreIdAmountAbsToFixed2_(item ? item.amount : null);

  const acc = item && item.account
    ? String(item.account).toUpperCase().trim()
    : "NOACC";

  const type = item && item.type
    ? String(item.type).toUpperCase().trim()
    : "D";

  return `${d}|${desc}|${val}|${acc}|${type}`;
}

function coreIdMd5Hex_(signature) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, signature)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
}

function coreIdAmountAbsToFixed2_(amount) {
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

function generateEnhancedSignature(line) {
  try {
    if (!line) return "";

    const data = line.date || "NODATE";
    const valor = Number(line.amount || 0).toFixed(2);
    const desc = (line.description || line.desc || "").toUpperCase();

    let semanticTag = "GEN";
    if (/PIX/.test(desc)) semanticTag = "PIX";
    if (/TED|DOC/.test(desc)) semanticTag = "TRANSF";

    const key = [data, valor, desc, semanticTag].join("|");

    if (typeof coreShaHash === "function") {
      return coreShaHash(key).substring(0, 24);
    }

    return "SIG_" + Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key)
    ).substring(0, 10);

  } catch (error) {
    return "";
  }
}
