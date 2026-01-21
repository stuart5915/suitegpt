import crypto from 'crypto'

export interface TelegramAuthData {
  id: number | string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export interface ValidatedTelegramUser {
  id: string
  username: string
  firstName: string
  lastName?: string
  photoUrl: string | null
}

/**
 * Validates Telegram Login Widget authentication data
 * See: https://core.telegram.org/widgets/login#checking-authorization
 */
export function validateTelegramAuth(authData: TelegramAuthData, botToken: string): boolean {
  // Extract hash from the data
  const { hash, ...dataWithoutHash } = authData

  if (!hash) {
    console.error('No hash provided in auth data')
    return false
  }

  // Create data-check-string by sorting keys alphabetically
  const dataCheckArr: string[] = []
  const sortedKeys = Object.keys(dataWithoutHash).sort() as (keyof typeof dataWithoutHash)[]

  for (const key of sortedKeys) {
    const value = dataWithoutHash[key]
    if (value !== undefined && value !== null) {
      dataCheckArr.push(`${key}=${value}`)
    }
  }

  const dataCheckString = dataCheckArr.join('\n')

  // Create secret key: SHA256 of bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest()

  // Calculate HMAC-SHA256 of data-check-string using secret key
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Compare with provided hash
  const isValid = hmac === hash

  if (!isValid) {
    console.error('Hash validation failed')
  }

  return isValid
}

/**
 * Check if auth_date is not too old (within 24 hours by default)
 */
export function isAuthDateValid(authDate: number, maxAgeSeconds: number = 86400): boolean {
  const now = Math.floor(Date.now() / 1000)
  const age = now - authDate
  return age >= 0 && age <= maxAgeSeconds
}

/**
 * Validate and parse Telegram auth data
 * Returns validated user if valid, null otherwise
 */
export function validateAndParseTelegramAuth(
  authData: TelegramAuthData,
  botToken: string,
  options: { skipHashValidation?: boolean; maxAuthAgeSeconds?: number } = {}
): ValidatedTelegramUser | null {
  const { skipHashValidation = false, maxAuthAgeSeconds = 86400 } = options

  // Check auth_date is not too old (skip for mini app params without auth_date)
  if (authData.auth_date && !isAuthDateValid(authData.auth_date, maxAuthAgeSeconds)) {
    console.error('Auth date is too old')
    return null
  }

  // Validate hash (skip if explicitly disabled or no hash provided)
  if (!skipHashValidation && authData.hash) {
    if (!validateTelegramAuth(authData, botToken)) {
      return null
    }
  }

  // Return validated user data
  return {
    id: authData.id.toString(),
    username: authData.username || '',
    firstName: authData.first_name,
    lastName: authData.last_name,
    photoUrl: authData.photo_url || null,
  }
}

/**
 * Create a session token for the user
 */
export function createSessionToken(telegramId: string, secret: string): string {
  const payload = {
    telegram_id: telegramId,
    created_at: Date.now(),
  }

  const payloadStr = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex')

  const token = Buffer.from(payloadStr).toString('base64') + '.' + signature
  return token
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(
  token: string,
  secret: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): { telegram_id: string; created_at: number } | null {
  try {
    const [payloadBase64, signature] = token.split('.')

    if (!payloadBase64 || !signature) {
      return null
    }

    const payloadStr = Buffer.from(payloadBase64, 'base64').toString()
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex')

    if (signature !== expectedSignature) {
      return null
    }

    const payload = JSON.parse(payloadStr)

    // Check if token is expired
    if (Date.now() - payload.created_at > maxAgeMs) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
