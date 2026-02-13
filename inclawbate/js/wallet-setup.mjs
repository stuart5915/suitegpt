import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { base } from '@reown/appkit/networks'

const PROJECT_ID = '1f27a8adc4ae5f8152754088e5a9c1c9'

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [base],
  defaultNetwork: base,
  projectId: PROJECT_ID,
  metadata: {
    name: 'Inclawbate UBI',
    description: 'Stake CLAWNCH to earn passive UBI from the agent economy',
    url: 'https://inclawbate.com',
    icons: []
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#6ba297'
  },
  features: {
    analytics: false
  }
})

let _provider = null
let _address = null
let _connected = false
const _onConnect = []
const _onDisconnect = []

appKit.subscribeProvider(state => {
  _provider = state.provider || null

  const wasConnected = _connected
  _connected = !!state.isConnected
  const newAddr = state.address || null

  if (_connected && newAddr && !wasConnected) {
    _address = newAddr
    _onConnect.forEach(cb => { try { cb(_address) } catch (e) { console.error('WalletKit onConnect error:', e) } })
  } else if (!_connected && wasConnected) {
    _address = null
    _onDisconnect.forEach(cb => { try { cb() } catch (e) { console.error('WalletKit onDisconnect error:', e) } })
  } else if (_connected && newAddr) {
    _address = newAddr
  }
})

window.WalletKit = {
  open() { return appKit.open() },
  disconnect() { return appKit.disconnect() },
  getProvider() { return _provider },
  getAddress() { return _address || appKit.getAddress() },
  isConnected() { return _connected || appKit.getIsConnected() },
  onConnect(cb) { _onConnect.push(cb) },
  onDisconnect(cb) { _onDisconnect.push(cb) }
}
