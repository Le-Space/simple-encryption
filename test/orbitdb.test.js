import { strictEqual, notEqual } from 'assert'
import { rimraf } from 'rimraf'
import path from 'path'
import { createOrbitDB } from '@orbitdb/core'
import connectPeers from './utils/connect-nodes.js'
import waitFor from './utils/wait-for.js'
import createHelia from './utils/create-helia.js'

import * as Block from 'multiformats/block'
import * as dagCbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'

import SimpleEncryption, { isDatabaseEncrypted } from '../src/index.js'

const codec = dagCbor
const hasher = sha256

const dbPath = './orbitdb/tests/write-permissions'

describe('Encryption with OrbitDB', function () {
  this.timeout(5000)

  let ipfs1, ipfs2
  let orbitdb1, orbitdb2
  let db1, db2

  let replicationEncryption
  let dataEncryption

  before(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()])
    await connectPeers(ipfs1, ipfs2)

    await rimraf('./orbitdb')

    orbitdb1 = await createOrbitDB({ ipfs: ipfs1, id: 'user1', directory: path.join(dbPath, '1') })
    orbitdb2 = await createOrbitDB({ ipfs: ipfs2, id: 'user2', directory: path.join(dbPath, '2') })

    replicationEncryption = await SimpleEncryption({ password: 'hello' })
    dataEncryption = await SimpleEncryption({ password: 'world' })
  })

  after(async () => {
    if (orbitdb1) {
      await orbitdb1.stop()
    }

    if (orbitdb2) {
      await orbitdb2.stop()
    }

    if (ipfs1) {
      await ipfs1.stop()
    }

    if (ipfs2) {
      await ipfs2.stop()
    }

    await rimraf('./orbitdb')
    await rimraf('./ipfs1')
    await rimraf('./ipfs2')
  })

  describe('Data is encrypted when replicated to peers', async () => {
    afterEach(async () => {
      if (db1) {
        await db1.drop()
        await db1.close()
      }
      if (db2) {
        await db2.drop()
        await db2.close()
      }
    })

    it('encrypts/decrypts data', async () => {
      let connected = false
      let updated = false
      let error = false

      const encryption = {
        data: dataEncryption
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })
      db2 = await orbitdb2.open(db1.address, { encryption })

      const onJoin = async (peerId, heads) => {
        connected = true
      }
      db2.events.on('join', onJoin)

      await waitFor(() => connected, () => true)

      const onUpdate = async (peerId, heads) => {
        updated = true
      }
      db2.events.on('update', onUpdate)

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        console.log(err)
        error = true
      }
      db2.events.on('error', onError)

      const hash1 = await db1.add('record 1')
      const hash2 = await db1.add('record 2')

      strictEqual(await db1.get(hash1), 'record 1')
      strictEqual(await db1.get(hash2), 'record 2')

      await waitFor(() => updated || error, () => true)

      const all = await db2.all()

      strictEqual(all.length, 2)
      strictEqual(all[0].value, 'record 1')
      strictEqual(all[1].value, 'record 2')
    })

    it('encrypts/decrypts log', async () => {
      let connected = false
      let updated = false
      let error = false

      const encryption = {
        replication: replicationEncryption
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })
      db2 = await orbitdb2.open(db1.address, { encryption })

      const onJoin = async (peerId, heads) => {
        connected = true
      }
      db2.events.on('join', onJoin)

      await waitFor(() => connected, () => true)

      const onUpdate = async (peerId, heads) => {
        updated = true
      }
      db2.events.on('update', onUpdate)

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        console.log(err)
        error = true
      }
      db2.events.on('error', onError)

      const hash1 = await db1.add('record 1')
      const hash2 = await db1.add('record 2')

      strictEqual(await db1.get(hash1), 'record 1')
      strictEqual(await db1.get(hash2), 'record 2')

      await waitFor(() => updated || error, () => true)

      const all = await db2.all()

      strictEqual(all.length, 2)
      strictEqual(all[0].value, 'record 1')
      strictEqual(all[1].value, 'record 2')
    })

    it('encrypts/decrypts log and data', async () => {
      let connected = false
      let updated = false
      let error = false

      const encryption = {
        replication: replicationEncryption,
        data: dataEncryption
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })
      db2 = await orbitdb2.open(db1.address, { encryption })

      const onJoin = async (peerId, heads) => {
        connected = true
      }
      db2.events.on('join', onJoin)

      await waitFor(() => connected, () => true)

      const onUpdate = async (peerId, heads) => {
        updated = true
      }
      db2.events.on('update', onUpdate)

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        console.log(err)
        error = true
      }
      db2.events.on('error', onError)

      const hash1 = await db1.add('record 1')
      const hash2 = await db1.add('record 2')

      strictEqual(await db1.get(hash1), 'record 1')
      strictEqual(await db1.get(hash2), 'record 2')

      await waitFor(() => updated || error, () => true)

      const all = await db2.all()

      strictEqual(all.length, 2)
      strictEqual(all[0].value, 'record 1')
      strictEqual(all[1].value, 'record 2')
    })

    it('throws an error if log can\'t be decrypted', async () => {
      let connected = false
      let hasError = false
      let error

      const replicationEncryptionWithWrongPassword = await SimpleEncryption({ password: 'olleh' })

      const encryption = {
        replication: replicationEncryption
      }

      const encryptionWithWrongPassword = {
        replication: replicationEncryptionWithWrongPassword
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })
      db2 = await orbitdb2.open(db1.address, { encryption: encryptionWithWrongPassword })

      const onJoin = async (peerId, heads) => {
        connected = true
      }
      db2.events.on('join', onJoin)

      await waitFor(() => connected, () => true)

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        error = err
        hasError = true
      }
      db2.events.on('error', onError)

      await db1.add('record 1')

      await waitFor(() => hasError, () => true)

      strictEqual(error.message, 'Could not decrypt entry')

      const all = await db2.all()

      strictEqual(all.length, 0)
    })

    it('throws an error if data can\'t be decrypted', async () => {
      let connected = false
      let hasError = false
      let error

      const dataEncryptionWithWrongPassword = await SimpleEncryption({ password: 'olleh' })

      const encryption = {
        data: dataEncryption
      }

      const encryptionWithWrongPassword = {
        data: dataEncryptionWithWrongPassword
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })
      db2 = await orbitdb2.open(db1.address, { encryption: encryptionWithWrongPassword })

      const onJoin = async (peerId, heads) => {
        connected = true
      }
      db2.events.on('join', onJoin)

      await waitFor(() => connected, () => true)

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        error = err
        hasError = true
      }
      db2.events.on('error', onError)

      await db1.add('record 1')

      await waitFor(() => hasError, () => true)

      strictEqual(error.message, 'Could not decrypt payload')

      const all = await db2.all()

      strictEqual(all.length, 0)
    })
  })

  describe('Data is encrypted in storage', async () => {
    afterEach(async () => {
      if (db1) {
        await db1.drop()
        await db1.close()
      }
    })

    it('payload bytes are encrypted in storage', async () => {
      let error

      const encryption = {
        data: dataEncryption
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        console.log(err)
        error = true
      }
      db1.events.on('error', onError)

      const hash1 = await db1.add('record 1')

      const bytes = await db1.log.storage.get(hash1)
      const { value } = await Block.decode({ bytes, codec, hasher })
      const payload = value.payload

      strictEqual(payload.constructor, Uint8Array)

      try {
        await Block.decode({ bytes: payload, codec, hasher })
      } catch (e) {
        error = e
      }

      strictEqual(error.message.startsWith('CBOR decode error'), true)
    })

    it('entry bytes are encrypted in storage', async () => {
      let error

      const encryption = {
        replication: replicationEncryption
      }

      db1 = await orbitdb1.open('encryption-test-1', { encryption })

      const onError = async (err) => {
        // Catch "Could not decrypt entry" errors
        console.log(err)
        error = true
      }
      db1.events.on('error', onError)

      const hash1 = await db1.add('record 1')
      let decodedBytes

      try {
        const bytes = await db1.log.storage.get(hash1)
        decodedBytes = await Block.decode({ bytes, codec, hasher })
        await Block.decode({ bytes: decodedBytes, codec, hasher })
      } catch (e) {
        error = e
      }

      notEqual(error, undefined)
      strictEqual(error.message.startsWith('CBOR decode error'), true)
      strictEqual(decodedBytes.value.constructor, Uint8Array)
    })
  })

  describe('Opening encrypted database without encryption options', async () => {
    afterEach(async () => {
      if (db1) {
        await db1.drop()
        await db1.close()
      }
      if (db2) {
        await db2.drop()
        await db2.close()
      }
    })

    it('cannot read encrypted data when opening database without encryption options', async () => {
      // Create an encrypted database with data encryption
      const encryption = await SimpleEncryption({ password: 'test-password' })
      db1 = await orbitdb1.open('encrypted-test', { encryption: { data: encryption } })
      
      await db1.add('test record 1')
      await db1.add('test record 2')
      
      // Verify we can read with encryption
      strictEqual((await db1.all()).length, 2)
      strictEqual((await db1.all())[0].value, 'test record 1')
      
      const dbAddress = db1.address
      
      // Close the encrypted database
      await db1.close()
      db1 = null
      
      // Open the same database WITHOUT encryption options
      db2 = await orbitdb1.open(dbAddress, {})
      
      // Set up error listener (to check if errors are emitted)
      let errorEmitted = false
      let emittedError
      const onError = async (err) => {
        errorEmitted = true
        emittedError = err
      }
      db2.events.on('error', onError)
      
      // Try to read the data
      const result = await db2.all()
      
      // Wait a bit to see if error event fires
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Verify behavior:
      // 1. Entries exist (hashes are readable) - proves database has data
      // 2. But values are undefined - proves encrypted data cannot be read
      strictEqual(result.length, 2, 'Should see entries exist (hashes are readable)')
      strictEqual(result[0].hash !== undefined, true, 'Entry should have a hash')
      strictEqual(result[0].value, undefined, 'Encrypted value should be undefined without encryption key')
      strictEqual(result[1].value, undefined, 'Encrypted value should be undefined without encryption key')
      
      // Note: Error events may or may not be emitted depending on OrbitDB implementation
      // The key proof is that values are undefined - encrypted data cannot be read
      
      // This proves:
      // 1. Database has entries (not empty) - can distinguish from empty DB
      // 2. But encrypted data cannot be read without encryption key (values are undefined)
      // This is useful for detection in simple-todo app to show password modal
    })

    it('isDatabaseEncrypted detects encrypted database correctly', async () => {
      // Test 1: Encrypted database should return true
      const encryption = await SimpleEncryption({ password: 'test-password' })
      db1 = await orbitdb1.open('encrypted-detection-test', { encryption: { data: encryption } })
      
      await db1.add('encrypted record 1')
      await db1.add('encrypted record 2')
      
      strictEqual((await db1.all()).length, 2)
      
      const encryptedAddress = db1.address
      await db1.close()
      db1 = null
      
      // Open encrypted database without encryption
      db2 = await orbitdb1.open(encryptedAddress, {})
      
      // Should detect as encrypted
      const isEncrypted1 = await isDatabaseEncrypted(db2)
      strictEqual(isEncrypted1, true, 'Encrypted database should be detected as encrypted')
      
      await db2.close()
      db2 = null
      
      // Test 2: Unencrypted database should return false
      db1 = await orbitdb1.open('unencrypted-detection-test', {})
      await db1.add('unencrypted record 1')
      await db1.add('unencrypted record 2')
      
      strictEqual((await db1.all()).length, 2)
      
      const unencryptedAddress = db1.address
      await db1.close()
      db1 = null
      
      // Open unencrypted database without encryption
      db2 = await orbitdb1.open(unencryptedAddress, {})
      
      // Should detect as not encrypted
      const isEncrypted2 = await isDatabaseEncrypted(db2)
      strictEqual(isEncrypted2, false, 'Unencrypted database should be detected as not encrypted')
      
      await db2.close()
      db2 = null
      
      // Test 3: Empty database should return false
      db1 = await orbitdb1.open('empty-detection-test', {})
      // Don't add any records
      
      const emptyAddress = db1.address
      await db1.close()
      db1 = null
      
      // Open empty database
      db2 = await orbitdb1.open(emptyAddress, {})
      
      // Should detect as not encrypted (empty databases can't be determined)
      const isEncrypted3 = await isDatabaseEncrypted(db2)
      strictEqual(isEncrypted3, false, 'Empty database should return false (cannot determine)')
    })
  })
})
