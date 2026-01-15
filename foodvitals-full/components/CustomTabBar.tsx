import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomTabBarProps {
    state: any;
    descriptors: any;
    navigation: any;
}

const TAB_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
    index: 'home',
    history: 'time',
    scan: 'add',
    insights: 'sparkles',
    profile: 'person',
};

const TAB_LABELS: { [key: string]: string } = {
    index: 'Home',
    history: 'History',
    scan: '',
    insights: 'Insights',
    profile: 'Profile',
};

export default function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.wrapper}>
            {/* Border at the very top */}
            <View style={styles.borderLine} />

            {/* Tab content */}
            <View style={styles.tabsRow}>
                {state.routes.map((route: any, index: number) => {
                    const isFocused = state.index === index;
                    const isScan = route.name === 'scan';

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    if (isScan) {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={onPress}
                                style={styles.scanButton}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.scanCircle, isFocused && styles.scanCircleFocused]}>
                                    <Ionicons name="add" size={24} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tab}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={TAB_ICONS[route.name]}
                                size={22}
                                color={isFocused ? '#4ADE80' : '#666'}
                            />
                            <Text style={[styles.label, isFocused && styles.labelFocused]}>
                                {TAB_LABELS[route.name]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Safe area spacer */}
            <View style={{ height: insets.bottom, backgroundColor: '#0A0A1A' }} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: '#0A0A1A',
    },
    borderLine: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabsRow: {
        flexDirection: 'row',
        height: 50,
        alignItems: 'center',
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        color: '#666',
        marginTop: 2,
    },
    labelFocused: {
        color: '#4ADE80',
    },
    scanButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4ADE80',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanCircleFocused: {
        backgroundColor: '#22C55E',
    },
});
