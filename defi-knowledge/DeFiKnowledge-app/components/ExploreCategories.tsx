// Explore More Categories - Component screens for advanced DeFi features
// Each screen shows when user taps a category in the Explore More section

import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Image,
    Modal,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';
import { useRouter } from 'expo-router';

// Educational info for each category
const CATEGORY_INFO = {
    nfts: {
        title: 'What are NFTs?',
        description: 'NFTs (Non-Fungible Tokens) are unique digital assets stored on a blockchain. Unlike cryptocurrencies, each NFT is one-of-a-kind and cannot be exchanged 1:1 with another. They represent ownership of digital art, collectibles, music, virtual real estate, and more.',
        learnTopic: 'nfts',
    },
    rwa: {
        title: 'What are Real World Assets?',
        description: 'Real World Assets (RWAs) are traditional financial assets like real estate, bonds, and commodities that have been tokenized on a blockchain. This allows fractional ownership, 24/7 trading, and easier access to investments that were previously only available to institutions.',
        learnTopic: 'tokenization',
    },
    governance: {
        title: 'What is DeFi Governance?',
        description: 'Governance in DeFi allows token holders to vote on protocol changes, treasury allocations, and new features. By holding governance tokens like UNI, AAVE, or COMP, you become a stakeholder with voting power to shape the future of these protocols.',
        learnTopic: 'daos',
    },
    positions: {
        title: 'What are DeFi Positions?',
        description: 'DeFi positions represent your active financial activities across protocols - including lending deposits, staking, liquidity provision, and loans. Tracking positions helps you monitor returns, manage risk, and optimize yields across your portfolio.',
        learnTopic: 'yield-farming',
    },
    crosschain: {
        title: 'What is Cross-chain?',
        description: 'Cross-chain refers to assets and operations spanning multiple blockchains. As DeFi grows, opportunities exist across Ethereum, Polygon, Arbitrum, Base, and more. Managing a cross-chain portfolio lets you take advantage of different networks\' unique benefits.',
        learnTopic: 'bridges',
    },
    airdrops: {
        title: 'What are Airdrops?',
        description: 'Airdrops are free token distributions to early users or community members. Protocols reward active users who tested their products before a token launch. Staying active across DeFi can make you eligible for valuable airdrops.',
        learnTopic: 'airdrops',
    },
};

// Props for category modals
interface CategoryModalProps {
    visible: boolean;
    onClose: () => void;
    walletAddress?: string;
    onNavigateToLearn?: (topic: string) => void;
}

// Reusable Info Tooltip Component
const InfoTooltip: React.FC<{
    category: keyof typeof CATEGORY_INFO;
    onLearnMore?: (topic: string) => void;
}> = ({ category, onLearnMore }) => {
    const [showInfo, setShowInfo] = useState(false);
    const info = CATEGORY_INFO[category];

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowInfo(true)}
                style={styles.infoIconBtn}
            >
                <Ionicons name="information-circle-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>

            <Modal visible={showInfo} animationType="fade" transparent>
                <Pressable style={styles.tooltipOverlay} onPress={() => setShowInfo(false)}>
                    <Pressable style={styles.tooltipContent} onPress={() => { }}>
                        <View style={styles.tooltipHeader}>
                            <Ionicons name="bulb" size={24} color={Colors.primary} />
                            <Text style={styles.tooltipTitle}>{info.title}</Text>
                        </View>
                        <Text style={styles.tooltipDescription}>{info.description}</Text>

                        <View style={styles.tooltipActions}>
                            <TouchableOpacity
                                style={styles.tooltipDismiss}
                                onPress={() => setShowInfo(false)}
                            >
                                <Text style={styles.tooltipDismissText}>Got it</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.tooltipLearnMore}
                                onPress={() => {
                                    setShowInfo(false);
                                    onLearnMore?.(info.learnTopic);
                                }}
                            >
                                <Ionicons name="book-outline" size={16} color="#fff" />
                                <Text style={styles.tooltipLearnMoreText}>Learn More</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
};

