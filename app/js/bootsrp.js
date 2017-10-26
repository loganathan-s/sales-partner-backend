const fury = require('stromdao-businessobject')
const ethers = require('ethers')
const djb = require('js-hash/djb2')
const request = require('request-promise')

// TODO:
// 1) start with setting up the rootuser => jochentest via brainwallet
// 2) rootuser === rootnode
// 3) set up rootledger
// 4) set up seedusers + tenant ledgers via brainwallet
//    a) new tennant / new user / provider === seedledger
//    b) existing tenant / new user
//    c) new user / new tennant / provider !== rootledger (reseller invite)
// try without handshake

const app = {
  appid: 'spapptest',
  apiHost: 'http://fury.network/api',
  rpcHost: 'https://demo.stromdao.de/rpc=',
  rootnode: {
    tenantId: 'sevtest',
    username: 'root',
    password: 'rootsecret',
    address: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E',
    privateKey:
      '0xf1e07118a448dcef563626da98ef98b37f66a7d84d6c1176242556d350ca1b70',
    provider: null,
    ledger: {
      tenantId: 'sevtest',
      address: '0x691C0173bbAF9B8e8293D6d6b145bbb775B1A84e',
      accounts: [
        {
          tenantId: 'sevtest',
          name: 'calc-00000',
          extid: 'sevtest::calc-00000',
          roleKey: 211048249319,
          privateKey:
            '0x99e93100cb183275525ddab7333f33c74b4297842a3803647e81034f3c873361',
          address: '0xf6722FfE3F2D3eF18c8eA0C770C87755021BB376'
        },
        {
          tenantId: 'sevtest',
          name: 'settlement',
          extid: 'sevtest::settlement::2017',
          roleKey: 163201715825,
          privateKey:
            '0x6a8fc420cfc5837a0f199db2459f46941c0288475d962a8e1aa30f10962369d7',
          address: '0x6d51EA8d72bD24522c7362b5D23c4a63f67d15fA'
        },
        {
          tenantId: 'raketenstrom',
          name: 'entitlement',
          extid: 'raketenstrom::entitlement::2017',
          roleKey: 165767480331,
          privateKey:
            '0xcc5a167a0cd1824eaafb0ea96303388d3b415d4ec29facc30becc5b1376ae0c0',
          address: '0xbD026544AbAC792562D237D0D6dAb2B6a3a8C72b'
        },
        {
          tenantId: 'raketenstrom',
          name: 'bank',
          extid: 'raketenstrom::bank',
          roleKey: 111158093818,
          privateKey:
            '0x00ae187fea2a36b1c7f3dc0574f125ad995fcac4ce8b6fe73cba3ea4658c0b08',
          address: '0xe1af75233b34d8F29E7A1569143F1c49350cAc66'
        },
        {
          tenantId: 'demo',
          name: 'entitlement',
          extid: 'demo::entitlement::2017',
          roleKey: 105720633123,
          privateKey:
            '0x48ee497c8b6a1a66cdf1a5503b7582150b409718979acff66524c5901658d28f',
          address: '0xAda5D5EDaf74F6A4172bEC3a1bb07F8F53a4F92d'
        },
        {
          tenantId: 'demo',
          name: 'bank',
          extid: 'demo::bank',
          roleKey: 166576908810,
          privateKey:
            '0x4717f49f2f83ad1f8ea6b9079c52f8ab3e2b3386d3906b86c7560c2d56682c4b',
          address: '0x9D2e468DE70b68fE670C23db33d979cd4B2cC012'
        }
      ]
    }
  },
  tenants: [
    {
      tenantId: 'raketenstrom',
      username: 'rakete',
      password: 'start',
      privateKey:
        '0x698471df22367d3a223366a4e9a2d78ef18746e18d195ed51327212157e4645b',
      address: '0xB6382fDb7b042b6EFf2B6786427850B21150481A',
      ledger: {}, // hardcoded at role 42
      rootnode: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E', // hardcoded
      provider: {
        tennantId: 'sevtest',
        address: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E'
      } // hardcoded
    },
    {
      tenantId: 'demo',
      type: 'user',
      username: 'demouser',
      password: 'demosecret',
      privateKey:
        '0x73418ab41bbef22b0e0ec5944b0b05ac5994d6b2c0b8ddd5d49112629ac2fff8',
      address: '0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09',
      ledger: {}, // hardcoded at role 42
      rootnode: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E', // hardcoded at role hash('rootnode')
      provider: {
        // hardcoded string store at role ...
        tennantId: 'sevtest',
        address: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E'
      }
    }
  ],
  users: [],
  data: []
}

