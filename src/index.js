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
 * Detects if an OrbitDB database is encrypted by checking if entries exist
 * but their values are undefined (which indicates encrypted data cannot be read).
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
    const all = await db.all()
    
    // If database is empty, we can't tell if it's encrypted or just empty
    if (all.length === 0) {
      return false
    }
    
    // If entries exist but values are undefined, database is encrypted
    // Encrypted databases: entries have hashes but values are undefined
    // Unencrypted databases: entries have hashes AND readable values
    const hasEntriesWithUndefinedValues = all.every(entry => 
      entry.hash !== undefined && entry.value === undefined
    )
    
    return hasEntriesWithUndefinedValues
  } catch (error) {
    // If we can't read the database, assume it's not encrypted
    // (or handle error appropriately)
    return false
  }
}

export default SimpleEncryption
export { isDatabaseEncrypted }
