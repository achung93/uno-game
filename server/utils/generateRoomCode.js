// Generate short, unique, human-readable room codes
// Excludes confusing characters (O, 0, I, 1, L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 4) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}