/*
  rakete ('0xB6382fDb7b042b6EFf2B6786427850B21150481A')
  setting role 42  of  0xB6382fDb7b042b6EFf2B6786427850B21150481A  to  0xE5c42357F76575D479B3b8C4e6B77Eb942A21c4b
  setting role 85873873117 ('rootnode::address') of  0xB6382fDb7b042b6EFf2B6786427850B21150481A  to  0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E
  stringStore relation at role 15216300368 ('tenantId') string:  raketenstrom
  stringStore relation at role 20550071718 ('provider::tenantId') string:  sevtest
  setting role 94397483417 ('provider::address')  of  0xB6382fDb7b042b6EFf2B6786427850B21150481A  to  0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E
  setting role 85647153723 ('provider::ledgerAddress')  of  0xB6382fDb7b042b6EFf2B6786427850B21150481A  to  0x691C0173bbAF9B8e8293D6d6b145bbb775B1A84e
*/

/*
  demouser ('0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09')
  setting role 42  of  0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09  to  0xE48A7F1400b6bd69e6Cb49E388b9bfA1e2346275
  setting role 85873873117 ('rootnode::address')  of  0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09  to  0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E
  stringStore relation at role 15216300368 ('tenantId') string:  demo
  stringStore relation at role 20550071718 ('provider::tenantId') string:  sevtest
  setting role 94397483417 ('provider::address')  of  0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09  to  0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E
  setting role 85647153723 ('provider::ledgerAddress')  of  0x5B4a39ebB3D0d86048724fCb1b4b5051DacE9B09  to  0x691C0173bbAF9B8e8293D6d6b145bbb775B1A84e
*/

/* allways instantiate rootnode */

const node = new fury.Node({
  external_id: app.rootnode.extid,
  privateKey: app.rootnode.privateKey || undefined,
  testMode: true
})
console.log('---- rootnode -----')
console.log(app.rootnode)
console.log('---- rootnode -----')

/* create rootnode keys */

if (!app.rootnode.privateKey) {
  console.info('creating new rootnode keys')
  const rootAccount = new fury.Account(
    app.rootnode.username,
    app.rootnode.password
  )
  rootAccount.wallet().then(wallet => {
    app.rootnode.address = wallet.address
    app.rootnode.privateKey = wallet.privateKey
    console.log('root node keys created:')
    console.log(app.rootnode)
  })
}

/* bootstrap rootledger */

if (!app.rootnode.ledger.address) {
  createLedger(node, true)
}

/* bootstrap seed tenants */

if (app.tenants.length === 0) {
  // { tenantId: 'sevtest', username: 'jochentest', password:'test' },
  let seedTenants = [
    { tenantId: 'raketenstrom', username: 'rakete', password: 'start' },
    { tenantId: 'demo', username: 'demouser', password: 'demosecret' }
  ]

  let arr = seedTenants.map(item => {
    return function () {
      return createTenantAccount(item.tenantId, item.username, item.password)
    }
  })

  serialPromise(arr)
    .then(console.log.bind(console))
    .catch(err => console.error(err))
}

/* seed tennant accounts relational setup */

let something = true
if (app.tenants.length !== 0 && something) {
  let tArr = app.tenants.map(itm => {
    return function () {
      console.info('---- ', itm.username, '--------')
      return createTenantRelations(itm.tenantId, itm.privateKey)
    }
  })

  serialPromise(tArr)
    .then(console.log.bind(console))
    .catch(err => console.error(err))
}

