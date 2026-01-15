/**
 * Bottom Navigation - REMcast 5-Tab Layout
 * Feed | My Dreams | Record (center) | Explore | Profile
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { Colors, Spacing } from '../../constants/theme';

export function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    return (
        <View style={styles.container}>
            {/* Feed */}
            <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.replace('/home')}
            >
                <Ionicons
                    name={isActive('/home') ? 'planet' : 'planet-outline'}
                    size={22}
                    color={isActive('/home') ? Colors.dreamPurple : Colors.fog}
                />
                <Typography
                    variant="caption"
                    color={isActive('/home') ? Colors.dreamPurple : Colors.fog}
                    style={[styles.label, isActive('/home') && styles.activeText]}
                >
                    Feed
                </Typography>
            </TouchableOpacity>

            {/* My Dreams */}
            <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.replace('/journal')}
            >
                <Ionicons
                    name={isActive('/journal') ? 'film' : 'film-outline'}
                    size={22}
                    color={isActive('/journal') ? Colors.dreamPurple : Colors.fog}
                />
                <Typography
                    variant="caption"
                    color={isActive('/journal') ? Colors.dreamPurple : Colors.fog}
                    style={[styles.label, isActive('/journal') && styles.activeText]}
                >
                    My Dreams
                </Typography>
            </TouchableOpacity>

            {/* Record (Center - prominent) */}
            <TouchableOpacity
                style={styles.recordButton}
                onPress={() => router.replace('/setup')}
            >
                <View style={[styles.recordCircle, isActive('/setup') && styles.recordCircleActive]}>
                    <Ionicons name="mic" size={26} color={Colors.starlight} />
                </View>
            </TouchableOpacity>

            {/* Explore (placeholder for future) */}
            <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.replace('/home')}
            >
                <Ionicons
                    name="compass-outline"
                    size={22}
                    color={Colors.fog}
                />
                <Typography
                    variant="caption"
                    color={Colors.fog}
                    style={styles.label}
                >
                    Explore
                </Typography>
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.replace('/profile')}
            >
                <Ionicons
                    name={isActive('/profile') ? 'person' : 'person-outline'}
                    size={22}
                    color={isActive('/profile') ? Colors.dreamPurple : Colors.fog}
                />
                <Typography
                    variant="caption"
                    color={isActive('/profile') ? Colors.dreamPurple : Colors.fog}
                    style={[styles.label, isActive('/profile') && styles.activeText]}
                >
                    Profile
                </Typography>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.void,
        borderTopWidth: 1,
        borderTopColor: Colors.nebula,
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingTop: 8,
        paddingBottom: 24,
        paddingHorizontal: 8,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    label: {
        fontSize: 10,
    },
    activeText: {
        fontWeight: '600',
    },
    recordButton: {
        flex: 1,
        alignItems: 'center',
        marginTop: -24,
    },
    recordCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.dreamPurple,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.dreamPurple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    recordCircleActive: {
        backgroundColor: Colors.deepViolet,
    },
});
