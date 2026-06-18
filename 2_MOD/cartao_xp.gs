/**
 * 📂 ARQUIVO: 2_MOD/cartao_xp.gs
 * 🏦 MÓDULO ESPECIALISTA: XP (DIAMANTE V10.2 - SNIPER DUAL & MASTER)
 * 🔢 VERSÃO: 10.2 (RESTAURAÇÃO SNIPER - PARA NO 1º VALOR)
 * 📅 DATA: 26/12/2025
 * -----------------------------------------------------------------------------
 * 📝 LÓGICA SNIPER (BY ANDRÉ):
 * A XP exibe: DATA | DESCRIÇÃO | VALOR REAL | VALOR DÓLAR.
 * O script captura a linha, identifica o primeiro valor (R$) e INTERROMPE ali,
 * ignorando o valor em dólar que costuma vir logo após.
 * -----------------------------------------------------------------------------
 */

function processModuleXP(textContext) {
  const functionName = "processModuleXP";
  
  try {
    const regexData = parseRegexXP(textContext);
    if (regexData && regexData.length > 0) {
      Logger.log(`[XP] Sucesso via Regex Sniper V10.2: ${regexData.length} itens extraídos.`, functionName);
      return regexData;
    }
  } catch (e) {
    Logger.error(`[XP] Erro crítico no motor de Regex: ${e.message}`, functionName);
  }

  Logger.warn(`[XP] Regex Sniper falhou. Acionando Fallback IA...`, functionName);
  return parseAiXP(textContext);
}

function parseRegexXP(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  const vencimentoMaster = extractVencimentoMaster(lines);
  
  // Blacklist Original Preservada
  const BLACKLIST = ["SALDO", "PAGAMENTO TOTAL", "SUBTOTAL", "MÍNIMO", "FINANCIADO", "TOTAL DA FATURA", "VENCIMENTO"];

  /**
   * REGEX SNIPER ATUALIZADA 🎯
   * ^(\d{2}\/\d{2}\/\d{2,4}) -> Grupo 1: Data da compra
   * [\s\t]+                  -> Espaços ou Tabs
   * (.*?)                    -> Grupo 2: Descrição (Lazy)
   * [\s\t]+                  -> Espaços ou Tabs
   * (-?\d{1,3}(?:\.?\d{3})*,\d{2}) -> Grupo 3: PRIMEIRO VALOR (R$) - O Sniper para aqui.
   * .* -> Ignora o resto da linha (Valor em Dólar/Lixo)
   */
  const sniperRegex = /^(\d{2}\/\d{2}\/\d{2,4})[\s\t]+(.*?)[\s\t]+(-?\d{1,3}(?:\.?\d{3})*,\d{2})/;

  lines.forEach(line => {
    const lTrim = line.trim();
    if (lTrim.length < 15) return;
    if (BLACKLIST.some(t => lTrim.toUpperCase().includes(t))) return;

    const match = lTrim.match(sniperRegex);
    if (match) {
      let dataCompra = match[1];
      let descricao = match[2].trim();
      const valorRealStr = match[3];

      // Sanitização de descrição (Remove traços e R$ residuais)
      descricao = descricao.replace(/R\$\s*$/, "").replace(/-\s*$/, "").trim();
      if (descricao.length < 3) return;

      let valorFloat = parseFloat(valorRealStr.replace(/\./g, "").replace(",", "."));
      
      // Lógica de Crédito/Estorno XP (MANTIDA)
      const isCreditKeyword = lTrim.toUpperCase().match(/CRÉDITO|ESTORNO|PAGAMENTO|REEMBOLSO/);

      if (valorFloat < 0 || isCreditKeyword) {
          valorFloat = Math.abs(valorFloat); // Crédito
      } else {
          valorFloat = -Math.abs(valorFloat); // Gasto
      }

      if (Math.abs(valorFloat) < 0.01) return;

      out.push({
        data: vencimentoMaster ? vencimentoMaster : dataCompra,
        descricao: `[${dataCompra.substring(0,5)}] ${descricao}`,
        valor: valorFloat,
        parcela_atual: (descricao.match(/Parcela (\d+)\/(\d+)/i) || [0,1,1])[1],
        parcela_total: (descricao.match(/Parcela (\d+)\/(\d+)/i) || [0,1,1])[2],
        cartao_final: "XP",
        _origin: "REGEX_XP_V10.2_DIAMANTE"
      });
    }
  });
  return out;
}

/**
 * 🧠 ENGINE IA (BLINDADA)
 */
function parseAiXP(text) {
  const prompt = `Extraia transações XP em JSON puro. Ignore colunas de dólar. JSON: [{"data":"DD/MM/YYYY","descricao":"string","valor":-1.00}]`;
  try {
      if (typeof callGemini === 'function') {
          let result = callGemini(prompt); 
          if(result && Array.isArray(result)) return result;
      }
  } catch (e) {
      Logger.error(`[XP] Falha IA: ${e.message}`);
  }
  return [];
}