/* bootstrap rootledger accounts */

if (app.rootnode.ledger.address && app.rootnode.ledger.accounts.length === 0) {
  serialPromise(bootstrpRootAccounts(node))
    .then(console.log.bind(console))
    .then(() => {
      console.log('rootnode.ledger.accounts:')
      console.log(app.rootnode.ledger.accounts)
    })
}

/* setup admin user */
/**
 * add user To ledger
 *
 * this will be used to create additional user nodes under the same tennent id
 * these nodes will use the same ledger.
 *
 * 1)
 *
 */

// function addRootledgerUsers (n, users) {
function addRootledgerUsers (n, users) {
  return users.map(user => {
    return function () {
      let uNode = new fury.Node({
        privateKey: user.privateKey,
        testMode: true
      })

      return addSenderToLedger(n, user.address, app.rootnode.ledger.address)
        .then(() => {
          return setRelation(uNode, 42, app.rootnode.ledger.address)
        })
        .then(() => {
          let rootnodeExtid = app.rootnode.extid // hash([appid]::rootnode) convention
          let rootnodeAddress = app.rootnode.address // hardcoded into app
          setRelation(uNode, hash(rootnodeExtid), rootnodeAddress)
        })
    }
  })
}

/* bootstrap rootledger seed accounts */

function bootstrpRootAccounts (n, accounts) {
  /**
   * Rootledger accounts structure & naming conventions:
   *
   * Each tenant has a set of accounts on the rootledger with the following pattern:
   * [tenantId]::[accountName]::[apendix]
   *
   * The standard accounts are:
   *
   * 0) Commission calculation account
   * [tenantId]::calc-[contractAccountNumber]
   *
   * 1) Entitlement (accounts receivable)
   * [tenantId]::entitlement::[Year]
   *
   * 2) Settlement (billing inbox)
   * [tenantId]::settlement::[Year]
   *
   * 3) Settlement Peer (invoice outbox, must be the commission settlement account of the provider.)
   * [tenantId]::peerSettlement
   *
   * 4) Bank account for earned commission (iban number must be available in strinstrorage)
   * [tenantId]::[iban]
   */

  let rootAccounts = [
    { tenantId: 'sevtest', type: 'account', name: 'calc-00000' },
    { tenantId: 'sevtest', type: 'account', name: 'settlement' }, // extid pattern [tenantId]::[type]::[name]::[discriminator]
    { tenantId: 'raketenstrom', type: 'account', name: 'entitlement' },
    { tenantId: 'raketenstrom', type: 'account', name: 'bank' },
    { tenantId: 'demo', type: 'account', name: 'entitlement' },
    { tenantId: 'demo', type: 'account', name: 'bank' }
  ]

  return rootAccounts.map(item => {
    let wallet = ethers.Wallet.createRandom()
    let account = Object.assign({}, item)

    account.extid = namespace(
      item.name,
      item.tenantId,
      item.name === 'settlement' || item.name === 'entitlement'
    )
    account.roleKey = hash(account.extid)
    account.privateKey = item.privateKey || wallet.privateKey
    account.address = item.privateKey ? item.address : wallet.address

    app.rootnode.ledger.accounts.push(account)

    return function () {
      return n.roleLookup().then(rl => {
        console.info(
          'rolelookup changeing relation',
          account.roleKey,
          ' of ',
          n.wallet.address,
          ' to ',
          account.address
        )
        return rl.setRelation(account.roleKey, account.address)
      })
    }
  })
}

/* bootstrap seed users */

