// Normalização de telefones brasileiros.
//
// O login compara o telefone digitado com o que está salvo no banco. Como os
// números são guardados apenas com dígitos (sem máscara), pequenas diferenças
// de formato faziam o login falhar com "Telefone não encontrado". Os casos mais
// comuns são:
//   - código do país 55 presente em um lado e ausente no outro
//     (ex.: cadastrou "85 99999-9999", digita "+55 85 99999-9999")
//   - 9º dígito do celular presente em um lado e ausente no outro
//     (ex.: cadastrou "8588887777", digita "85988887777")
//
// Para resolver, geramos todas as variações plausíveis do número e deixamos o
// banco achar qualquer uma delas.

/** Remove tudo que não for dígito e tira o código do país (55), se houver. */
export function normalizePhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '')
  // Remove o código do país brasileiro quando o número fica longo demais.
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  return digits
}

/**
 * Gera as variações plausíveis de um número para busca tolerante a formato:
 * com/sem código do país (55) e com/sem o 9º dígito do celular.
 */
export function phoneVariants(raw: string): string[] {
  const base = normalizePhone(raw)
  if (!base) return []

  const variants = new Set<string>([base])

  // DDD (2 dígitos) + número. Tratamos a presença/ausência do 9º dígito.
  if (base.length === 11) {
    // DDD + 9 + 8 dígitos -> também tenta sem o 9 (formato antigo).
    const ddd = base.slice(0, 2)
    const rest = base.slice(2)
    if (rest.startsWith('9')) variants.add(ddd + rest.slice(1))
  } else if (base.length === 10) {
    // DDD + 8 dígitos -> também tenta com o 9 (celular atual).
    const ddd = base.slice(0, 2)
    const rest = base.slice(2)
    variants.add(ddd + '9' + rest)
  }

  // Acrescenta as formas com o código do país para cobrir números salvos com 55.
  for (const v of [...variants]) variants.add('55' + v)

  return [...variants]
}
