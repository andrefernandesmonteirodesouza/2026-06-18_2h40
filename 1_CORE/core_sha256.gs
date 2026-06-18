/**
 * @fileoverview Módulo CORE de Criptografia para Hashing SHA-256.
 * @description Contém o motor de hashing e a função de serialização estável de objetos.
 */

/**
 * 1. CORE HASHING: Gera o hash SHA-256 de uma string de entrada.
 * @param {string | object} input - Texto ou objeto a ser resumido.
 * @returns {string} O hash SHA-256 em formato hexadecimal.
 */
function coreShaHash(input) {
  const functionName = "coreShaHash";
  let text;
  
  if (input === null || input === undefined) {
    text = "";
  } else if (typeof input === 'object') {
    // Se for objeto, garante que a serialização é estável antes de hashear
    text = coreSha256StableStringify(input);
  } else {
    text = String(input);
  }
  
  try {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    // Converte o array de bytes em string hexadecimal formatada (01-FF)
    return raw.map(b => {
      const v = (b & 0xFF).toString(16);
      return v.length === 1 ? "0" + v : v;
    }).join("");
  } catch (error) {
    Logger.error(`[ERROR] ${functionName}: Falha crítica ao computar o digest.`, functionName, error);
    return null; 
  }
}

/**
 * 2. SERIALIZAÇÃO ESTÁVEL: Transforma um objeto em string, garantindo a ordem alfabética das chaves.
 * (Evita que {b:1, a:2} gere hash diferente de {a:2, b:1})
 * @param {any} input - O objeto ou valor a ser serializado.
 * @returns {string} String serializada estável.
 */
function coreSha256StableStringify(input) {
  const functionName = "coreSha256StableStringify";
  
  try {
    const seen = new WeakSet();
    
    function serialize(value) {
      if (value === null) return "null";
      if (value === undefined) return "";
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (typeof value === "string") return value;
      
      if (typeof value === "object") {
        // Previne referência circular
        if (seen.has(value)) return ""; 
        seen.add(value);
        
        if (Array.isArray(value)) return "[" + value.map(v => serialize(v)).join(",") + "]";
        
        const keys = Object.keys(value).sort(); 
        const body = keys.map(k => `${k}:${serialize(value[k])}`).join(",");
        
        return `{${body}}`;
      }
      return "";
    }
    
    const result = serialize(input);
    return result;
    
  } catch (error) {
    Logger.error(`[ERROR] ${functionName}: Falha na serialização estável.`, functionName, error);
    return "SERIALIZATION_ERROR_" + Date.now(); 
  }
}

/**
 * Alias de compatibilidade
 */
function coreSha256Hash(text) { return coreShaHash(text); }