function bootstrpSeedUsers (n, users) {
  /**
   * seed Users
   *
   * Each tenant has  at least one user, who created the tenant in the first place
   * At runtime the tenant user node can look up the addresses of required accounts
   * on the tenent ledger via rolelookup against the rootnode. For example:
   *  userNode.roleLookup().then(rl => {
   *    return rl.relations('0x2e687f3Ad1C82f12AD41411aCeAb874Cc3BB767F', hash('[myTenantId]::entitlement'))
   *  })
   * will return the address of the entitlement account of the user's tenant
   *
   * in a similar way the userNode would look up the address of the ledger
   * contract of his provider. (NOTE_to_self: the provider ledger address has to
   * be available via roleLookup against the user node to the rootnode at a standard location
   * for reseller-tenants / subtenants)
   *
   * the user can then look up for example his commission entitlement as calculated on the ledger of his provider:
   *  userNode.stromkonto([ledgerAddressFromProvider]).then(ledger => {
   *      return ledger.balancesHaben([myAccountAddress])
   *  })
   */
  let seedUsers = [
    {
      tenantId: 'sevtest',
      type: 'user',
      username: 'jochentest',
      password: 'test'
    },
    {
      tenantId: 'raketenstrom',
      type: 'user',
      username: 'rakete',
      password: 'start'
    },
    {
      tenantId: 'demo',
      type: 'user',
      username: 'demouser',
      password: 'demosecret'
    }
  ]
}

/* bootstrap seed ledgers */

function bootstrpSeedLedgers (users, overwriteExisting) {
  return users.map(user => {
    let uNode = new fury.Node({
      external_id: user.username,
      privateKey: user.privateKey || undefined,
      testMode: true
    })

    let ledger = {}

    return getRelation(uNode.wallet.address, 42, uNode)
      .then(lookedupAddress => {
        if (
          lookedupAddress !== '0x0000000000000000000000000000000000000000' &&
          !overwriteExisting
        ) {
          console.warn(
            ' a ledger is already registered @role 42: ',
            lookedupAddress
          )
          console.info(
            'Overwrite existing ===',
            overwriteExisting,
            ' => No new ledger created'
          )
          return lookedupAddress
        } else {
          return createLedger(uNode, overwriteExisting)
        }
      })
      .then(ledgerAddress => {
        ledger.tenantId = user.tenantId
        ledger.extid = namespace('ledger', user.tennantId)
        ledger.roleKey = 42
        ledger.address = ledgerAddress
        // should rootnode also have link to user ledgers ?
        return overwriteExisting
          ? setRelation(uNode, ledger.roleKey, ledger.address)
          : ''
      })
      .then(() => {
        console.log('created and wired up')

        /**
         * uNode creation is the opportunity to provide all the info needed
         * at runtime => think wisely of what needs to be prorived
         */

        let rootnodeAddress = app.admin.rootnode.address
        let providerId = user.provider.tennantId || app.rootnode.ledger.tenantId
        return getRelation(
          rootnodeAddress,
          hash(namespace('ledger', providerId)),
          uNode
        )
          .then(address => {
            return {
              rootnode: {
                appid: app.appid, // => hardcoded in app
                address: rootnodeAddress // => hardcoded in app
              },
              providerLedger: {
                tennantId: providerId, // => to be provided as prop within registration link
                address: address
              }
            }
          })
          .then(obj => {
            return Promise.all([
              setRelation(
                uNode,
                hash(
                  namespace('rootnode', obj.rootnode.appid),
                  obj.rootnode.address
                )
              ),
              setRelation(uNode, hash(namespace('providerLedger')))
            ])
          })
      })
  })
}

/* bootstrap functions */

/**
 * function createLedger
 *
 *  creates ledger with node, adds ledger address to role 42
 *
 */
function createLedger (n, overwriteExisting) {
  console.info('creating ledger for ', n.wallet.address)
  // return buildLedger(n) // => redundant
  return n
    .stromkontoproxyfactory()
    .then(skpf => {
      return skpf.build()
    })
    .then(ledgerAddress => {
      return setRelation(n, 42, ledgerAddress, overwriteExisting)
    })
    .catch(err => console.error(err))
}

function buildLedger (n) {
  return n
    .stromkontoproxyfactory()
    .then(skpf => {
      return skpf.build()
    })
    .catch(err => console.error(err))
}

/**
 * function createTenantAccount
 *
 *  creates creates a tenant node with user name and password
 *
 */
