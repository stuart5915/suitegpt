'use client'

import { useState } from 'react'
import { Wallet, Link2, ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react'

interface WalletConnectProps {
    onSuccess?: (walletAddress: string) => void
}

export default function WalletConnect({ onSuccess }: WalletConnectProps) {
    const [walletAddress, setWalletAddress] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleConnect = async () => {
        if (!walletAddress.trim()) {
            setError('Please enter your wallet address')
            return
        }

        // Validate format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
            setError('Invalid wallet address format')
            return
        }

        setIsConnecting(true)
        setError(null)

        try {
            const res = await fetch('/api/credits/link-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: walletAddress.trim()
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
                onSuccess?.(walletAddress.trim())
            } else {
                setError(data.error || 'Failed to link wallet')
            }
        } catch (err) {
            setError('Failed to connect wallet')
        } finally {
            setIsConnecting(false)
        }
    }

    // Try MetaMask connection
    const handleMetaMaskConnect = async () => {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            setError('MetaMask not detected. Please enter your wallet address manually.')
            return
        }

        setIsConnecting(true)
        setError(null)

        try {
            const ethereum = (window as any).ethereum
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' })

            if (accounts && accounts.length > 0) {
                const address = accounts[0]
                setWalletAddress(address)

                // Auto-link the wallet
                const res = await fetch('/api/credits/link-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: address
                    })
                })

                const data = await res.json()

                if (res.ok && data.success) {
                    setSuccess(true)
                    onSuccess?.(address)
                } else {
                    setError(data.error || 'Failed to link wallet')
                }
            }
        } catch (err: any) {
            if (err.code === 4001) {
                setError('Connection rejected. Please try again.')
            } else {
                setError('Failed to connect MetaMask')
            }
        } finally {
            setIsConnecting(false)
        }
    }

    if (success) {
        return (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Wallet Connected!</h3>
                <p className="text-[var(--foreground-muted)] text-sm">
                    Your SUITE credits are now linked to Cadence AI
                </p>
            </div>
        )
    }

    return (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="font-medium text-white">Connect Wallet</h2>
                    <p className="text-sm text-[var(--foreground-muted)]">Link your SUITE wallet for credits</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* MetaMask Button */}
                <button
                    onClick={handleMetaMaskConnect}
                    disabled={isConnecting}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                    {isConnecting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <img
                                src="https://metamask.io/images/metamask-fox.svg"
                                alt="MetaMask"
                                className="w-5 h-5"
                            />
                            Connect MetaMask
                        </>
                    )}
                </button>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[var(--surface-border)]" />
                    <span className="text-sm text-[var(--foreground-muted)]">or</span>
                    <div className="flex-1 h-px bg-[var(--surface-border)]" />
                </div>

                {/* Manual Entry */}
                <div>
                    <label className="text-sm text-[var(--foreground-muted)] mb-2 block">
                        Wallet Address
                    </label>
                    <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)]"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm">{error}</span>
                    </div>
                )}

                <button
                    onClick={handleConnect}
                    disabled={isConnecting || !walletAddress.trim()}
                    className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConnecting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Link2 className="w-5 h-5" />
                            Link Wallet
                        </>
                    )}
                </button>

                <p className="text-xs text-[var(--foreground-muted)] text-center">
                    Need credits?{' '}
                    <a
                        href="https://getsuite.app/profile"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:underline inline-flex items-center gap-1"
                    >
                        Buy on SUITE <ExternalLink className="w-3 h-3" />
                    </a>
                </p>
            </div>
        </div>
    )
}
