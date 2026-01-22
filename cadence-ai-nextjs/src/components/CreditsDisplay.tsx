'use client'

import { useState, useEffect } from 'react'
import { Coins, Wallet, Link2, ExternalLink, Loader2, X } from 'lucide-react'

interface CreditsDisplayProps {
    compact?: boolean
}

export default function CreditsDisplay({ compact = false }: CreditsDisplayProps) {
    const [balance, setBalance] = useState<number | null>(null)
    const [isLinked, setIsLinked] = useState(false)
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showLinkModal, setShowLinkModal] = useState(false)
    const [linkWalletInput, setLinkWalletInput] = useState('')
    const [isLinking, setIsLinking] = useState(false)
    const [linkError, setLinkError] = useState<string | null>(null)

    useEffect(() => {
        fetchBalance()
    }, [])

    const fetchBalance = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/credits/balance')
            if (res.ok) {
                const data = await res.json()
                setBalance(data.balance)
                setIsLinked(data.isLinked)
                setWalletAddress(data.walletAddress)
            }
        } catch (err) {
            console.error('Failed to fetch credits balance:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLinkWallet = async () => {
        if (!linkWalletInput.trim()) {
            setLinkError('Please enter a wallet address')
            return
        }

        // Validate format
        if (!/^0x[a-fA-F0-9]{40}$/.test(linkWalletInput.trim())) {
            setLinkError('Invalid wallet address format')
            return
        }

        setIsLinking(true)
        setLinkError(null)

        try {
            const res = await fetch('/api/credits/link-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: linkWalletInput.trim()
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setBalance(data.balance)
                setIsLinked(true)
                setWalletAddress(data.walletAddress)
                setShowLinkModal(false)
                setLinkWalletInput('')
            } else {
                setLinkError(data.error || 'Failed to link wallet')
            }
        } catch (err) {
            setLinkError('Failed to link wallet')
        } finally {
            setIsLinking(false)
        }
    }

    const handleUnlinkWallet = async () => {
        try {
            const res = await fetch('/api/credits/link-wallet', {
                method: 'DELETE'
            })

            if (res.ok) {
                setBalance(0)
                setIsLinked(false)
                setWalletAddress(null)
            }
        } catch (err) {
            console.error('Failed to unlink wallet:', err)
        }
    }

    const formatBalance = (amount: number) => {
        if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
        if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`
        return amount.toLocaleString()
    }

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--foreground-muted)]" />
            </div>
        )
    }

    // Compact version for header
    if (compact) {
        if (!isLinked) {
            return (
                <button
                    onClick={() => setShowLinkModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-sm"
                >
                    <Wallet className="w-4 h-4" />
                    Link Wallet
                </button>
            )
        }

        return (
            <>
                <button
                    onClick={() => setShowLinkModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                >
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-white font-medium">{formatBalance(balance || 0)}</span>
                    <span className="text-[var(--foreground-muted)] text-sm">cr</span>
                </button>

                {/* Link Modal */}
                {showLinkModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] w-full max-w-md">
                            <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
                                <h3 className="text-lg font-medium text-white">SUITE Credits</h3>
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    className="text-[var(--foreground-muted)] hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
                                    <div>
                                        <p className="text-sm text-[var(--foreground-muted)]">Current Balance</p>
                                        <p className="text-2xl font-bold text-white">
                                            {formatBalance(balance || 0)} <span className="text-sm text-[var(--foreground-muted)]">credits</span>
                                        </p>
                                    </div>
                                    <Coins className="w-8 h-8 text-yellow-400" />
                                </div>

                                {walletAddress && (
                                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Link2 className="w-4 h-4 text-green-400" />
                                            <span className="text-green-300 text-sm">{truncateAddress(walletAddress)}</span>
                                        </div>
                                        <button
                                            onClick={handleUnlinkWallet}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            Unlink
                                        </button>
                                    </div>
                                )}

                                <a
                                    href="https://getsuite.app/profile"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                                >
                                    Buy More Credits
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    // Full version (for settings page or dedicated section)
    return (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6">
            <div className="flex items-center gap-2 mb-4">
                <Coins className="w-5 h-5 text-yellow-400" />
                <h2 className="font-medium text-white">SUITE Credits</h2>
            </div>

            {!isLinked ? (
                <div className="space-y-4">
                    <p className="text-[var(--foreground-muted)] text-sm">
                        Link your SUITE wallet to use credits for AI features.
                    </p>

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={linkWalletInput}
                            onChange={(e) => setLinkWalletInput(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)]"
                        />

                        {linkError && (
                            <p className="text-red-400 text-sm">{linkError}</p>
                        )}

                        <button
                            onClick={handleLinkWallet}
                            disabled={isLinking}
                            className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isLinking ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Wallet className="w-4 h-4" />
                            )}
                            Link Wallet
                        </button>
                    </div>

                    <p className="text-xs text-[var(--foreground-muted)]">
                        Don't have credits?{' '}
                        <a href="https://getsuite.app/profile" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                            Get them here
                        </a>
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
                        <div>
                            <p className="text-sm text-[var(--foreground-muted)]">Balance</p>
                            <p className="text-3xl font-bold text-white">{formatBalance(balance || 0)}</p>
                        </div>
                        <Coins className="w-10 h-10 text-yellow-400" />
                    </div>

                    {walletAddress && (
                        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-green-400" />
                                <span className="text-green-300">{truncateAddress(walletAddress)}</span>
                            </div>
                            <button
                                onClick={handleUnlinkWallet}
                                className="text-sm text-red-400 hover:text-red-300"
                            >
                                Unlink
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <a
                            href="https://getsuite.app/profile"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm"
                        >
                            Buy Credits
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            onClick={fetchBalance}
                            className="py-2 bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] rounded-lg transition-colors text-sm"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