function createTenantAccount (tenantId, username, password) {
  let tenant = {}
  tenant.tenantId = tenantId
  tenant.username = username
  tenant.password = password

  let tAccount = new fury.Account(username, password)
  console.info('creating tenant: ', username)
  return tAccount
    .wallet()
    .then(wallet => {
      tenant.address = wallet.address
      tenant.privateKey = wallet.privateKey
      console.info(tenant)
    })
    .catch(err => console.error(err))
}

/**
 * function createTenantRelations
 *
 * builds tenant node from private key
 * builds tenant ledger for tenant node at role 42
 * stringstores tennantId
 * string stores povider id
 * sets provider node relation
 * sets provider ledger relation
 *
 */
function createTenantRelations (tenantId, privateKey) {
  let tNode = new fury.Node({ privateKey: privateKey, testMode: true })
  return createLedger(tNode, true)
    .then(() => {
      return setMyRootnodeAddress(tNode, app.rootnode.address)
    })
    .then(() => {
      return setMyTenantId(tNode, tenantId)
    })
    .then(() => {
      return setMyProviderId(tNode, app.rootnode.tenantId)
    })
    .then(() => {
      return setMyProviderAddress(tNode, app.rootnode.address)
    })
    .then(() => {
      return setMyProviderLedgerAddress(tNode, app.rootnode.address)
    })
    .catch(err => console.error(err))
}

/**
 * function setMyRootnodeAddress
 *
 * sets rootnode address in the rolelookup of a given node
 *
 */
function setMyRootnodeAddress (n, rootnodeAddress) {
  console.info('setMyRootnodeAddress')
  let theRootnodeAddress = rootnodeAddress || app.rootnode.address // required hard coded in app
  return setRelation(n, hash('rootnode::address'), theRootnodeAddress, true)
}

/**
 * function setMyTenantId
 *
 * string stores the tennantId with the rolelookup for a given node
 *
 */
function setMyTenantId (n, myTenantId) {
  console.info('setMyTenantId')
  let tenantId = myTenantId // required as prop at signup
  return writeRelationString(n, hash('tenantId'), tenantId)
}

/**
 * function setMyProviderId
 *
 * string stores the tennantId ofthe provider with the rolelookup for a given
 * node
 *
 */
function setMyProviderId (n, myProviderId) {
  console.info('setMyProviderId')
  let providerTenantId = myProviderId // required as prop at signup
  return writeRelationString(n, hash('provider::tenantId'), providerTenantId)
}

/**
 * function setMyRootnodeAddress
 *
 * sets provider node address in the rolelookup of a given node
 * will be the address of the node that issued the invitation link
 *
 */
function setMyProviderAddress (n, providerAddress) {
  console.info('setMyProviderAddress')
  let myProviderAddress = providerAddress // required as prop at signup
  return setRelation(n, hash('provider::address'), myProviderAddress, true)
}

/**
 * function setMyProviderLedgerAddress
 *
 * sets provider ledger address in the rolelookup of a given node
 * (this is optional might not be required)
 *
 */
function setMyProviderLedgerAddress (n, providerAddress) {
  console.info('setMyProviderLedgerAddress')
  return getRelation(providerAddress, 42, n)
    .then(providerLedgerAddress => {
      return setRelation(
        n,
        hash('provider::ledgerAddress'),
        providerLedgerAddress,
        true
      )
    })
    .catch(err => console.error(err))
}

/* Actions */

function registerAccount (node, obj) {
  obj = obj || {
    tenantId: '?',
    address: '0x0000',
    type: 'account' || 'ledger' || 'user'
  }

  let rolekey
  let extid

  if (obj.type === 'ledger') {
    extid = namespace(obj.type, obj.tenantId)
    rolekey = hash(extid)
  }

  if (obj.type === 'account' && typeof obj.name === 'string') {
    extid = namespace(obj.type + '::' + obj.name, obj.tenantId)
    rolekey = hash(extid)
  }

  if (obj.type === 'user' && typeof obj.username === 'string') {
    extid = namespace(obj.type + '::' + obj.username, obj.tenantId)
    rolekey = hash(extid)
  }
  return setRelation(node, rolekey, obj.address, true)
}

