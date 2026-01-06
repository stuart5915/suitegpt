// DealCard component for displaying individual deals

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Deal } from '../types';
import { CATEGORY_LABELS, AREA_LABELS } from '../constants/categories';

interface DealCardProps {
    deal: Deal;
    onPress?: (deal: Deal) => void;
    onDelete?: (dealId: string) => void;
}

export function DealCard({ deal, onPress, onDelete }: DealCardProps) {
    const hasDiscount = deal.originalPrice && deal.price && deal.originalPrice > deal.price;
    const discountPercent = hasDiscount
        ? Math.round((1 - deal.price! / deal.originalPrice!) * 100)
        : null;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => onPress?.(deal)}
            activeOpacity={0.7}
        >
            {deal.imageUri && (
                <Image source={{ uri: deal.imageUri }} style={styles.image} />
            )}

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.category}>
                        {CATEGORY_LABELS[deal.category as keyof typeof CATEGORY_LABELS] || deal.category}
                    </Text>
                    {discountPercent && (
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>{discountPercent}% OFF</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.title} numberOfLines={2}>
                    {deal.title}
                </Text>

                <Text style={styles.description} numberOfLines={2}>
                    {deal.description}
                </Text>

                <View style={styles.footer}>
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

                    <Text style={styles.location}>
                        {AREA_LABELS[deal.location] || deal.location}
                    </Text>
                </View>

                <View style={styles.meta}>
                    <Text style={styles.source}>
                        {deal.source === 'kijiji' ? '🟠 Kijiji' :
                            deal.source === 'facebook' ? '🔵 Facebook' : '📝 Manual'}
                    </Text>
                    <Text style={styles.date}>
                        {new Date(deal.createdAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>

            {onDelete && (
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDelete(deal.id)}
                >
                    <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    image: {
        width: '100%',
        height: 160,
        backgroundColor: '#2D2D3D',
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    category: {
        fontSize: 12,
        color: '#A0A0B0',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    discountBadge: {
        backgroundColor: '#FF6B35',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    discountText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    description: {
        fontSize: 14,
        color: '#B0B0C0',
        lineHeight: 20,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    price: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4ADE80',
    },
    originalPrice: {
        fontSize: 14,
        color: '#6B6B7B',
        textDecorationLine: 'line-through',
    },
    location: {
        fontSize: 12,
        color: '#8B8B9B',
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#2D2D3D',
        paddingTop: 8,
    },
    source: {
        fontSize: 12,
        color: '#7B7B8B',
    },
    date: {
        fontSize: 12,
        color: '#7B7B8B',
    },
    deleteButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
