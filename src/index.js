/**
 * @description
 * Password encryption module encrypts data using AES-GCM PBKDF2.
 */

import { AES } from './aes-gcm-pbkdf2.js'

const SimpleEncryption = async ({ password }) => {
  if (password == null || (typeof password !== 'string' && !password.subarray)) {
    throw new Error('password must be a String or a TypedArray')
  }

  const aes = AES()

  let count = 0

  const encrypt = (value) => {
    if (!value?.subarray) {
      throw new Error('Data to encrypt must be a TypedArray')
    }
    return aes.encrypt(value, password, count++)
  }

  const decrypt = (value) => {
    if (!value?.subarray) {
      throw new Error('Data to decrypt must be a TypedArray')
    }
    return aes.decrypt(value, password)
  }

  return {
    encrypt,
    decrypt,
    ivInterval: aes.ivInterval
  }
}

/**
 * Detects if an OrbitDB database is encrypted when it has been opened
 * **without** any encryption options.
 *
 * Detection is based on two behaviors:
 * - For **data-only encryption**, `db.all()` succeeds but returns entries
 *   whose `value` is `undefined`, indicating encrypted payloads cannot be read.
 * - For **replication+data encryption**, calling `db.all()` may throw a
 *   `TypeError` when OrbitDB tries to read `entry.value` from undecryptable
 *   entries; this is treated as "encrypted".
 *
 * **LIMITATIONS**
 * - Empty databases return `false` because they are indistinguishable from
 *   encrypted databases whose log/entries also appear empty.
 * - This function is intentionally conservative: unexpected errors are treated
 *   as "not encrypted" to avoid false positives.
 *
 * @param {Object} db - OrbitDB database instance (opened without encryption options)
 * @returns {Promise<boolean>} - true if database appears to be encrypted, false otherwise
 *
 * @example
 * const db = await orbitdb.open(address, {})
 * const isEncrypted = await isDatabaseEncrypted(db)
 * if (isEncrypted) {
 *   // Show password modal
 * }
 */
const isDatabaseEncrypted = async (db) => {
  try {
    let all

    try {
      all = await db.all()
    } catch (error) {
      const msg = error?.message || ''

      // When opening an encrypted DB without encryption options, OrbitDB may throw
      // a TypeError like: "Cannot read properties of undefined (reading 'value')"
      // when trying to access entry.value on an undecryptable entry.
      if (error instanceof TypeError && /reading 'value'/.test(msg)) {
        return true
      }

      // For any other unexpected error, treat as not encrypted to avoid false positives.
      return false
    }
    
    // If database is empty, we can't tell if it's encrypted or just empty
    // This is especially true for replication encryption where log entries
    // themselves are encrypted, making encrypted DBs appear empty
    if (all.length === 0) {
      return false  // Could be empty OR encrypted with replication encryption
    }
    
    // If entries exist but values are undefined, database is encrypted (data-only)
    // Encrypted databases (data-only): entries have hashes but values are undefined
    // Unencrypted databases: entries have hashes AND readable values
    const hasEntriesWithUndefinedValues = all.every(entry => 
      entry.hash !== undefined && entry.value === undefined
    )
    
    return hasEntriesWithUndefinedValues
  } catch (error) {
    // Any unexpected error reaching here is treated as not encrypted
    // to avoid misclassifying infrastructure issues as encryption.
    return false
  }
}

export default SimpleEncryption
export { isDatabaseEncrypted }
