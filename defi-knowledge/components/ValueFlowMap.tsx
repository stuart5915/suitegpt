// DeFi Command Center Component
// Interactive diagram showing DeFi value flow with step-by-step network selection
// Flow: Bank → CEX → Wallet → Choose Network → DeFi Activities
// Now with REAL wallet connection via WalletConnect!

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Dimensions,
    Modal,
    Pressable,
    Platform,
    StatusBar,
    ActivityIndicator,
    Alert,
    Linking,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useWalletStore, shortenAddress as shortenAddressLib, SUPPORTED_CHAINS } from '@/lib/wallet';
import { useWalletConnect } from '@/context/WalletConnectContext';
import SwapInterface from '@/components/SwapInterface';
import LendingInterface from '@/components/LendingInterface';
import WalletModal from '@/components/WalletModal';
import YieldsPanel, { YieldsFloatingButton } from '@/components/YieldsPanel';
import {
    NFTsScreen,
    RWAScreen,
    GovernanceScreen,
    DeFiPositionsScreen,
    CrossChainScreen,
    AirdropsScreen,
} from '@/components/ExploreCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24;

// Network configurations (L1s and L2s together)
interface NetworkConfig {
    id: string;
    name: string;
    emoji: string;
    color: string;
    type: 'L1' | 'L2';
    parent?: string; // For L2s, which L1 they're built on
    description: string;
    fees: string;
}

const NETWORKS: NetworkConfig[] = [
    // L1s (post-Dencun/Pectra - fees dropped 95%+ by 2026)
    { id: 'ethereum', name: 'Ethereum', emoji: '🔷', color: '#627EEA', type: 'L1', description: 'Most DeFi, highest security', fees: '$0.20-0.40' },
    { id: 'solana', name: 'Solana', emoji: '☀️', color: '#9945FF', type: 'L1', description: 'Fast & cheap', fees: '<$0.01' },
    { id: 'avalanche', name: 'Avalanche', emoji: '🔺', color: '#E84142', type: 'L1', description: 'Fast finality', fees: '$0.05' },
    { id: 'flare', name: 'Flare', emoji: '🔥', color: '#E62058', type: 'L1', description: 'Data for DeFi, oracles native', fees: '<$0.01' },
    // L2s & Sidechains (extremely cheap)
    { id: 'polygon', name: 'Polygon', emoji: '🟣', color: '#8247E5', type: 'L2', parent: 'ethereum', description: 'Sidechain, low fees', fees: '<$0.01' },
    { id: 'base', name: 'Base', emoji: '🔵', color: '#0052FF', type: 'L2', parent: 'ethereum', description: 'By Coinbase, beginner-friendly', fees: '<$0.01' },
    { id: 'arbitrum', name: 'Arbitrum', emoji: '🔶', color: '#28A0F0', type: 'L2', parent: 'ethereum', description: 'Most TVL, low fees', fees: '<$0.01' },
    { id: 'optimism', name: 'Optimism', emoji: '🔴', color: '#FF0420', type: 'L2', parent: 'ethereum', description: 'OP Stack pioneer', fees: '<$0.05' },
];

// Protocol configurations
interface ProtocolConfig {
    id: string;
    name: string;
    emoji: string;
    color: string;
    category: 'lending' | 'swapping' | 'staking' | 'bridge';
    description: string;
    tvl?: string;
    networks: string[];
}

const PROTOCOLS: ProtocolConfig[] = [
    // Lending
    { id: 'aave', name: 'Aave', emoji: '👻', color: '#B6509E', category: 'lending', description: 'Deposit to earn, borrow against collateral', tvl: '$12B', networks: ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'base'] },
    { id: 'compound', name: 'Compound', emoji: '🟢', color: '#00D395', category: 'lending', description: 'OG lending protocol', tvl: '$2B', networks: ['ethereum', 'base', 'arbitrum'] },
    { id: 'kinetic', name: 'Kinetic', emoji: '⚡', color: '#E62058', category: 'lending', description: 'Flare native lending & borrowing', tvl: '$50M', networks: ['flare'] },
    // Swapping
    { id: 'uniswap', name: 'Uniswap', emoji: '🦄', color: '#FF007A', category: 'swapping', description: 'Swap any token instantly', tvl: '$5B', networks: ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'base'] },
    { id: 'jupiter', name: 'Jupiter', emoji: '🪐', color: '#C7F284', category: 'swapping', description: 'Best Solana aggregator', networks: ['solana'] },
    { id: '1inch', name: '1inch', emoji: '🔀', color: '#1B314F', category: 'swapping', description: 'DEX aggregator, best rates', networks: ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'base'] },
    { id: 'sparkdex', name: 'SparkDEX', emoji: '✨', color: '#FFD700', category: 'swapping', description: 'Flare native DEX with LP rewards', tvl: '$30M', networks: ['flare'] },
    // Staking
    { id: 'lido', name: 'Lido', emoji: '🌊', color: '#00A3FF', category: 'staking', description: 'Liquid staking, earn while using DeFi', tvl: '$25B', networks: ['ethereum', 'polygon', 'solana'] },
    { id: 'rocketpool', name: 'Rocket Pool', emoji: '🚀', color: '#FF7043', category: 'staking', description: 'Decentralized staking', tvl: '$3B', networks: ['ethereum'] },
    // Bridge
    { id: 'stargate', name: 'Stargate', emoji: '🌉', color: '#8B5CF6', category: 'bridge', description: 'Bridge assets cross-chain', networks: ['ethereum', 'arbitrum', 'optimism', 'base', 'avalanche', 'polygon', 'flare'] },
];

// TradFi nodes
interface TradFiNode {
    id: string;
    label: string;
    emoji: string;
    description: string;
    details: string;
    examples: string[];
    color: string;
}

const TRADFI_NODES: TradFiNode[] = [
    { id: 'bank', label: 'Your Bank', emoji: '🏦', description: 'Traditional Bank', details: 'Your starting point. Wire money or use debit to buy crypto.', examples: ['Chase', 'Wells Fargo', 'Bank of America'], color: '#4A5568' },
    { id: 'cex', label: 'CEX', emoji: '📱', description: 'Centralized Exchange', details: 'Buy crypto with fiat. They custody your funds.', examples: ['Coinbase', 'Kraken', 'Gemini'], color: '#3182CE' },
    { id: 'wallet', label: 'Your Wallet', emoji: '👛', description: 'Self-Custody', details: 'Your keys, your crypto. Choose a network to explore DeFi.', examples: ['MetaMask', 'Rainbow', 'Phantom'], color: '#805AD5' },
];

