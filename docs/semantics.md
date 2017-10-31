## Rootnode and CSV Parsing

The app rootnode runs automatically on a webserver. It is the client wallet that performs sales partner entitlement calculations on behalf of the root tenant. 

### Rootnode instantiation

Rootnotes are be instanciated via a private key to ensure compatiblity across different runtime environments:

```js
const fury = require('stromdao-businessobject')

const node = new fury.Node({
  external_id: 'app-rootnode',
  privateKey: process.env.THEKEY,
  testMode: true,
  rpc: 'https://fury.network/rpc',
  abilocation: 'https://unpkg.com/stromdao-businessobject/smart_contracts/'
})
```

Note: Use Environment variables to  [keep your secrets secret](https://medium.com/ibm-watson-data-lab/environment-variables-or-keeping-your-secrets-secret-in-a-node-js-app-99019dfff716) in a Node.js app

### The data set

The app will iterate through the data set, an array of contract records. The data set is derived from an external csv file on a daily basis. [_**TODO**: The csv import and parsing has still to be implemented_.]

Each contract records contains information on a specific customer energy delivery contract account. The most important record attributes are:

```js
  salesPartner.uuid, // the sales partner ID
  salesPartner.rate  // the rates to calculate sales partner commission entitlement for the record / contract at hand
  contractAccount.uuid // a unique identifier for each individual record / contract
  meterpoint // information that identifies the customers meterpoint
  startDate // JavaScript Data Object specifiying the contract effective date
  startReading // Thr initial meter reading object. Usually performed done at the contract effective date.
  endDate // JavaScript Data Object specifiying the contract termination date, if not specified the value should be 9999-12-31T23:59:59 or undefined
  endReading // Meter reading object for the terminated contracts
  invoicingPeriod // specifies duration of a invoicing period in days. Should default to 365
  consumptionEstimate // estimated consumption during invoicing period in watthours
  currentRading // Meter reading object of the latest available meter reading
```

### Data formating rules

Data set records are plain JavaScript Objects. The following objects require specific attributes and formating:

#### meterpoint
A `meterpoint.number` is required. An optional `meterpoint.address` attribute allows to retrieve the latest meterpoint reading information at runtime in order to perform entitlement calculation on the most up to date information.

```js
/* meterpoint formarting example */
meterpoint: {
    number: '39110300981', // required
    address: '0xEAA8789b2f942d66A880731ffFD24f56E87Cf809',  // optional
    }
```

#### meterpoint readings

A meterpoint reading object provides (1) a `reading.time` timestamp in milliseconds and (2) the actual `reading.value` as an integer in watthours. (3) It also specifies a `reading.multiplier` value to handle sub-watthour micro-transactions. (4) The `reading.unit` is also specified in order to support readings in Kilo- or Megawatthours where appropiate. 
```js
/* reading object formating example */
let reading: {
  time: new Date('2017-08-25T12:27:22').getTime(),
  value: 415,
  unit: 'watthours',
  multiplier: 1
}
```
If possible `muliplier` and `unit` porperties should be made consistent end-to-end throuout the entire application.
