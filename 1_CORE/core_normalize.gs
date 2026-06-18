/**
 * 📂 ARQUIVO: 1_CORE/core_normalize.gs
 * 📐 MÓDULO: NORMALIZAÇÃO DE DADOS
 * 🔢 VERSÃO: 5.1 (FIX: RAWLINE PASS-THROUGH)
 * 📅 DATA: 23/12/2025
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini (Arquiteto)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Transforma dados brutos heterogêneos (vindos de CSV ou PDF) em um formato
 * padrão uniforme para o sistema.
 *
 * 🔄 HISTÓRICO RECENTE:
 * - V5.0: Empty Category Fix.
 * - V5.1 (ATUAL - CRITICAL FIX):
 * > RAWLINE PASS-THROUGH: O normalizador agora preserva e transporta a propriedade
 * 'rawLine' (linha original) do objeto bruto para o normalizado.
 * Isso é vital para que o módulo 'AntiDup' consiga gerar o Hash de integridade.
 * -----------------------------------------------------------------------------
 */

function coreNormalizePipeline(payload) {
  const functionName = "coreNormalizePipeline";
  Logger.log(`[START] Normalizando ${payload.raw.length} linhas.`, functionName);

  if (!payload.raw || payload.raw.length === 0) return payload;

  payload.normalized = payload.raw.map(item => {
    try {
      // 1. DATA (Lógica Robusta BR/ISO)
      let rawDate = item.data || item.date;
      let finalDate;
      if (rawDate instanceof Date) finalDate = rawDate;
      else if (typeof rawDate === 'string') finalDate = parseDateSafely(rawDate);
      
      // Fallback para Hoje se falhar
      if (!finalDate || isNaN(finalDate.getTime())) {
         Logger.warn(`[DATA FAIL] Item sem data legível: ${JSON.stringify(item)}. Usando Hoje.`, functionName);
         finalDate = new Date();
      }
      const formattedDate = Utilities.formatDate(finalDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

      // 2. VALOR (Limpeza R$, vírgulas)
      let rawVal = (item.value !== undefined) ? item.value : item.amount;
      let val = 0.00;
      if (typeof rawVal === 'string') val = parseFloat(rawVal.replace(/[^\d,-]/g, '').replace(',', '.'));
      else if (typeof rawVal === 'number') val = rawVal;
      if (isNaN(val)) val = 0.00;

      // 3. CAMPOS BÁSICOS
      let rawDesc = item.desc || item.description;
      let desc = rawDesc ? String(rawDesc).trim() : "SEM_DESCRICAO";
      let account = item.account || "DESCONHECIDO";
      let type = item.type || (val < 0 ? "D" : "C");
      const inst = item.installments || { current: 1, total: 1 };

      // 🔥 CORREÇÃO CRÍTICA (V5.0):
      // Se 'item.category' vier, usa. Se não, usa string vazia "".
      let cat = item.category || ""; 

      return {
        id: null, // Será gerado no coreIdPipeline
        date: formattedDate,
        description: desc,
        amount: val,
        type: type,
        account: account,
        category: cat, 
        installments: { current: inst.current, total: inst.total },
        
        // 🚨 AQUI ESTÁ A CORREÇÃO (V5.1):
        // Transportamos a digital original para que o AntiDup possa trabalhar.
        rawLine: item.rawLine, 
        
        meta: item._meta || {}
      };

    } catch (e) {
      Logger.warn(`[ERROR] Falha norm: ${e.message}`, functionName);
      return null;
    }
  }).filter(i => i !== null);

  return payload;
}

function parseDateSafely(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.toString().trim();
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(s)) return new Date(s);
  const parts = s.split(/[^\d]/); 
  if (parts.length >= 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  return new Date(s);
}