// DeFi activity categories
const DEFI_CATEGORIES = [
    { id: 'swapping', label: 'Swap', emoji: '🔄', description: 'Exchange tokens', color: '#FC8181' },
    { id: 'lending', label: 'Lend', emoji: '🏛️', description: 'Earn interest', color: '#B794F4' },
    { id: 'staking', label: 'Stake', emoji: '💎', description: 'Earn rewards', color: '#48BB78' },
    { id: 'bridge', label: 'Bridge', emoji: '🌉', description: 'Move cross-chain', color: '#8B5CF6' },
];

interface Props {
    onClose?: () => void;
}

type FlowStep = 'onramp' | 'network' | 'defi';

export default function ValueFlowMap({ onClose }: Props) {
    const [currentStep, setCurrentStep] = useState<FlowStep>('onramp');
    const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [selectedProtocol, setSelectedProtocol] = useState<ProtocolConfig | null>(null);
    const [showNodeInfo, setShowNodeInfo] = useState(false);
    const [selectedNode, setSelectedNode] = useState<TradFiNode | null>(null);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [showLendingModal, setShowLendingModal] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);

    // Wallet card expand/collapse state - collapses after connection
    const [walletExpanded, setWalletExpanded] = useState(true);

    // Network picker state
    const [showNetworkPicker, setShowNetworkPicker] = useState(false);
    const [pickerStep, setPickerStep] = useState<'type' | 'networks'>('type');
    const [selectedNetworkType, setSelectedNetworkType] = useState<'L1' | 'L2' | null>(null);

    // Yields panel state
    const [showYieldsPanel, setShowYieldsPanel] = useState(false);

    // Explore More expandable section state
    const [showExploreMore, setShowExploreMore] = useState(false);
    const [activeExploreCategory, setActiveExploreCategory] = useState<string | null>(null);

    // Ref for auto-scrolling to swap panel
    const scrollViewRef = useRef<ScrollView>(null);

    // Router for navigation to Learn tab
    const router = useRouter();

    // Handle navigation to Learn tab with specific topic
    const handleNavigateToLearn = (topic: string) => {
        setActiveExploreCategory(null); // Close the modal first
        // Navigate to Learn tab - could pass topic as param for deep linking later
        router.push('/(app)/(tabs)/learn');
    };

    // Real WalletConnect integration
    const {
        address: wcAddress,
        isConnected: wcConnected,
        isConnecting,
        connect: wcConnect,
        disconnect: wcDisconnect,
    } = useWalletConnect();

    // Wallet store for balances
    const {
        balances,
        isLoadingBalances,
        fetchBalances,
        setChainId,
        connectWallet: storeConnect,
    } = useWalletStore();

    // Sync WalletConnect state to wallet store
    useEffect(() => {
        if (wcConnected && wcAddress) {
            storeConnect(wcAddress, 1); // Sync to store with chain 1
        }
    }, [wcConnected, wcAddress]);

    // Use WalletConnect state as source of truth
    const isConnected = wcConnected;
    const address = wcAddress;

    // Fetch balances when wallet connects or network changes
    useEffect(() => {
        if (isConnected && selectedNetwork) {
            const chain = Object.values(SUPPORTED_CHAINS).find(c =>
                c.name.toLowerCase() === selectedNetwork.id.toLowerCase()
            );
            if (chain) {
                setChainId(chain.chainId);
                fetchBalances();
            }
        }
    }, [isConnected, selectedNetwork]);

    // Auto-collapse wallet card when connection is established
    useEffect(() => {
        if (isConnected) {
            // Delay collapse slightly so user sees the connected state
            const timer = setTimeout(() => {
                setWalletExpanded(false);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            // Expand when disconnected so user can see connect button
            setWalletExpanded(true);
        }
    }, [isConnected]);

    // Handle wallet connection - use WalletConnect SDK
    const handleConnectWallet = () => {
        console.log('🔌 Triggering WalletConnect connection...');
        wcConnect(); // This will open the WalletConnect QR modal or deep link to MetaMask
    };

    // Handle manual address connection
    const handleManualConnect = (address: string) => {
        console.log('🔌 Manual connect with address:', address);
        storeConnect(address, 1);
        setShowWalletModal(false);
        // Auto-select default network and go straight to DeFi actions
        if (!selectedNetwork) {
            setSelectedNetwork(NETWORKS[0]); // Default to Ethereum
        }
        setCurrentStep('defi');
    };

    // Auto-advance when connected - skip network selection, go straight to DeFi
    useEffect(() => {
        if (isConnected && currentStep === 'onramp') {
            // Auto-select default network if none selected
            if (!selectedNetwork) {
                setSelectedNetwork(NETWORKS[0]); // Default to Ethereum
            }
            setCurrentStep('defi');
        }
    }, [isConnected]);

    const handleDisconnectWallet = () => {
        Alert.alert(
            'Disconnect Wallet',
            'Are you sure you want to disconnect?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect', style: 'destructive', onPress: async () => {
                        await wcDisconnect();
                        setCurrentStep('onramp');
                        setSelectedNetwork(null);
                    }
                },
            ]
        );
    };

    const handleTradFiPress = (node: TradFiNode) => {
        if (node.id === 'wallet') {
            // Wallet node just shows info, network is changed via inline dropdown
            return;
        } else {
            setSelectedNode(node);
            setShowNodeInfo(true);
        }
    };

    const handleNetworkSelect = (network: NetworkConfig) => {
        setSelectedNetwork(network);
        setCurrentStep('defi');
        setExpandedCategory(null);
        setSelectedProtocol(null);
    };

    // Network switching now happens via inline dropdown in wallet card

    const handleSwitchNetwork = () => {
        setShowNetworkPicker(!showNetworkPicker);
        if (!showNetworkPicker) {
            // Reset to first step when opening
            setPickerStep('type');
            setSelectedNetworkType(null);
        }
    };

    const handleNetworkTypeSelect = (type: 'L1' | 'L2') => {
        setSelectedNetworkType(type);
        setPickerStep('networks');
    };

    const handleNetworkPickerBack = () => {
        setPickerStep('type');
        setSelectedNetworkType(null);
    };

    const handleNetworkPickerSelect = (network: NetworkConfig) => {
        setSelectedNetwork(network);
        setShowNetworkPicker(false);
        setPickerStep('type');
        setSelectedNetworkType(null);
        setExpandedCategory(null);
        setSelectedProtocol(null);
        setWalletExpanded(false); // Collapse wallet after selecting network
    };

    const handleCategoryPress = (categoryId: string) => {
        if (expandedCategory === categoryId) {
            setExpandedCategory(null);
            setSelectedProtocol(null);
        } else {
            setExpandedCategory(categoryId);
            setSelectedProtocol(null);
            setShowOtherCategories(false); // Close the other menu when switching
        }
    };

    // State for collapsible "Other DeFi" menu
    const [showOtherCategories, setShowOtherCategories] = useState(false);



    const handleProtocolPress = (protocol: ProtocolConfig) => {
        // Just select the protocol - inline UI will render based on category
        setSelectedProtocol(protocol);

        // Auto-scroll down to show the swap interface
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleBackToProtocols = () => {
        setSelectedProtocol(null);
    };

    const closeNodeInfo = () => {
        setShowNodeInfo(false);
        setSelectedNode(null);
    };

    const getProtocolsForCategory = (categoryId: string): ProtocolConfig[] => {
        if (!selectedNetwork) return [];
        return PROTOCOLS.filter(p => p.category === categoryId && p.networks.includes(selectedNetwork.id));
    };

    // Get primary balance for display based on selected network
    const getPrimaryBalance = () => {
        // Get native token symbol for the selected network
        const nativeSymbol = selectedNetwork?.id === 'polygon' ? 'POL' : 'ETH';
        const nativeBalance = balances.find(b => b.token.symbol === nativeSymbol);
        return {
            balance: nativeBalance?.formattedBalance || '0.00',
            symbol: nativeSymbol,
        };
    };

    const renderTradFiNode = (node: TradFiNode, index: number) => {
        const isWallet = node.id === 'wallet';
        const isCompleted = currentStep !== 'onramp' && index < TRADFI_NODES.length;

        // Special rendering for wallet node
        if (isWallet) {
            return (
                <View key={node.id} style={styles.tradfiNodeWrapper}>
                    {/* Connected - Collapsible Card */}
                    {isConnected ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setWalletExpanded(!walletExpanded)}
                            style={[
                                styles.tradfiNode,
                                styles.walletNodeExpanded,
                                { borderColor: Colors.success, backgroundColor: Colors.success + '08' },
                            ]}
                        >
                            {/* Collapsed View - Compact one-line summary */}
                            {!walletExpanded ? (
                                <View style={styles.walletCollapsedRow}>
                                    <Text style={styles.tradfiEmoji}>{node.emoji}</Text>
                                    <View style={styles.walletCollapsedInfo}>
                                        <Text style={styles.walletCollapsedAddress}>{shortenAddressLib(address!)}</Text>
                                        <Text style={styles.walletCollapsedBalance}>
                                            {isLoadingBalances ? '...' : `${getPrimaryBalance().balance} ${getPrimaryBalance().symbol}`}
                                        </Text>
                                    </View>
                                    {selectedNetwork && (
                                        <View style={[styles.walletCollapsedNetwork, { backgroundColor: selectedNetwork.color + '20' }]}>
                                            <Text style={{ fontSize: 12 }}>{selectedNetwork.emoji}</Text>
                                        </View>
                                    )}
                                    <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
                                </View>
                            ) : (
                                /* Expanded View - Full controls */
                                <>
                                    <View style={styles.walletNodeTop}>
                                        <Text style={styles.tradfiEmoji}>{node.emoji}</Text>
                                        <View style={styles.tradfiContent}>
                                            <Text style={styles.tradfiLabel}>Connected</Text>
                                            <Text style={styles.tradfiDesc}>{shortenAddressLib(address!)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <TouchableOpacity onPress={handleDisconnectWallet} style={styles.disconnectBtn}>
                                                <Ionicons name="log-out-outline" size={18} color={Colors.error} />
                                            </TouchableOpacity>
                                            <Ionicons name="chevron-up" size={18} color={Colors.textMuted} />
                                        </View>
                                    </View>

                                    <View style={styles.walletConnectedSection}>
                                        {/* Balance Row */}
                                        <View style={styles.balanceRow}>
                                            <Text style={styles.balanceLabel}>Balance:</Text>
                                            <View style={styles.balanceRight}>
                                                {isLoadingBalances ? (
                                                    <ActivityIndicator size="small" color={Colors.primary} />
                                                ) : (
                                                    <>
                                                        <Text style={styles.balanceValue}>{getPrimaryBalance().balance} {getPrimaryBalance().symbol}</Text>
                                                        <TouchableOpacity onPress={fetchBalances} style={styles.refreshBtn}>
                                                            <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        </View>

                                        {/* Network Row - shows selected network with inline dropdown */}
                                        <View style={styles.networkRow}>
                                            <Text style={styles.networkLabel}>Network:</Text>
                                            {selectedNetwork ? (
                                                <TouchableOpacity style={styles.networkSelectedBtn} onPress={handleSwitchNetwork}>
                                                    <Text style={[styles.networkSelectedName, { color: selectedNetwork.color }]}>
                                                        {selectedNetwork.emoji} {selectedNetwork.name}
                                                    </Text>
                                                    <Ionicons name={showNetworkPicker ? "chevron-up" : "chevron-down"} size={14} color={Colors.textMuted} />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.chooseNetworkBtn}
                                                    onPress={handleSwitchNetwork}
                                                >
                                                    <Text style={styles.chooseNetworkText}>Choose Network</Text>
                                                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Inline Network Picker - Two Step */}
                                        {showNetworkPicker && (
                                            <Animated.View entering={FadeIn.duration(150)} style={styles.networkPickerDropdown}>
                                                {pickerStep === 'type' ? (
                                                    // Step 1: Choose L1 or L2
                                                    <View style={styles.networkTypeChoice}>
                                                        <TouchableOpacity
                                                            style={[styles.networkTypeBtn, { borderColor: '#627EEA' }]}
                                                            onPress={() => handleNetworkTypeSelect('L1')}
                                                        >
                                                            <Text style={styles.networkTypeBtnEmoji}>🔷</Text>
                                                            <View style={styles.networkTypeBtnInfo}>
                                                                <Text style={styles.networkTypeBtnTitle}>Layer 1</Text>
                                                                <Text style={styles.networkTypeBtnDesc}>Main networks (Ethereum, Solana...)</Text>
                                                            </View>
                                                            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.networkTypeBtn, { borderColor: '#8247E5' }]}
                                                            onPress={() => handleNetworkTypeSelect('L2')}
                                                        >
                                                            <Text style={styles.networkTypeBtnEmoji}>⚡</Text>
                                                            <View style={styles.networkTypeBtnInfo}>
                                                                <Text style={styles.networkTypeBtnTitle}>Layer 2</Text>
                                                                <Text style={styles.networkTypeBtnDesc}>Cheaper & faster (Polygon, Base...)</Text>
                                                            </View>
                                                            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    // Step 2: Show networks of selected type
                                                    <View>
                                                        <TouchableOpacity style={styles.networkPickerBackBtn} onPress={handleNetworkPickerBack}>
                                                            <Ionicons name="chevron-back" size={16} color={Colors.primary} />
                                                            <Text style={styles.networkPickerBackText}>
                                                                {selectedNetworkType === 'L1' ? 'Layer 1 Networks' : 'Layer 2 Networks'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <ScrollView style={styles.networkPickerScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                                            {NETWORKS.filter(n => n.type === selectedNetworkType).map(network => (
                                                                <TouchableOpacity
                                                                    key={network.id}
                                                                    style={[
                                                                        styles.networkPickerItem,
                                                                        selectedNetwork?.id === network.id && { backgroundColor: network.color + '20' }
                                                                    ]}
                                                                    onPress={() => handleNetworkPickerSelect(network)}
                                                                >
                                                                    <Text style={styles.networkPickerEmoji}>{network.emoji}</Text>
                                                                    <View style={styles.networkPickerInfo}>
                                                                        <Text style={[styles.networkPickerName, { color: network.color }]}>{network.name}</Text>
                                                                        <Text style={styles.networkPickerFees}>Fees: {network.fees}</Text>
                                                                    </View>
                                                                    {selectedNetwork?.id === network.id && (
                                                                        <Ionicons name="checkmark-circle" size={18} color={network.color} />
                                                                    )}
                                                                </TouchableOpacity>
                                                            ))}
                                                        </ScrollView>
                                                    </View>
                                                )}
                                            </Animated.View>
                                        )}
                                    </View>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        /* Disconnected - Show connect button */
                        <View style={[
                            styles.tradfiNode,
                            styles.walletNodeExpanded,
                            { borderColor: node.color },
                        ]}>
                            <View style={styles.walletNodeTop}>
                                <Text style={styles.tradfiEmoji}>{node.emoji}</Text>
                                <View style={styles.tradfiContent}>
                                    <Text style={styles.tradfiLabel}>Your Wallet</Text>
                                    <Text style={styles.tradfiDesc}>Connect to continue</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.connectWalletBtn}
                                onPress={handleConnectWallet}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="wallet-outline" size={20} color="#fff" />
                                        <Text style={styles.connectWalletText}>Connect Wallet</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        }

        // Regular node rendering for Bank and CEX
        return (
            <View key={node.id} style={styles.tradfiNodeWrapper}>
                <TouchableOpacity
                    style={[
                        styles.tradfiNode,
                        { borderColor: node.color },
                    ]}
                    onPress={() => handleTradFiPress(node)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.tradfiEmoji}>{node.emoji}</Text>
                    <View style={styles.tradfiContent}>
                        <Text style={styles.tradfiLabel}>{node.label}</Text>
                        <Text style={styles.tradfiDesc}>{node.description}</Text>
                    </View>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
                {index < TRADFI_NODES.length - 1 && (
                    <View style={styles.arrowSection}>
                        <View style={styles.arrowLine} />
                        <View style={styles.arrowLabel}>
                            <Text style={styles.arrowLabelText}>
                                {index === 0 ? '💳 Wire / e-Transfer' : '📤 Transfer'}
                            </Text>
                        </View>
                        <View style={styles.arrowLine} />
                    </View>
                )}
            </View>
        );
    };

    const renderNetworkSelection = () => {
        if (currentStep === 'onramp') return null;

        const l1Networks = NETWORKS.filter(n => n.type === 'L1');
        const l2Networks = NETWORKS.filter(n => n.type === 'L2');

        // If we're in the defi step (network already selected), don't show separate section
        // Network info is now displayed in the wallet card above
        if (currentStep === 'defi' && selectedNetwork) {
            return null;
        }

        // Full network selection grid (when in 'network' step)
        return (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.networkSection}>
                <View style={styles.networkHeader}>
                    <Text style={styles.networkTitle}>🌐 Choose Your Network</Text>
                    <Text style={styles.networkSubtitle}>Where do you want to use DeFi?</Text>
                </View>

                {/* L1 Networks */}
                <Text style={styles.networkTypeLabel}>Layer 1 (Main Networks)</Text>
                <View style={styles.networkGrid}>
                    {l1Networks.map(network => (
                        <TouchableOpacity
                            key={network.id}
                            style={[
                                styles.networkCard,
                                { borderColor: network.color },
                                selectedNetwork?.id === network.id && { backgroundColor: network.color + '20', borderWidth: 2.5 }
                            ]}
                            onPress={() => handleNetworkSelect(network)}
                        >
                            <Text style={styles.networkEmoji}>{network.emoji}</Text>
                            <Text style={styles.networkName}>{network.name}</Text>
                            <Text style={styles.networkFees}>Fees: {network.fees}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* L2 Networks */}
                <Text style={styles.networkTypeLabel}>Layer 2 (Cheaper & Faster)</Text>
                <View style={styles.networkGrid}>
                    {l2Networks.map(network => (
                        <TouchableOpacity
                            key={network.id}
                            style={[
                                styles.networkCard,
                                { borderColor: network.color },
                                selectedNetwork?.id === network.id && { backgroundColor: network.color + '20', borderWidth: 2.5 }
                            ]}
                            onPress={() => handleNetworkSelect(network)}
                        >
                            <Text style={styles.networkEmoji}>{network.emoji}</Text>
                            <Text style={styles.networkName}>{network.name}</Text>
                            <Text style={styles.networkFees}>Fees: {network.fees}</Text>
                            <Text style={styles.networkL2Badge}>L2</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </Animated.View>
        );
    };

    const renderDefiSection = () => {
        if (currentStep !== 'defi' || !selectedNetwork) return null;

        const activeCategory = DEFI_CATEGORIES.find(c => c.id === expandedCategory);
        const protocols = activeCategory ? getProtocolsForCategory(activeCategory.id) : [];

        return (
            <Animated.View entering={FadeInUp.duration(300)} style={[styles.defiSection, { borderColor: selectedNetwork.color + '50', backgroundColor: selectedNetwork.color + '08' }]}>
                {/* Header */}
                <Text style={styles.defiCategoriesLabel}>What do you want to do?</Text>

                {/* Category Tabs / Grid */}
                {expandedCategory ? (
                    // Focused mode - show active category + "Other" pill
                    <>
                        <View style={styles.categoryTabBar}>
                            {/* Active category pill */}
                            <TouchableOpacity
                                style={[
                                    styles.categoryTab,
                                    styles.categoryTabActive,
                                    { backgroundColor: activeCategory?.color + '20', borderColor: activeCategory?.color }
                                ]}
                                onPress={() => setExpandedCategory(null)}
                            >
                                <Text style={styles.categoryTabEmoji}>{activeCategory?.emoji}</Text>
                                <Text style={[styles.categoryTabLabel, { color: activeCategory?.color, fontWeight: '700' }]}>{activeCategory?.label}</Text>
                                <Ionicons name="close-circle" size={16} color={activeCategory?.color} style={{ marginLeft: 2 }} />
                            </TouchableOpacity>

                            {/* "Other DeFi" collapsed pill */}
                            <TouchableOpacity
                                style={[
                                    styles.categoryTab,
                                    styles.otherCategoryTab,
                                    showOtherCategories && styles.otherCategoryTabOpen
                                ]}
                                onPress={() => setShowOtherCategories(!showOtherCategories)}
                            >
                                <Text style={styles.otherCategoryText}>Other</Text>
                                <Ionicons name={showOtherCategories ? "chevron-up" : "chevron-down"} size={14} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Other categories dropdown */}
                        {showOtherCategories && (
                            <Animated.View entering={FadeIn.duration(150)} style={styles.otherCategoriesDropdown}>
                                {DEFI_CATEGORIES.filter(c => c.id !== expandedCategory).map(category => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[styles.otherCategoryItem, { borderColor: category.color }]}
                                        onPress={() => handleCategoryPress(category.id)}
                                    >
                                        <Text style={styles.otherCategoryItemEmoji}>{category.emoji}</Text>
                                        <Text style={[styles.otherCategoryItemLabel, { color: category.color }]}>{category.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </Animated.View>
                        )}
                    </>
                ) : (
                    // Grid mode - initial state with large cards
                    <View style={styles.defiGrid}>
                        {DEFI_CATEGORIES.map(category => {
                            const catProtocols = getProtocolsForCategory(category.id);
                            return (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[styles.defiCategory, { borderColor: category.color }]}
                                    onPress={() => handleCategoryPress(category.id)}
                                >
                                    <Text style={styles.defiCategoryEmoji}>{category.emoji}</Text>
                                    <Text style={styles.defiCategoryLabel}>{category.label}</Text>
                                    <Text style={styles.defiCategoryDesc}>{category.description}</Text>
                                    {catProtocols.length > 0 && (
                                        <View style={styles.protocolCount}>
                                            <Text style={styles.protocolCountText}>{catProtocols.length}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Expanded Category Content */}
                {expandedCategory && activeCategory && (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.categoryContent}>
                        {/* Category Header */}
                        <View style={styles.categoryContentHeader}>
                            <View style={styles.categoryContentTitleRow}>
                                <Text style={styles.categoryContentEmoji}>{activeCategory.emoji}</Text>
                                <View>
                                    <Text style={[styles.categoryContentTitle, { color: activeCategory.color }]}>{activeCategory.label}</Text>
                                    <Text style={styles.categoryContentDesc}>{activeCategory.description}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setExpandedCategory(null)} style={styles.categoryCollapseBtn}>
                                <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Protocol Content */}
                        {selectedProtocol ? (
                            // Single protocol detail view
                            <View style={styles.protocolDetail}>
                                <TouchableOpacity style={styles.backBtn} onPress={handleBackToProtocols}>
                                    <Ionicons name="chevron-back" size={16} color={Colors.primary} />
                                    <Text style={styles.backBtnText}>All {activeCategory.label}</Text>
                                </TouchableOpacity>

                                {/* For swap protocols, show inline swap interface */}
                                {activeCategory.id === 'swapping' ? (
                                    <SwapInterface
                                        visible={true}
                                        inline={true}
                                        chainId={(() => {
                                            const networkToChainId: Record<string, number> = {
                                                'ethereum': 1, 'polygon': 137, 'base': 8453, 'arbitrum': 42161, 'optimism': 10,
                                            };
                                            return networkToChainId[selectedNetwork.id] || 1;
                                        })()}
                                        protocolName={selectedProtocol.name}
                                        onClose={handleBackToProtocols}
                                        onInputFocus={() => {
                                            // Scroll to end when input is focused so more content is visible
                                            setTimeout(() => {
                                                scrollViewRef.current?.scrollToEnd({ animated: true });
                                            }, 50);
                                        }}
                                    />
                                ) : activeCategory.id === 'lending' && selectedNetwork.id === 'polygon' ? (
                                    /* For lending protocols on Polygon, show inline lending interface */
                                    <View style={styles.lendingSection}>
                                        <View style={[styles.protocolDetailCard, { borderColor: selectedProtocol.color }]}>
                                            <View style={styles.protocolDetailHeader}>
                                                <Text style={styles.protocolDetailEmoji}>{selectedProtocol.emoji}</Text>
                                                <View style={styles.protocolDetailInfo}>
                                                    <Text style={styles.protocolDetailName}>{selectedProtocol.name}</Text>
                                                    <Text style={styles.protocolDetailText}>{selectedProtocol.description}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.lendActionBtn, { backgroundColor: selectedProtocol.color || Colors.primary }]}
                                                onPress={() => setShowLendingModal(true)}
                                            >
                                                <Ionicons name="business" size={20} color="#fff" />
                                                <Text style={styles.lendActionBtnText}>Open Lending Dashboard</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    /* For other protocols, show detail card */
                                    <View style={[styles.protocolDetailCard, { borderColor: selectedProtocol.color }]}>
                                        <View style={styles.protocolDetailHeader}>
                                            <Text style={styles.protocolDetailEmoji}>{selectedProtocol.emoji}</Text>
                                            <View style={styles.protocolDetailInfo}>
                                                <Text style={styles.protocolDetailName}>{selectedProtocol.name}</Text>
                                                {selectedProtocol.tvl && (
                                                    <Text style={[styles.protocolDetailTvl, { color: selectedProtocol.color }]}>TVL: {selectedProtocol.tvl}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={styles.protocolDetailText}>{selectedProtocol.description}</Text>
                                        <View style={styles.chainsRow}>
                                            <Text style={styles.chainsLabel}>Also on:</Text>
                                            {selectedProtocol.networks.slice(0, 4).map(netId => {
                                                const net = NETWORKS.find(n => n.id === netId);
                                                return net ? <Text key={netId} style={styles.chainBadge}>{net.emoji}</Text> : null;
                                            })}
                                        </View>
                                    </View>
                                )}
                            </View>
                        ) : (
                            // Protocol list view
                            protocols.length === 0 ? (
                                <View style={styles.noProtocolsContainer}>
                                    <Ionicons name="alert-circle-outline" size={32} color={Colors.textMuted} />
                                    <Text style={styles.noProtocolsText}>Not available on {selectedNetwork.name}</Text>
                                </View>
                            ) : (
                                <View style={styles.protocolGrid}>
                                    {protocols.map(protocol => (
                                        <TouchableOpacity
                                            key={protocol.id}
                                            style={[styles.protocolCard, { borderColor: protocol.color, backgroundColor: protocol.color + '08' }]}
                                            onPress={() => handleProtocolPress(protocol)}
                                        >
                                            <Text style={styles.protocolCardEmoji}>{protocol.emoji}</Text>
                                            <Text style={styles.protocolCardName}>{protocol.name}</Text>
                                            {protocol.tvl && <Text style={[styles.protocolCardTvl, { color: protocol.color }]}>{protocol.tvl}</Text>}
                                            <Text style={styles.protocolCardDesc} numberOfLines={2}>{protocol.description}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )
                        )}
                    </Animated.View>
                )}
            </Animated.View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header - only show when not connected */}
            {!isConnected && (
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIcon}>
                            <Ionicons name="pulse" size={22} color={Colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>DeFi Command Center</Text>
                            <Text style={styles.headerSubtitle}>
                                {currentStep === 'onramp' && 'Connect your wallet'}
                                {currentStep === 'network' && 'Pick a network'}
                                {currentStep === 'defi' && 'Explore decentralized finance'}
                            </Text>
                        </View>
                    </View>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={26} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={isLoadingBalances}
                        onRefresh={fetchBalances}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* Intro blurb - only show when not connected */}
                {!isConnected && (
                    <View style={styles.introBlurb}>
                        <Ionicons name="rocket-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.introText}>
                            Connect your wallet, choose a network, and start swapping, lending, or staking.
                        </Text>
                    </View>
                )}

                {/* Wallet Section Only - Removed Bank/CEX for cleaner UI */}
                <View style={styles.tradfiContainer}>
                    {renderTradFiNode(TRADFI_NODES.find(n => n.id === 'wallet')!, 0)}
                </View>

                {/* Network Selection */}
                {renderNetworkSelection()}

                {/* DeFi Section */}
                {renderDefiSection()}

                {/* Explore More Section - Advanced Categories */}
                {isConnected && (
                    <View style={styles.exploreMoreContainer}>
                        <TouchableOpacity
                            style={styles.exploreMoreHeader}
                            onPress={() => setShowExploreMore(!showExploreMore)}
                        >
                            <View style={styles.exploreMoreTitleRow}>
                                <Ionicons name="compass-outline" size={20} color={Colors.primary} />
                                <Text style={styles.exploreMoreTitle}>Explore More</Text>
                            </View>
                            <View style={styles.exploreMoreBadge}>
                                <Text style={styles.exploreMoreBadgeText}>6 categories</Text>
                                <Ionicons
                                    name={showExploreMore ? "chevron-up" : "chevron-down"}
                                    size={18}
                                    color={Colors.textMuted}
                                />
                            </View>
                        </TouchableOpacity>

                        {showExploreMore && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={styles.exploreMoreContent}
                            >
                                <Text style={styles.exploreMoreSubtitle}>
                                    Advanced Web3 features - expand your portfolio
                                </Text>

                                {/* NFTs & Collectibles */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('nfts')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#FF6B9520' }]}>
                                        <Text style={{ fontSize: 20 }}>🖼️</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>NFTs & Collectibles</Text>
                                        <Text style={styles.exploreCardDesc}>View and manage your digital art and collectibles</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>

                                {/* Real World Assets */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('rwa')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#4ECDC420' }]}>
                                        <Text style={{ fontSize: 20 }}>🏠</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>Real World Assets</Text>
                                        <Text style={styles.exploreCardDesc}>Tokenized real estate, bonds, and commodities</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>

                                {/* Governance */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('governance')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#9B59B620' }]}>
                                        <Text style={{ fontSize: 20 }}>🗳️</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>Governance</Text>
                                        <Text style={styles.exploreCardDesc}>Vote on DAO proposals and shape protocols</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>

                                {/* DeFi Positions */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('positions')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#2ECC7120' }]}>
                                        <Text style={{ fontSize: 20 }}>📊</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>DeFi Positions</Text>
                                        <Text style={styles.exploreCardDesc}>Track active stakes, LP positions, and loans</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>

                                {/* Cross-chain Portfolio */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('crosschain')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#3498DB20' }]}>
                                        <Text style={{ fontSize: 20 }}>🌐</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>Cross-chain Portfolio</Text>
                                        <Text style={styles.exploreCardDesc}>Unified view of assets across all networks</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>

                                {/* Airdrops & Rewards */}
                                <TouchableOpacity style={styles.exploreCard} onPress={() => setActiveExploreCategory('airdrops')}>
                                    <View style={[styles.exploreCardIcon, { backgroundColor: '#F39C1220' }]}>
                                        <Text style={{ fontSize: 20 }}>🎁</Text>
                                    </View>
                                    <View style={styles.exploreCardContent}>
                                        <Text style={styles.exploreCardTitle}>Airdrops & Rewards</Text>
                                        <Text style={styles.exploreCardDesc}>Claim tokens and track loyalty rewards</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                )}

                {/* Bottom padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Node Info Modal */}
            <Modal visible={showNodeInfo} animationType="fade" transparent>
                <Pressable style={styles.modalOverlay} onPress={closeNodeInfo}>
                    <Pressable style={styles.modalContent} onPress={() => { }}>
                        {selectedNode && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={[styles.modalIcon, { backgroundColor: selectedNode.color + '30' }]}>
                                        <Text style={styles.modalEmoji}>{selectedNode.emoji}</Text>
                                    </View>
                                    <View style={styles.modalTitleContainer}>
                                        <Text style={styles.modalTitle}>{selectedNode.label}</Text>
                                        <Text style={styles.modalSubtitle}>{selectedNode.description}</Text>
                                    </View>
                                    <TouchableOpacity onPress={closeNodeInfo}>
                                        <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.modalText}>{selectedNode.details}</Text>
                                <View style={styles.examplesContainer}>
                                    <Text style={styles.examplesLabel}>Examples:</Text>
                                    <View style={styles.examplesList}>
                                        {selectedNode.examples.map((ex, i) => (
                                            <View key={i} style={[styles.exampleChip, { backgroundColor: selectedNode.color + '20' }]}>
                                                <Text style={[styles.exampleText, { color: selectedNode.color }]}>{ex}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.gotItBtn} onPress={closeNodeInfo}>
                                    <Text style={styles.gotItText}>Got it</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Swap Interface Modal */}
            <SwapInterface
                visible={showSwapModal}
                chainId={selectedNetwork ? (() => {
                    // Map network ID to chainId
                    const networkToChainId: Record<string, number> = {
                        'ethereum': 1,
                        'polygon': 137,
                        'base': 8453,
                        'arbitrum': 42161,
                        'optimism': 10,
                    };
                    const chainId = networkToChainId[selectedNetwork.id] || 1;
                    console.log('🔗 SwapInterface chainId lookup:', selectedNetwork.id, '->', chainId);
                    return chainId;
                })() : 1}
                protocolName={selectedProtocol?.name || 'DEX'}
                onClose={() => setShowSwapModal(false)}
            />

            {/* Lending Interface Modal */}
            <LendingInterface
                visible={showLendingModal}
                onClose={() => setShowLendingModal(false)}
            />

            {/* Wallet Connection Modal - rendered inside ValueFlowMap to fix nested modal issue */}
            <WalletModal
                visible={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                address={address || ''}
                onDisconnect={wcDisconnect}
                onConnect={handleManualConnect}
            />

            {/* Explore More Category Modals */}
            <NFTsScreen
                visible={activeExploreCategory === 'nfts'}
                onClose={() => setActiveExploreCategory(null)}
                walletAddress={address || undefined}
                onNavigateToLearn={handleNavigateToLearn}
            />
            <RWAScreen
                visible={activeExploreCategory === 'rwa'}
                onClose={() => setActiveExploreCategory(null)}
                onNavigateToLearn={handleNavigateToLearn}
            />
            <GovernanceScreen
                visible={activeExploreCategory === 'governance'}
                onClose={() => setActiveExploreCategory(null)}
                onNavigateToLearn={handleNavigateToLearn}
            />
            <DeFiPositionsScreen
                visible={activeExploreCategory === 'positions'}
                onClose={() => setActiveExploreCategory(null)}
                onNavigateToLearn={handleNavigateToLearn}
            />
            <CrossChainScreen
                visible={activeExploreCategory === 'crosschain'}
                onClose={() => setActiveExploreCategory(null)}
                onNavigateToLearn={handleNavigateToLearn}
            />
            <AirdropsScreen
                visible={activeExploreCategory === 'airdrops'}
                onClose={() => setActiveExploreCategory(null)}
                onNavigateToLearn={handleNavigateToLearn}
            />

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: STATUS_BAR_HEIGHT,
        paddingBottom: Spacing.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    headerSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
    closeButton: { padding: Spacing.xs },

    // Scroll
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },

    // TradFi
    tradfiContainer: { marginBottom: Spacing.md },
    tradfiNodeWrapper: { alignItems: 'center' },
    tradfiNode: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 2,
        gap: Spacing.md,
        width: '100%',
    },
    tradfiNodeHighlight: { borderWidth: 2.5, shadowColor: Colors.primary, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    tradfiEmoji: { fontSize: 32 },
    tradfiContent: { flex: 1 },
    tradfiLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
    tradfiDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

    // Wallet collapsed view
    walletCollapsedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: '100%' },
    walletCollapsedInfo: { flex: 1 },
    walletCollapsedAddress: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
    walletCollapsedBalance: { fontSize: 11, color: Colors.success, fontWeight: '500' },
    walletCollapsedNetwork: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },

    tapHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tapHintText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

    // Wallet node expanded
    walletNodeExpanded: { flexDirection: 'column', alignItems: 'stretch' },
    walletNodeTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    disconnectBtn: { padding: 8, marginLeft: 'auto' },
    walletConnectedSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    balanceLabel: { fontSize: 13, color: Colors.textMuted },
    balanceValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
    balanceRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    refreshBtn: { padding: 4, marginLeft: 4 },

    // Network row in wallet card
    networkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
    networkLabel: { fontSize: 13, color: Colors.textMuted },
    networkSelectedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
    networkSelectedName: { fontSize: 14, fontWeight: '600' },
    chooseNetworkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
    chooseNetworkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

    // Network Picker Dropdown
    networkPickerDropdown: { marginTop: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    networkPickerScroll: { maxHeight: 200 },
    networkPickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    networkPickerEmoji: { fontSize: 20 },
    networkPickerInfo: { flex: 1 },
    networkPickerName: { fontSize: 14, fontWeight: '600' },
    networkPickerFees: { fontSize: 10, color: Colors.textMuted },

    // Two-step network picker
    networkTypeChoice: { padding: Spacing.sm },
    networkTypeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        backgroundColor: Colors.background,
        marginBottom: Spacing.sm,
    },
    networkTypeBtnEmoji: { fontSize: 24 },
    networkTypeBtnInfo: { flex: 1 },
    networkTypeBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    networkTypeBtnDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
    networkPickerBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
    networkPickerBackText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

    continueBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BorderRadius.md },
    continueBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    connectWalletBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.md, marginTop: Spacing.md },
    connectWalletText: { fontSize: 16, fontWeight: '600', color: '#fff' },

    // Arrow with label
    arrowSection: { alignItems: 'center', paddingVertical: 4 },
    arrowLine: { width: 2, height: 8, backgroundColor: Colors.border },
    arrowLabel: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    arrowLabelText: { fontSize: 10, color: Colors.textMuted },

    // Intro blurb
    introBlurb: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    introText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

    // Network selection
    networkSection: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    networkHeader: { alignItems: 'center', marginBottom: Spacing.md },
    networkTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    networkSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
    networkTypeLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: Spacing.sm },
    networkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
    networkCard: {
        width: '30%',
        minWidth: 90,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.sm,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    networkEmoji: { fontSize: 26, marginBottom: 4 },
    networkName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
    networkFees: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
    networkL2Badge: { position: 'absolute', top: 4, right: 4, fontSize: 8, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },

    // DeFi section
    defiSection: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        borderWidth: 2,
    },
    defiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    defiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    defiNetworkEmoji: { fontSize: 28 },
    defiNetworkName: { fontSize: 16, fontWeight: '700' },
    defiNetworkType: { fontSize: 10, color: Colors.textMuted },
    switchNetworkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
    switchNetworkText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
    defiCategoriesLabel: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },

    // Category Tab Bar (horizontal tabs when category is selected)
    categoryTabBar: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1.5,
        backgroundColor: Colors.surface,
    },
    categoryTabEmoji: { fontSize: 16 },
    categoryTabLabel: { fontSize: 12, color: Colors.textPrimary },
    categoryTabBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    categoryTabBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
    categoryTabActive: { borderWidth: 2 },

    // Other DeFi dropdown
    otherCategoryTab: { backgroundColor: Colors.background, borderColor: Colors.border },
    otherCategoryTabOpen: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    otherCategoryText: { fontSize: 12, color: Colors.textMuted },
    otherCategoriesDropdown: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
    },
    otherCategoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: Colors.background,
    },
    otherCategoryItemEmoji: { fontSize: 14 },
    otherCategoryItemLabel: { fontSize: 11, fontWeight: '600' },

    // Expanded Category Content
    categoryContent: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        minHeight: 180,
    },
    categoryContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    categoryContentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    categoryContentEmoji: { fontSize: 28 },
    categoryContentTitle: { fontSize: 18, fontWeight: '700' },
    categoryContentDesc: { fontSize: 11, color: Colors.textMuted },
    categoryCollapseBtn: { padding: 4 },

    // Protocol Grid (in expanded view)
    protocolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    protocolCard: {
        width: '47%',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    protocolCardEmoji: { fontSize: 32, marginBottom: 6 },
    protocolCardName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    protocolCardTvl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    protocolCardDesc: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },

    // No protocols container
    noProtocolsContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },

    // DeFi grid (initial state - large cards)
    defiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
    defiCategoryContainer: { width: '48%', marginBottom: Spacing.sm },
    defiCategory: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 2,
        alignItems: 'center',
        width: '48%',
    },
    defiCategoryEmoji: { fontSize: 28, marginBottom: 4 },
    defiCategoryLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    defiCategoryDesc: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
    protocolCount: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    protocolCountText: { fontSize: 10, fontWeight: '700', color: '#fff' },

    // Expanded protocols
    protocolsExpanded: {
        marginTop: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    protocolList: { gap: 6 },
    protocolChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        gap: Spacing.sm,
    },
    protocolChipEmoji: { fontSize: 20 },
    protocolChipInfo: { flex: 1 },
    protocolChipName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
    protocolChipTvl: { fontSize: 10, fontWeight: '600' },
    noProtocolsText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', padding: Spacing.sm },

    // Protocol detail
    protocolDetail: {},
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    backBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
    protocolDetailCard: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 2 },
    protocolDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    protocolDetailEmoji: { fontSize: 26 },
    protocolDetailInfo: { flex: 1 },
    protocolDetailName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    protocolDetailTvl: { fontSize: 11, fontWeight: '600' },
    protocolDetailText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
    chainsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
    chainsLabel: { fontSize: 10, color: Colors.textMuted },
    chainBadge: { fontSize: 14 },

    // Swap action button
    swapActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
    swapActionBtnText: { fontSize: 12, fontWeight: '600', color: '#fff', flexShrink: 1 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.md },
    modalIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    modalEmoji: { fontSize: 28 },
    modalTitleContainer: { flex: 1 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
    modalSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
    modalText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
    examplesContainer: { marginBottom: Spacing.lg },
    examplesLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
    examplesList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    exampleChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    exampleText: { fontSize: 13, fontWeight: '500' },
    gotItBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    gotItText: { fontSize: 16, fontWeight: '600', color: '#fff' },

    // Explore More Section
    exploreMoreContainer: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.xl,
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    exploreMoreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
    },
    exploreMoreTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    exploreMoreTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    exploreMoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    exploreMoreBadgeText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    exploreMoreContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    exploreMoreSubtitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
    },
    exploreCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    exploreCardIcon: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exploreCardContent: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    exploreCardTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    exploreCardDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    comingSoonChip: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    comingSoonText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.primary,
    },

    // Lending section styles
    lendingSection: {
        marginTop: Spacing.sm,
    },
    lendActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 14,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    lendActionBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
