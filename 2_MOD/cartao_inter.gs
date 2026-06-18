/**
 * 📂 ARQUIVO: 2_MOD/cartao_inter.gs
 * 💳 MÓDULO: PARSER ESPECIALISTA - CARTÃO INTER (TXT)
 * 🔢 VERSÃO: 8.0 (DIAMANTE - FULL DESCRIPTION & MASTER DATA)
 * 📅 DATA: 26/12/2025
 */

function processModuleInter(content) {
  const functionName = "processModuleInter";
  const out = [];
  const lines = content.split('\n');
  
  // 🔥 INJEÇÃO MASTER: Captura o vencimento real do Python
  const vencimentoMaster = extractVencimentoMaster(lines);
  
  let currentCardFinal = "MASTER"; 

  const mapMes = {
    "jan": "01", "fev": "02", "mar": "03", "abr": "04", "mai": "05", "jun": "06",
    "jul": "07", "ago": "08", "set": "09", "out": "10", "nov": "11", "dez": "12"
  };

  const regexCardHeader = /CARTÃO\s+(?:\d{4}\*{4})?(\d{4})/i;
  const regexLine = /^(\d{1,2})\s+de\s+([a-zç]{3})\.?\s+(\d{4})\s+(.+?)\s+-\s+(\+)?\s*R\$\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i;
  const regexParcela = /\(Parcela\s+(\d+)\s+de\s+(\d+)\)/i;

  Logger.log(`[${functionName}] Iniciando processamento GORDELÍCIO de ${lines.length} linhas.`);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    line = line.replace(/^\\s*/, "").trim(); 

    // Troca de Cartão (André/Yan) - MANTIDO
    const cardMatch = line.match(regexCardHeader);
    if (cardMatch) {
        currentCardFinal = cardMatch[1]; 
        continue;
    }

    if (line.match(/Total da sua fatura|Pagamento mínimo|Limite de crédito|SALDO DO MÊS/i)) continue;

    const match = line.match(regexLine);

    if (match) {
      const day = match[1].padStart(2, '0');
      const mesStr = match[2].toLowerCase().substring(0, 3);
      const yearOrig = match[3];
      const descOrig = match[4].trim(); 
      const isPlus = match[5] === "+"; 
      const rawVal = match[6];
      const month = mapMes[mesStr];

      if (!month) continue;

      let valAbs = parseFloat(rawVal.replace(/\./g, "").replace(",", "."));
      if (!valAbs || valAbs < 0.01) continue;
      if (!descOrig || descOrig === "") continue;

      // Parcelas - MANTIDO INTEGRALMENTE
      let pAtual = 1;
      let pTotal = 1;
      const parcMatch = descOrig.match(regexParcela);
      if (parcMatch) {
          pAtual = parseInt(parcMatch[1]);
          pTotal = parseInt(parcMatch[2]);
      }

      // --- LÓGICA DE DATA MASTER COM FALLBACK ---
      const dateFallback = `${day}/${month}/${yearOrig}`;
      const finalDateToStore = vencimentoMaster ? vencimentoMaster : dateFallback;

      out.push({
        data: finalDateToStore, // Coluna A: Fatura
        descricao: `[${day}/${month}] ${descOrig}`, // Coluna B: Compra + Descrição
        valor: (isPlus || descOrig.toUpperCase().includes("PAGAMENTO DE FATURA")) ? valAbs : -valAbs, 
        account: "Inter André", 
        cartao_final: currentCardFinal, 
        parcela_atual: pAtual,
        parcela_total: pTotal,
        rawLine: line
      });
    }
  }
  
  Logger.log(`[${functionName}] Processado com sucesso. ${out.length} itens encontrados.`);
  return out;
}