function checkAccounts (s) {
  getRelation(node.wallet.address, 42).then(res => {
    console.log(
      res,
      ' == ',
      s.admin.ledger.address,
      ' ',
      res === s.admin.ledger.address
    )
  })
  getRelation(s.admin.user.address, 42).then(res => {
    console.log(
      res,
      ' == ',
      s.admin.ledger.address,
      ' ',
      res === s.admin.ledger.address
    )
  })
}

function getRelation (address, key, n) {
  // (0x0000, 93401849032184, => 0x000
  if (!n) n = node
  return n
    .roleLookup()
    .then(rl => {
      return rl.relations(address, key)
    })
    .then(res => {
      console.info(
        'roleLookup: role ',
        key,
        ' of ',
        address,
        ' points to ',
        res
      )
      return res
    })
    .catch(err => console.error(err))
}

function setRelation (n, key, toAddress, overwriteExisting) {
  let overwrite = overwriteExisting === true
  return n
    .roleLookup()
    .then(rl => {
      return rl.relations(n.wallet.address, key)
    })
    .then(lookedupAddress => {
      if (lookedupAddress !== '0x0000000000000000000000000000000000000000') {
        console.warn(
          'Role lookup relation at register ',
          key,
          'already exists: ',
          lookedupAddress
        )
        console.warn('overwriteExisting  = ', overwrite)
      }
      console.info(
        'setting role',
        key,
        ' of ',
        n.wallet.address,
        ' to ',
        overwrite ? toAddress : lookedupAddress
      )
      if (overwrite === true) {
        return n.roleLookup().then(rl => {
          return rl.setRelation(key, toAddress)
        })
      } else {
        return lookedupAddress
      }
    })
    .catch(err => console.error(err))
}

function readRelationString (address, key, n) {
  if (!n) n = node
  return getRelation(address, key, n)
    .then(strgStoreAddress => {
      return n.stringstrorage(strgStoreAddress)
    })
    .then(strgStore => {
      return strgStore.str()
    })
}

function writeRelationString (n, key, string) {
  return n.stringstoragefactory().then(ssf => {
    console.log('stringStore relation at role', key, 'string: ', string)
    return ssf.buildAndAssign(key, string)
  })
}

function addSenderToLedger (n, senderAddress, ledgerAddress) {
  return n
    .stromkontoproxy(ledgerAddress)
    .then(ledger => {
      return ledger.modifySender(senderAddress, true)
    })
    .then(tx => {
      console.info(
        'added address ',
        senderAddress,
        ' as sender to ledger ',
        ledgerAddress
      )
      return ledgerAddress
    })
    .catch(err => console.error(err, 'something is wrong'))
}

function namespace (strg, tenantId, appendYear) {
  // let app = app.appId ? app.appId + '::' : ''
  let tenant = tenantId ? tenantId + '::' : ''
  let year = appendYear ? '::' + new Date().getFullYear() : ''

  return tenant + strg + year
}

function hash (strg) {
  return Math.abs(djb(strg))
}

/* Data */

function fetchRemoteNodeAddress (extid, secret) {
  return request({
    uri: app.apiHost + '/auth/' + extid + '/' + secret,
    json: true
  })
}

function appendYear (str) {
  return str === 'billing' || str === 'entitlement'
}

/**
 * serialPromise executes Promises sequentially.
 * @param {funcs} An array of functions (funcs) that each return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 *
 * via https://stackoverflow.com/questions/24586110
 */
// const serialPromise = funcs =>
//     funcs.reduce((promise, func) =>
//         promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]))

function serialPromise (funcs) {
  return funcs.reduce((promise, func) => {
    return promise.then(result => {
      return func().then(Array.prototype.concat.bind(result))
    })
  }, Promise.resolve([]))
}
