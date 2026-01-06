// Deal Detail Screen

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Linking,
    Share,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Deal } from '../types';
import { CATEGORY_LABELS, AREA_LABELS } from '../constants/categories';

type RootStackParamList = {
    Home: undefined;
    AddDeal: undefined;
    Settings: undefined;
    DealDetail: { deal: Deal };
};

interface DealDetailScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'DealDetail'>;
    route: RouteProp<RootStackParamList, 'DealDetail'>;
}

export function DealDetailScreen({ navigation, route }: DealDetailScreenProps) {
    const { deal } = route.params;

    const hasDiscount = deal.originalPrice && deal.price && deal.originalPrice > deal.price;
    const discountPercent = hasDiscount
        ? Math.round((1 - deal.price! / deal.originalPrice!) * 100)
        : null;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this deal: ${deal.title}\n${deal.description}\n${deal.price ? `$${deal.price}` : ''}`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare}>
                    <Text style={styles.shareButton}>Share</Text>
                </TouchableOpacity>
            </View>

            {/* Image */}
            {deal.imageUri ? (
                <Image source={{ uri: deal.imageUri }} style={styles.image} />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderIcon}>🏷️</Text>
                </View>
            )}

            {/* Content */}
            <View style={styles.content}>
                {/* Category & Discount */}
                <View style={styles.tagRow}>
                    <View style={styles.categoryTag}>
                        <Text style={styles.categoryText}>
                            {CATEGORY_LABELS[deal.category as keyof typeof CATEGORY_LABELS] || deal.category}
                        </Text>
                    </View>
                    {discountPercent && (
                        <View style={styles.discountTag}>
                            <Text style={styles.discountText}>{discountPercent}% OFF</Text>
                        </View>
                    )}
                </View>

                {/* Title */}
                <Text style={styles.title}>{deal.title}</Text>

                {/* Price */}
                <View style={styles.priceContainer}>
                    {deal.price !== undefined && (
                        <Text style={styles.price}>${deal.price.toFixed(2)}</Text>
                    )}
                    {hasDiscount && (
                        <Text style={styles.originalPrice}>
                            ${deal.originalPrice!.toFixed(2)}
                        </Text>
                    )}
                </View>

                {/* Description */}
                <Text style={styles.description}>{deal.description}</Text>

                {/* Meta Info */}
                <View style={styles.metaSection}>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Source</Text>
                        <Text style={styles.metaValue}>
                            {deal.source === 'kijiji' ? '🟠 Kijiji' :
                                deal.source === 'facebook' ? '🔵 Facebook' : '📝 Manual'}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Location</Text>
                        <Text style={styles.metaValue}>
                            {AREA_LABELS[deal.location] || deal.location}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Added</Text>
                        <Text style={styles.metaValue}>
                            {new Date(deal.createdAt).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </Text>
                    </View>

                    {deal.expiresAt && (
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Expires</Text>
                            <Text style={[styles.metaValue, styles.expiryValue]}>
                                {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 16,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    backButton: {
        fontSize: 16,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    shareButton: {
        fontSize: 16,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    image: {
        width: '100%',
        height: 300,
        backgroundColor: '#1E1E2E',
    },
    imagePlaceholder: {
        width: '100%',
        height: 200,
        backgroundColor: '#1E1E2E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderIcon: {
        fontSize: 64,
    },
    content: {
        padding: 24,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    categoryTag: {
        backgroundColor: '#2D2D3D',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    categoryText: {
        color: '#A0A0B0',
        fontSize: 13,
        fontWeight: '500',
    },
    discountTag: {
        backgroundColor: '#FF6B35',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    discountText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 12,
        lineHeight: 32,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    price: {
        fontSize: 32,
        fontWeight: '700',
        color: '#4ADE80',
    },
    originalPrice: {
        fontSize: 20,
        color: '#6B6B7B',
        textDecorationLine: 'line-through',
    },
    description: {
        fontSize: 16,
        color: '#B0B0C0',
        lineHeight: 24,
        marginBottom: 32,
    },
    metaSection: {
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        padding: 20,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D3D',
    },
    metaLabel: {
        fontSize: 15,
        color: '#8B8B9B',
    },
    metaValue: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    expiryValue: {
        color: '#FF6B35',
    },
});
