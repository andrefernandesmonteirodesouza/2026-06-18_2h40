/**
 * 📂 ARQUIVO: 2_MOD/cartao_nubank.gs
 * 🏦 MÓDULO ESPECIALISTA: NUBANK (DIAMANTE V4.0 - FULL HISTORY)
 * 📝 RESUMO/HISTÓRICO INTEGRAL:
 * - V2.0: Regex básico (DD/MM).
 * - V3.0: Arquitetura Híbrida. 
 * - V3.1: Suporte a DD MMM (Ex: "04 NOV").
 * - V4.0 (ATUAL): Injeção de Master Data sem perda de robustez original.
 */

function processModuleNubank(textContext) {
  const functionName = "processModuleNubank";
  try {
    const regexData = parseRegexNubank(textContext);
    if (regexData && regexData.length > 0) {
      Logger.log(`[NUBANK] Sucesso via Regex V4.0 Gordelício: ${regexData.length} itens.`, functionName);
      return regexData;
    }
  } catch (e) {
    Logger.error(`[NUBANK] Erro crítico no Regex: ${e.message}`, functionName);
  }
  
  Logger.warn(`[NUBANK] Acionando Fallback IA...`, functionName);
  return (typeof callGemini === 'function') ? parseAiNubank(textContext) : [];
}

function parseRegexNubank(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  const vencimentoMaster = extractVencimentoMaster(lines);
  const monthMap = { "JAN":0, "FEV":1, "MAR":2, "ABR":3, "MAI":4, "JUN":5, "JUL":6, "AGO":7, "SET":8, "OUT":9, "NOV":10, "DEZ":11 };
  
  let yearCalc = new Date().getFullYear();
  const yearMatch = text.match(/FATURA \d{2} [A-Z]{3} (\d{4})/i);
  if (yearMatch) yearCalc = parseInt(yearMatch[1]);

  // Regex Sniper Nubank Original V3.1 - MANTIDO
  const regex = /^(\d{2})\s(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)(?:.*?(\d{4}))?\s(.*?)\s(R\$\s[\d\.,]+)$/i;

  lines.forEach(line => {
    try {
        line = line.trim();
        if (line.length < 10) return;
        
        const upper = line.toUpperCase();
        if (upper.includes("PAGAMENTO") || upper.includes("SALDO RESTANTE") || upper.includes("TOTAL DE COMPRAS")) return;

        const match = line.match(regex);
        if (match) {
          const day = match[1];
          const monthStr = match[2].toUpperCase();
          const monthIndex = monthMap[monthStr];
          const cardFinal = match[3] || "NUBANK";
          const rawDesc = match[4].trim();
          const valStr = match[5].replace("R$", "").trim();
          
          let valorFloat = parseFloat(valStr.replace(/\./g, "").replace(",", "."));
          valorFloat = Math.abs(valorFloat) * -1; 

          // Fallback de Data original
          const dateFallback = `${day}/${String(monthIndex + 1).padStart(2, '0')}/${yearCalc}`;

          out.push({
            data: vencimentoMaster ? vencimentoMaster : dateFallback,
            descricao: `[${day}/${monthStr}] ${rawDesc}`,
            valor: valorFloat,
            parcela_atual: (rawDesc.match(/Parcela (\d+)\/(\d+)/i) || [0,1,1])[1],
            parcela_total: (rawDesc.match(/Parcela (\d+)\/(\d+)/i) || [0,1,1])[2],
            cartao_final: cardFinal,
            _origin: "REGEX_NUBANK_V4.0_DIAMANTE"
          });
        }
    } catch (innerErr) {
        Logger.warn(`[NUBANK] Erro na linha: ${innerErr.message}`);
    }
  });
  return out;
}

function parseAiNubank(text) {
  const prompt = `Extraia transações NUBANK. JSON esperado.`;
  const result = callGemini(prompt); 
  if(result) result.forEach(r => r._origin = "AI_NUBANK");
  return result;
}