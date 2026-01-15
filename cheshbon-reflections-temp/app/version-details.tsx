
import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { BibleVersionsService, BibleVersion, UserBibleVersion } from '../services/bibleVersions';
import { Spacing, Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VersionDetails() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    const [version, setVersion] = useState<BibleVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdded, setIsAdded] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        if (id) {
            loadVersionDetails(id);
        }
    }, [id]);

    const loadVersionDetails = async (versionId: string) => {
        setLoading(true);
        try {
            // Check if already added
            const added = await BibleVersionsService.getAddedVersions();
            const existing = added.find(v => v.id === versionId);
            if (existing) {
                setIsAdded(true);
            }

            // Fetch details
            const details = await BibleVersionsService.getVersion(versionId);
            setVersion(details);
        } catch (error) {
            console.error('Failed to load version details', error);
            Alert.alert('Error', 'Failed to load version details');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!version) return;

        setDownloading(true);

        // Simulate download progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 0.1;
            setDownloadProgress(progress);
            if (progress >= 1) {
                clearInterval(interval);
                completeDownload();
            }
        }, 150);
    };

    const completeDownload = async () => {
        if (!version) return;
        try {
            await BibleVersionsService.addVersion(version);
            setIsAdded(true);
            setDownloading(false);
            Alert.alert('Success', `${version.abbreviation} has been added to your versions.`);
        } catch (error) {
            console.error('Error adding version', error);
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#F2F2F7', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={isDarkMode ? '#FFF' : '#000'} />
            </View>
        );
    }

    if (!version) {
        return (
            <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#F2F2F7', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: isDarkMode ? '#FFF' : '#000' }}>Version not found</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#F2F2F7', paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={[styles.backIcon, { color: isDarkMode ? '#FFF' : '#000' }]}>‹ Back</Text>
                </TouchableOpacity>
                <View style={[styles.dragHandle, { backgroundColor: isDarkMode ? '#333' : '#CCC' }]} />
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Large Badge */}
                <View style={[styles.badgeContainer, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}>
                    <Text style={[styles.badgeText, { color: isDarkMode ? '#FFF' : '#000' }]}>
                        {version.abbreviation}
                    </Text>
                </View>

                {/* Info Text */}
                <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#000' }]}>
                    {version.name}
                </Text>
                <Text style={[styles.subtitle, { color: isDarkMode ? '#8E8E93' : '#666' }]}>
                    {/* Mock Publisher if undefined */}
                    Unknown Publisher • {version.language.name}
                </Text>
                <Text style={[styles.fileSize, { color: isDarkMode ? '#8E8E93' : '#666' }]}>
                    📁 4.3 MB
                </Text>

                {/* Actions */}
                <View style={styles.buttonsContainer}>
                    {!isAdded ? (
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: isDarkMode ? '#FFF' : '#000' }]}
                            onPress={handleAdd}
                            disabled={downloading}
                        >
                            {downloading ? (
                                <Text style={[styles.addButtonText, { color: isDarkMode ? '#000' : '#FFF' }]}>
                                    Downloading {Math.round(downloadProgress * 100)}%
                                </Text>
                            ) : (
                                <Text style={[styles.addButtonText, { color: isDarkMode ? '#000' : '#FFF' }]}>
                                    ⊕ Add
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.addedButton, { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}>
                            <Text style={[styles.addButtonText, { color: isDarkMode ? '#FFF' : '#000' }]}>
                                ✓ Added
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.sampleButton, { borderColor: isDarkMode ? '#333' : '#CCC' }]}
                        onPress={() => Alert.alert('Sample', 'Preview feature coming soon.')}
                    >
                        <Text style={[styles.sampleButtonText, { color: isDarkMode ? '#FFF' : '#000' }]}>
                            Sample
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* More From Publisher */}
                <TouchableOpacity style={[styles.moreRow, { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFF' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.gridIcon, { backgroundColor: isDarkMode ? '#555' : '#DDD' }]}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center', alignContent: 'center', height: '100%', padding: 4 }}>
                                <View style={{ width: 6, height: 6, backgroundColor: isDarkMode ? '#FFF' : '#666' }} />
                                <View style={{ width: 6, height: 6, backgroundColor: isDarkMode ? '#FFF' : '#666' }} />
                                <View style={{ width: 6, height: 6, backgroundColor: isDarkMode ? '#FFF' : '#666' }} />
                                <View style={{ width: 6, height: 6, backgroundColor: isDarkMode ? '#FFF' : '#666' }} />
                            </View>
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={[styles.moreLabel, { color: isDarkMode ? '#8E8E93' : '#999' }]}>More from</Text>
                            <Text style={[styles.moreValue, { color: isDarkMode ? '#FFF' : '#000' }]}>Publisher</Text>
                        </View>
                    </View>
                    <Text style={[styles.iconText, { color: isDarkMode ? '#666' : '#CCC' }]}>›</Text>
                </TouchableOpacity>

                {/* Details Section */}
                <View style={styles.detailsSection}>
                    <Text style={[styles.detailsHeader, { color: isDarkMode ? '#FFF' : '#000' }]}>Details</Text>

                    <TouchableOpacity onPress={() => Linking.openURL('http://www.bible.com')}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                            <Text style={{ fontSize: 18, marginRight: 8, color: isDarkMode ? '#FFF' : '#000' }}>🌐</Text>
                            <Text style={{ color: isDarkMode ? '#FFF' : '#000', fontSize: 14 }}>Visit Publisher Website</Text>
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.copyrightText, { color: isDarkMode ? '#8E8E93' : '#666' }]}>
                        {version.copyright || 'Copyright info not available.'}
                        {'\n\n'}
                        This digital work contains the Holy Bible, {version.name}, copyright © {new Date().getFullYear()} by Publisher.
                        Used by permission. All rights reserved.
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    backButton: {
        paddingVertical: 8,
    },
    backIcon: {
        fontSize: 18,
        fontWeight: '500',
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
    },
    content: {
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
    },
    badgeContainer: {
        width: 120,
        height: 120,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        marginTop: Spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    badgeText: {
        fontSize: 28,
        fontWeight: '700',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    fileSize: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 32,
    },
    buttonsContainer: {
        width: '100%',
        gap: Spacing.md,
        marginBottom: 32,
    },
    addButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    addedButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    sampleButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        borderWidth: 1,
    },
    sampleButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    moreRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 32,
    },
    gridIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    moreLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    moreValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    iconText: {
        fontSize: 24,
    },
    detailsSection: {
        width: '100%',
    },
    detailsHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    copyrightText: {
        fontSize: 14,
        lineHeight: 22,
        marginTop: 16,
    },
});
