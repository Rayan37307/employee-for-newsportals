export function checkForSensitiveContent(text: string, sensitiveWords: string[]): boolean {
  if (!text || !sensitiveWords || sensitiveWords.length === 0) {
    return false
  }

  const lowerText = text.toLowerCase()

  for (const word of sensitiveWords) {
    const lowerWord = word.toLowerCase().trim()
    if (!lowerWord) continue

    // Check for whole word match
    const regex = new RegExp(`\\b${escapeRegex(lowerWord)}\\b`, 'i')
    if (regex.test(lowerText)) {
      console.log(`[SensitiveContent] Found sensitive word: "${lowerWord}" in text: "${text.substring(0, 50)}..."`)
      return true
    }

    // Also check for partial match (more aggressive)
    if (lowerText.includes(lowerWord)) {
      console.log(`[SensitiveContent] Found partial sensitive word: "${lowerWord}" in text: "${text.substring(0, 50)}..."`)
      return true
    }
  }

  return false
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function censorSensitiveWords(text: string, sensitiveWords: string[]): string {
  if (!text || !sensitiveWords || sensitiveWords.length === 0) {
    return text
  }

  let result = text
  const lowerText = text.toLowerCase()

  for (const word of sensitiveWords) {
    const lowerWord = word.toLowerCase().trim()
    if (!lowerWord) continue

    // Replace with asterisks
    const replacement = '*'.repeat(lowerWord.length)
    const regex = new RegExp(escapeRegex(lowerWord), 'gi')
    result = result.replace(regex, replacement)
  }

  return result
}

export function loadDefaultSensitiveWords(): string[] {
  return [
    // Add common sensitive words here if needed
    // These are just examples - users should configure their own
  ]
}