// ============================================
// NFTs & Collectibles Screen
// ============================================
export const NFTsScreen: React.FC<CategoryModalProps> = ({ visible, onClose, walletAddress, onNavigateToLearn }) => {
    const [isLoading, setIsLoading] = useState(false);

    // Demo NFT data - would be fetched from OpenSea/Alchemy API
    const demoNFTs = [
        { id: '1', name: 'Bored Ape #1234', collection: 'BAYC', image: null, floorPrice: '32.5 ETH' },
        { id: '2', name: 'Pudgy Penguin #567', collection: 'Pudgy Penguins', image: null, floorPrice: '8.2 ETH' },
        { id: '3', name: 'Azuki #890', collection: 'Azuki', image: null, floorPrice: '12.1 ETH' },
        { id: '4', name: 'CloneX #2345', collection: 'CloneX', image: null, floorPrice: '4.5 ETH' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>🖼️</Text>
                            <Text style={styles.modalTitle}>NFTs & Collectibles</Text>
                            <InfoTooltip category="nfts" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        {/* Stats Summary */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>4</Text>
                                <Text style={styles.statLabel}>NFTs Owned</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>~57 ETH</Text>
                                <Text style={styles.statLabel}>Est. Value</Text>
                            </View>
                        </View>

                        {/* NFT Grid */}
                        <Text style={styles.sectionTitle}>Your Collection</Text>
                        <View style={styles.nftGrid}>
                            {demoNFTs.map((nft, index) => (
                                <Animated.View
                                    key={nft.id}
                                    entering={FadeInDown.delay(index * 100).duration(300)}
                                    style={styles.nftCard}
                                >
                                    <View style={styles.nftImagePlaceholder}>
                                        <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                                    </View>
                                    <Text style={styles.nftName} numberOfLines={1}>{nft.name}</Text>
                                    <Text style={styles.nftCollection}>{nft.collection}</Text>
                                    <Text style={styles.nftFloor}>Floor: {nft.floorPrice}</Text>
                                </Animated.View>
                            ))}
                        </View>

                        {/* Actions */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionBtn}>
                                <Ionicons name="search" size={20} color="#fff" />
                                <Text style={styles.actionBtnText}>Browse Marketplaces</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// Real World Assets Screen
// ============================================
export const RWAScreen: React.FC<CategoryModalProps> = ({ visible, onClose, onNavigateToLearn }) => {
    // Demo RWA data
    const rwaAssets = [
        { id: '1', name: 'US Treasury Bill', protocol: 'Ondo', apy: '5.2%', type: 'Treasury', emoji: '🏛️' },
        { id: '2', name: 'Tokenized Real Estate', protocol: 'RealT', apy: '9.5%', type: 'Property', emoji: '🏠' },
        { id: '3', name: 'Gold Token (PAXG)', protocol: 'Paxos', apy: '0%', type: 'Commodity', emoji: '🪙' },
        { id: '4', name: 'Corporate Bonds', protocol: 'Centrifuge', apy: '7.8%', type: 'Bond', emoji: '📜' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>🏠</Text>
                            <Text style={styles.modalTitle}>Real World Assets</Text>
                            <InfoTooltip category="rwa" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        <Text style={styles.categoryDescription}>
                            Invest in tokenized real-world assets like real estate, treasury bills, and commodities.
                        </Text>

                        {/* RWA Categories */}
                        <View style={styles.categoryTabs}>
                            {['All', 'Treasury', 'Property', 'Commodity'].map(cat => (
                                <TouchableOpacity key={cat} style={[styles.categoryTab, cat === 'All' && styles.categoryTabActive]}>
                                    <Text style={[styles.categoryTabText, cat === 'All' && styles.categoryTabTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* RWA List */}
                        {rwaAssets.map((asset, index) => (
                            <Animated.View
                                key={asset.id}
                                entering={FadeInDown.delay(index * 80).duration(300)}
                            >
                                <TouchableOpacity style={styles.assetCard}>
                                    <View style={styles.assetIcon}>
                                        <Text style={{ fontSize: 28 }}>{asset.emoji}</Text>
                                    </View>
                                    <View style={styles.assetInfo}>
                                        <Text style={styles.assetName}>{asset.name}</Text>
                                        <Text style={styles.assetProtocol}>via {asset.protocol}</Text>
                                    </View>
                                    <View style={styles.assetApy}>
                                        <Text style={styles.apyValue}>{asset.apy}</Text>
                                        <Text style={styles.apyLabel}>APY</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// Governance Screen
// ============================================
export const GovernanceScreen: React.FC<CategoryModalProps> = ({ visible, onClose, onNavigateToLearn }) => {
    // Demo governance proposals
    const proposals = [
        { id: '1', dao: 'Uniswap', title: 'Deploy Uniswap v4 on Base', status: 'Active', endTime: '2 days', votes: { for: 65, against: 35 }, emoji: '🦄' },
        { id: '2', dao: 'Aave', title: 'Enable cbETH as collateral', status: 'Active', endTime: '5 days', votes: { for: 89, against: 11 }, emoji: '👻' },
        { id: '3', dao: 'ENS', title: 'Increase registration fee 10%', status: 'Ended', endTime: 'Passed', votes: { for: 72, against: 28 }, emoji: '📛' },
        { id: '4', dao: 'Compound', title: 'Update interest rate model', status: 'Active', endTime: '1 day', votes: { for: 51, against: 49 }, emoji: '🟢' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>🗳️</Text>
                            <Text style={styles.modalTitle}>Governance</Text>
                            <InfoTooltip category="governance" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        <Text style={styles.categoryDescription}>
                            Vote on DAO proposals and shape the future of DeFi protocols.
                        </Text>

                        {/* Voting Power Summary */}
                        <View style={styles.votingPowerCard}>
                            <View>
                                <Text style={styles.votingPowerLabel}>Your Voting Power</Text>
                                <Text style={styles.votingPowerValue}>1,250 votes</Text>
                            </View>
                            <View style={styles.votingTokens}>
                                <Text style={styles.votingToken}>125 UNI</Text>
                                <Text style={styles.votingToken}>0.5 AAVE</Text>
                            </View>
                        </View>

                        {/* Proposals */}
                        <Text style={styles.sectionTitle}>Active Proposals</Text>
                        {proposals.map((proposal, index) => (
                            <Animated.View
                                key={proposal.id}
                                entering={FadeInDown.delay(index * 80).duration(300)}
                            >
                                <TouchableOpacity style={styles.proposalCard}>
                                    <View style={styles.proposalHeader}>
                                        <Text style={{ fontSize: 20 }}>{proposal.emoji}</Text>
                                        <Text style={styles.proposalDao}>{proposal.dao}</Text>
                                        <View style={[styles.proposalStatus, proposal.status === 'Active' ? styles.statusActive : styles.statusEnded]}>
                                            <Text style={styles.proposalStatusText}>{proposal.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.proposalTitle}>{proposal.title}</Text>

                                    {/* Vote Bar */}
                                    <View style={styles.voteBarContainer}>
                                        <View style={[styles.voteBarFor, { width: `${proposal.votes.for}%` }]} />
                                    </View>
                                    <View style={styles.voteLabels}>
                                        <Text style={styles.voteFor}>For {proposal.votes.for}%</Text>
                                        <Text style={styles.voteAgainst}>Against {proposal.votes.against}%</Text>
                                    </View>

                                    {proposal.status === 'Active' && (
                                        <View style={styles.voteButtons}>
                                            <TouchableOpacity style={styles.voteForBtn}>
                                                <Ionicons name="checkmark" size={16} color="#fff" />
                                                <Text style={styles.voteBtnText}>Vote For</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.voteAgainstBtn}>
                                                <Ionicons name="close" size={16} color="#fff" />
                                                <Text style={styles.voteBtnText}>Vote Against</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// DeFi Positions Screen
// ============================================
export const DeFiPositionsScreen: React.FC<CategoryModalProps> = ({ visible, onClose, onNavigateToLearn }) => {
    // Demo positions
    const positions = [
        { id: '1', protocol: 'Aave', type: 'Lending', asset: 'USDC', amount: '10,000', value: '$10,000', apy: '+4.5%', emoji: '👻' },
        { id: '2', protocol: 'Lido', type: 'Staking', asset: 'stETH', amount: '2.5', value: '$8,125', apy: '+3.5%', emoji: '🌊' },
        { id: '3', protocol: 'Uniswap', type: 'LP', asset: 'ETH/USDC', amount: '$5,000', value: '$5,234', apy: '+12%', emoji: '🦄' },
        { id: '4', protocol: 'Compound', type: 'Borrow', asset: 'ETH', amount: '1.0', value: '-$3,250', apy: '-2.1%', emoji: '🟢' },
    ];

    const totalValue = 20109;
    const totalEarned = 1234;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>📊</Text>
                            <Text style={styles.modalTitle}>DeFi Positions</Text>
                            <InfoTooltip category="positions" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        {/* Portfolio Summary */}
                        <View style={styles.portfolioSummary}>
                            <View style={styles.portfolioMain}>
                                <Text style={styles.portfolioLabel}>Total Value Locked</Text>
                                <Text style={styles.portfolioValue}>${totalValue.toLocaleString()}</Text>
                            </View>
                            <View style={styles.portfolioEarned}>
                                <Text style={styles.earnedLabel}>Total Earned</Text>
                                <Text style={styles.earnedValue}>+${totalEarned.toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Position List */}
                        <Text style={styles.sectionTitle}>Active Positions</Text>
                        {positions.map((pos, index) => (
                            <Animated.View
                                key={pos.id}
                                entering={FadeInDown.delay(index * 80).duration(300)}
                            >
                                <TouchableOpacity style={styles.positionCard}>
                                    <View style={styles.positionLeft}>
                                        <Text style={{ fontSize: 24 }}>{pos.emoji}</Text>
                                        <View style={styles.positionInfo}>
                                            <Text style={styles.positionProtocol}>{pos.protocol}</Text>
                                            <View style={styles.positionTypeRow}>
                                                <View style={[styles.positionTypeBadge, pos.type === 'Borrow' && styles.borrowBadge]}>
                                                    <Text style={styles.positionTypeText}>{pos.type}</Text>
                                                </View>
                                                <Text style={styles.positionAsset}>{pos.asset}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.positionRight}>
                                        <Text style={[styles.positionValue, pos.type === 'Borrow' && styles.borrowValue]}>{pos.value}</Text>
                                        <Text style={[styles.positionApy, pos.type === 'Borrow' ? styles.borrowApy : styles.earnApy]}>{pos.apy}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        {/* Quick Actions */}
                        <View style={styles.quickActions}>
                            <TouchableOpacity style={styles.quickActionBtn}>
                                <Ionicons name="gift-outline" size={20} color={Colors.primary} />
                                <Text style={styles.quickActionText}>Claim All Rewards</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// Cross-chain Portfolio Screen
// ============================================
export const CrossChainScreen: React.FC<CategoryModalProps> = ({ visible, onClose, onNavigateToLearn }) => {
    // Demo cross-chain data
    const chainBalances = [
        { id: 'ethereum', name: 'Ethereum', emoji: '🔷', value: 15234, percentage: 45, color: '#627EEA' },
        { id: 'polygon', name: 'Polygon', emoji: '🟣', value: 8500, percentage: 25, color: '#8247E5' },
        { id: 'arbitrum', name: 'Arbitrum', emoji: '🟠', value: 5100, percentage: 15, color: '#28A0F0' },
        { id: 'base', name: 'Base', emoji: '🔵', value: 3400, percentage: 10, color: '#0052FF' },
        { id: 'flare', name: 'Flare', emoji: '🔥', value: 1700, percentage: 5, color: '#E62058' },
    ];

    const totalValue = chainBalances.reduce((sum, c) => sum + c.value, 0);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>🌐</Text>
                            <Text style={styles.modalTitle}>Cross-chain Portfolio</Text>
                            <InfoTooltip category="crosschain" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        {/* Total Portfolio */}
                        <View style={styles.totalPortfolio}>
                            <Text style={styles.totalLabel}>Total Portfolio Value</Text>
                            <Text style={styles.totalValue}>${totalValue.toLocaleString()}</Text>
                            <Text style={styles.totalChange}>+5.2% (24h)</Text>
                        </View>

                        {/* Chain Distribution Bar */}
                        <View style={styles.distributionBar}>
                            {chainBalances.map(chain => (
                                <View
                                    key={chain.id}
                                    style={[styles.distributionSegment, { width: `${chain.percentage}%`, backgroundColor: chain.color }]}
                                />
                            ))}
                        </View>

                        {/* Chain List */}
                        <Text style={styles.sectionTitle}>By Network</Text>
                        {chainBalances.map((chain, index) => (
                            <Animated.View
                                key={chain.id}
                                entering={FadeInDown.delay(index * 80).duration(300)}
                            >
                                <TouchableOpacity style={styles.chainCard}>
                                    <View style={styles.chainLeft}>
                                        <Text style={{ fontSize: 24 }}>{chain.emoji}</Text>
                                        <View style={styles.chainInfo}>
                                            <Text style={styles.chainName}>{chain.name}</Text>
                                            <View style={[styles.chainBar, { width: `${chain.percentage}%`, backgroundColor: chain.color }]} />
                                        </View>
                                    </View>
                                    <View style={styles.chainRight}>
                                        <Text style={styles.chainValue}>${chain.value.toLocaleString()}</Text>
                                        <Text style={styles.chainPercentage}>{chain.percentage}%</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        {/* Bridge CTA */}
                        <TouchableOpacity style={styles.bridgeBtn}>
                            <Ionicons name="swap-horizontal" size={20} color="#fff" />
                            <Text style={styles.bridgeBtnText}>Bridge Assets</Text>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// Airdrops & Rewards Screen
// ============================================
export const AirdropsScreen: React.FC<CategoryModalProps> = ({ visible, onClose, onNavigateToLearn }) => {
    // Demo airdrops
    const airdrops = [
        { id: '1', name: 'Arbitrum ARB', status: 'Claimed', amount: '625 ARB', value: '$437', emoji: '🔶' },
        { id: '2', name: 'Optimism OP', status: 'Claimable', amount: '150 OP', value: '$225', emoji: '🔴' },
        { id: '3', name: 'LayerZero ZRO', status: 'Eligible', amount: '~500 ZRO', value: 'TBD', emoji: '🌐' },
        { id: '4', name: 'Scroll SCR', status: 'Ineligible', amount: '-', value: '-', emoji: '📜' },
    ];

    const rewards = [
        { id: '1', protocol: 'Aave', type: 'Lending rewards', amount: '12.5 AAVE', value: '$1,125', emoji: '👻' },
        { id: '2', protocol: 'Uniswap', type: 'LP fees', amount: '$234', value: '$234', emoji: '🦄' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalContainer}>
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleRow}>
                            <Text style={{ fontSize: 24 }}>🎁</Text>
                            <Text style={styles.modalTitle}>Airdrops & Rewards</Text>
                            <InfoTooltip category="airdrops" onLearnMore={onNavigateToLearn} />
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        {/* Summary */}
                        <View style={styles.rewardsSummary}>
                            <View style={styles.rewardBox}>
                                <Text style={styles.rewardBoxValue}>$662</Text>
                                <Text style={styles.rewardBoxLabel}>Claimable Now</Text>
                            </View>
                            <View style={styles.rewardBox}>
                                <Text style={styles.rewardBoxValue}>$1,359</Text>
                                <Text style={styles.rewardBoxLabel}>Total Earned</Text>
                            </View>
                        </View>

                        {/* Airdrops */}
                        <Text style={styles.sectionTitle}>Airdrops</Text>
                        {airdrops.map((drop, index) => (
                            <Animated.View
                                key={drop.id}
                                entering={FadeInDown.delay(index * 80).duration(300)}
                            >
                                <View style={styles.airdropCard}>
                                    <View style={styles.airdropLeft}>
                                        <Text style={{ fontSize: 24 }}>{drop.emoji}</Text>
                                        <View style={styles.airdropInfo}>
                                            <Text style={styles.airdropName}>{drop.name}</Text>
                                            <Text style={styles.airdropAmount}>{drop.amount}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.airdropRight}>
                                        {drop.status === 'Claimable' ? (
                                            <TouchableOpacity style={styles.claimBtn}>
                                                <Text style={styles.claimBtnText}>Claim</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={[
                                                styles.statusBadge,
                                                drop.status === 'Claimed' && styles.claimedBadge,
                                                drop.status === 'Eligible' && styles.eligibleBadge,
                                                drop.status === 'Ineligible' && styles.ineligibleBadge,
                                            ]}>
                                                <Text style={styles.statusBadgeText}>{drop.status}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Animated.View>
                        ))}

                        {/* Protocol Rewards */}
                        <Text style={styles.sectionTitle}>Protocol Rewards</Text>
                        {rewards.map((reward, index) => (
                            <Animated.View
                                key={reward.id}
                                entering={FadeInDown.delay((airdrops.length + index) * 80).duration(300)}
                            >
                                <TouchableOpacity style={styles.rewardCard}>
                                    <View style={styles.rewardLeft}>
                                        <Text style={{ fontSize: 24 }}>{reward.emoji}</Text>
                                        <View style={styles.rewardInfo}>
                                            <Text style={styles.rewardProtocol}>{reward.protocol}</Text>
                                            <Text style={styles.rewardType}>{reward.type}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.rewardRight}>
                                        <Text style={styles.rewardAmount}>{reward.amount}</Text>
                                        <Text style={styles.rewardValue}>{reward.value}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        {/* Check Eligibility */}
                        <TouchableOpacity style={styles.checkEligibilityBtn}>
                            <Ionicons name="search" size={20} color="#fff" />
                            <Text style={styles.checkEligibilityText}>Check New Eligibility</Text>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
    // Modal Base
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingTop: Spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    modalTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    modalScroll: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    categoryDescription: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.lg,
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
    },
    statValue: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    statLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 4,
    },

    // NFT Grid
    nftGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    nftCard: {
        width: '48%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    nftImagePlaceholder: {
        height: 120,
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    nftName: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    nftCollection: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    nftFloor: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        marginTop: 4,
    },

    // Action Row
    actionRow: {
        marginTop: Spacing.lg,
    },
    actionBtn: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
    },
    actionBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Category Tabs
    categoryTabs: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    categoryTab: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surface,
    },
    categoryTabActive: {
        backgroundColor: Colors.primary,
    },
    categoryTabText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    categoryTabTextActive: {
        color: '#fff',
        fontWeight: '600',
    },

    // Asset Cards
    assetCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    assetIcon: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assetInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    assetName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    assetProtocol: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    assetApy: {
        alignItems: 'flex-end',
    },
    apyValue: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: '#22C55E',
    },
    apyLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Voting Power
    votingPowerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    votingPowerLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    votingPowerValue: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.primary,
        marginTop: 4,
    },
    votingTokens: {
        alignItems: 'flex-end',
    },
    votingToken: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Proposal Cards
    proposalCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    proposalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    proposalDao: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        flex: 1,
    },
    proposalStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    statusActive: {
        backgroundColor: '#22C55E20',
    },
    statusEnded: {
        backgroundColor: Colors.surfaceElevated,
    },
    proposalStatusText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.textMuted,
    },
    proposalTitle: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    voteBarContainer: {
        height: 8,
        backgroundColor: '#EF444430',
        borderRadius: 4,
        overflow: 'hidden',
    },
    voteBarFor: {
        height: '100%',
        backgroundColor: '#22C55E',
        borderRadius: 4,
    },
    voteLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    voteFor: {
        fontSize: Typography.fontSize.xs,
        color: '#22C55E',
    },
    voteAgainst: {
        fontSize: Typography.fontSize.xs,
        color: '#EF4444',
    },
    voteButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    voteForBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#22C55E',
        paddingVertical: 10,
        borderRadius: BorderRadius.md,
    },
    voteAgainstBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#EF4444',
        paddingVertical: 10,
        borderRadius: BorderRadius.md,
    },
    voteBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },

    // Portfolio Summary
    portfolioSummary: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    portfolioMain: {
        flex: 2,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    portfolioLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    portfolioValue: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginTop: 4,
    },
    portfolioEarned: {
        flex: 1,
        backgroundColor: '#22C55E15',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    earnedLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    earnedValue: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: '#22C55E',
        marginTop: 4,
    },

    // Position Cards
    positionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    positionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    positionInfo: {
        gap: 4,
    },
    positionProtocol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    positionTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    positionTypeBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    borrowBadge: {
        backgroundColor: '#EF444420',
    },
    positionTypeText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        fontWeight: '500',
    },
    positionAsset: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    positionRight: {
        alignItems: 'flex-end',
    },
    positionValue: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    borrowValue: {
        color: '#EF4444',
    },
    positionApy: {
        fontSize: Typography.fontSize.sm,
        marginTop: 2,
    },
    earnApy: {
        color: '#22C55E',
    },
    borrowApy: {
        color: '#EF4444',
    },

    // Quick Actions
    quickActions: {
        marginTop: Spacing.lg,
    },
    quickActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary + '15',
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
    },
    quickActionText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.primary,
    },

    // Cross-chain
    totalPortfolio: {
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    totalLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    totalValue: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginTop: 4,
    },
    totalChange: {
        fontSize: Typography.fontSize.sm,
        color: '#22C55E',
        marginTop: 4,
    },
    distributionBar: {
        flexDirection: 'row',
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    distributionSegment: {
        height: '100%',
    },
    chainCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    chainLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    chainInfo: {
        flex: 1,
        gap: 6,
    },
    chainName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    chainBar: {
        height: 4,
        borderRadius: 2,
        maxWidth: 100,
    },
    chainRight: {
        alignItems: 'flex-end',
    },
    chainValue: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    chainPercentage: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    bridgeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.lg,
    },
    bridgeBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Airdrops
    rewardsSummary: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    rewardBox: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
    },
    rewardBoxValue: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: '#22C55E',
    },
    rewardBoxLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 4,
    },
    airdropCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    airdropLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    airdropInfo: {},
    airdropName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    airdropAmount: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginTop: 2,
    },
    airdropRight: {},
    claimBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: BorderRadius.md,
    },
    claimBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    claimedBadge: {
        backgroundColor: Colors.surfaceElevated,
    },
    eligibleBadge: {
        backgroundColor: '#22C55E20',
    },
    ineligibleBadge: {
        backgroundColor: '#EF444420',
    },
    statusBadgeText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.textMuted,
    },
    rewardCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    rewardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rewardInfo: {},
    rewardProtocol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    rewardType: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginTop: 2,
    },
    rewardRight: {
        alignItems: 'flex-end',
    },
    rewardAmount: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    rewardValue: {
        fontSize: Typography.fontSize.sm,
        color: '#22C55E',
        marginTop: 2,
    },
    checkEligibilityBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.lg,
    },
    checkEligibilityText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Info Tooltip Styles
    infoIconBtn: {
        padding: 4,
        marginLeft: 4,
    },
    tooltipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    tooltipContent: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        maxWidth: 340,
        width: '100%',
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    tooltipTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        flex: 1,
    },
    tooltipDescription: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    tooltipActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    tooltipDismiss: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surfaceElevated,
        alignItems: 'center',
    },
    tooltipDismissText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    tooltipLearnMore: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: 12,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
    },
    tooltipLearnMoreText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
});
