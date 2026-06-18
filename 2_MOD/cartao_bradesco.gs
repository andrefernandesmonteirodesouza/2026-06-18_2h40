/**
 * 📂 ARQUIVO: 2_MOD/cartao_bradesco.gs
 * 💳 MÓDULO: PARSER ESPECIALISTA - CARTÃO BRADESCO (TXT)
 * 🔢 VERSÃO: 9.0 (DIAMANTE - MASTER DATA REDUNDANCY)
 * 📅 DATA: 26/12/2025
 * -----------------------------------------------------------------------------
 * 📝 LÓGICA REFINADA (BY ANDRÉ) + UPGRADE MASTER:
 * Mantém INTEGRALMENTE a Regex Sniper e o cálculo manual de virada de ano.
 * ADIÇÃO: Prioriza o Vencimento Master do Python, mas mantém o cálculo antigo 
 * como fallback de segurança absoluta.
 * -----------------------------------------------------------------------------
 */

function processModuleBradesco(content) {
  const functionName = "processModuleBradesco";
  const out = [];
  const lines = content.split('\n');
  const yearNow = new Date().getFullYear();

  // 🔥 NOVA INTELIGÊNCIA: Tenta capturar a data master injetada pelo Python
  const vencimentoMaster = extractVencimentoMaster(lines);

  // REGEX SNIPER ORIGINAL 🎯
  const regexLine = /^(\d{2}\/\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(-)?/;
  const regexParcela = /\s(\d{2})\/(\d{2})(\s|$)/;

  Logger.log(`[${functionName}] Iniciando processamento GORDELÍCIO de ${lines.length} linhas.`);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // 🚫 FILTRO DE RESUMOS (CRÍTICO) - MANTIDO INTEGRALMENTE
    if (line.includes("PAG BOLETO BANCARIO") || 
        line.includes("Total para as próximas faturas") ||
        line.includes("Saldo anterior") ||
        line.includes("Total de fatura")) {
        continue; 
    }

    if (line.length < 10) continue;

    const match = line.match(regexLine);
    
    if (match) {
      const rawDate = match[1]; 
      let rawDesc = match[2].trim(); 
      const rawVal = match[3];
      const isNegativeMarker = match[4] === "-"; 
      
      let valAbs = parseFloat(rawVal.replace(/\./g, "").replace(",", "."));
      if (!valAbs || valAbs < 0.01) continue;

      // Parcelas - MANTIDO
      let pAtual = 1;
      let pTotal = 1;
      const parcMatch = rawDesc.match(regexParcela);
      if (parcMatch) {
          pAtual = parseInt(parcMatch[1]);
          pTotal = parseInt(parcMatch[2]);
      }

      let finalVal = (isNegativeMarker || rawDesc.includes("CREDITO")) ? valAbs : -valAbs;

      // --- LÓGICA DE DATA (RESTAURADA E ROBUSTA) ---
      const parts = rawDate.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      
      // Cálculo de virada de ano original (Fallback de segurança)
      let yearCalc = yearNow;
      const monthNow = new Date().getMonth() + 1;
      if (monthNow < 3 && month > 10) yearCalc = yearNow - 1;
      const dateFallback = `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${yearCalc}`;

      // 🎯 DECISÃO DE DATA: Prioriza Vencimento Master, senão usa o calculado
      const finalDateToStore = vencimentoMaster ? vencimentoMaster : dateFallback;

      out.push({
        data: finalDateToStore,
        descricao: `[${rawDate}] ${rawDesc}`, // Injeção visual da data original
        valor: finalVal,    
        account: "Bradesco André",
        parcela_atual: pAtual, 
        parcela_total: pTotal, 
        rawLine: line
      });
    }
  }
  
  Logger.log(`[${functionName}] Processado com sucesso. ${out.length} itens.`);
  return out;
}