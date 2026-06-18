/**
 * 📂 ARQUIVO: 2_MOD/conta_mercadopago.gs
 * 🏦 MÓDULO: PARSER ESPECIALISTA - MERCADO PAGO (CONTA/WALLET)
 * 🔢 VERSÃO: 1.0 (INITIAL RELEASE - LEGACY EXTRACTOR)
 * 📅 DATA: 23/12/2025
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Responsável por transformar o CSV bruto do Mercado Pago em objetos normalizados.
 * * 🔧 CORREÇÕES NATIVAS:
 * 1. Data: Converte 'DD-MM-YYYY' para 'DD/MM/YYYY'.
 * 2. Valor: Trata formato brasileiro (1.200,50) removendo ponto de milhar.
 * 3. RawLine: Reconstrói a linha original para garantir integridade no AntiDup.
 * -----------------------------------------------------------------------------
 */

function processModuleMercadoPago(content, delimiter = ";") {
  const functionName = "processModuleMercadoPago";
  const out = [];
  
  // Parse nativo do CSV com fallback de delimitador
  let csvData = [];
  try {
    csvData = Utilities.parseCsv(content, delimiter);
  } catch (e) {
    Logger.warn(`[${functionName}] Erro no delimiter '${delimiter}'. Tentando vírgula...`);
    csvData = Utilities.parseCsv(content, ",");
  }

  let startRow = -1;
   
  // 1. Busca inteligente do cabeçalho (Header Seeker)
  // O MP as vezes coloca metadados nas primeiras linhas antes do cabeçalho real.
  for (let i = 0; i < Math.min(20, csvData.length); i++) {
    const rowStr = csvData[i].join('|').toUpperCase();
    // Assinaturas comuns de cabeçalho do MP
    if ((rowStr.includes('DATE') && rowStr.includes('TRANSACTION')) || 
        (rowStr.includes('DATA') && rowStr.includes('IDENTIFICADOR')) ||
        (rowStr.includes('DATA') && rowStr.includes('DESCRIÇÃO'))) {
        startRow = i + 1; // Começa na linha seguinte ao cabeçalho
        break;
    }
  }
  
  if (startRow === -1) {
    Logger.warn(`[${functionName}] Cabeçalho padrão não encontrado. Iniciando da linha 1.`);
    startRow = 1;
  }

  // 2. Iteração e Extração
  for (let i = startRow; i < csvData.length; i++) {
    const cols = csvData[i];
    
    // Ignora linhas vazias ou rodapés curtos
    if (cols.length < 3) continue;

    let rawDate = cols[0]; 
    let desc = cols[1];      
    
    // Lógica para achar a coluna de valor (geralmente a última ou a quarta)
    let valIdx = 3; 
    if (cols.length <= 3) valIdx = cols.length - 1;
    const rawVal = cols[valIdx];
    
    // --- TRATAMENTO DE VALOR (Milhar BR) ---
    // Ex: "1.200,50" vira 1200.50
    let val = 0;
    if (rawVal) {
        let vStr = String(rawVal).replace("R$", "").trim();
        vStr = vStr.replace(/\./g, ""); // Remove ponto de milhar (Crucial!)
        vStr = vStr.replace(",", ".");  // Vírgula vira ponto decimal
        val = parseFloat(vStr);
    }

    // Filtro de Ruído: Ignora valores zerados ou inválidos
    if (isNaN(val) || Math.abs(val) < 0.01) continue;

    // --- TRATAMENTO DE DATA (Traço -> Barra) ---
    // MP envia 20-11-2025. Sheets/JS prefere 20/11/2025.
    if (rawDate && typeof rawDate === 'string') {
        rawDate = rawDate.replace(/-/g, "/");
        // Remove hora se houver (ex: 20/11/2025T14:00)
        rawDate = rawDate.split("T")[0].trim();
    }
    
    const type = val < 0 ? "D" : "C";

    // --- RECONSTRUÇÃO DA RAWLINE ---
    // Como usamos parseCsv, perdemos a string original. 
    // Vamos reconstruí-la fielmente unindo as colunas para criar o Hash no AntiDup.
    const reconstructedRawLine = cols.join(";");

    out.push({
        data: rawDate, 
        desc: desc,
        value: Math.abs(val),
        type: type,
        account: "Mercado Pago André",
        rawLine: reconstructedRawLine // <--- O SEGREDO DO SUCESSO DO ANTIDUP
    });
  }

  Logger.log(`[${functionName}] Processamento finalizado. ${out.length} linhas extraídas com sucesso.`);
  return out;
}