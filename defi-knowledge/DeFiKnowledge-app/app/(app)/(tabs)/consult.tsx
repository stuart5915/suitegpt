import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Linking,
    Image,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { sendChatMessage, ChatMessage } from '@/lib/gemini';
import { useAuth } from '@/context/AuthContext'; // Maybe use for personalized greeting if available

export default function ConsultScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: "Hello! I'm your DeFi AI assistant. How can I help you understand decentralized finance today?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message
        const newHistory = [...messages, { role: 'user', text: userMessage } as ChatMessage];
        setMessages(newHistory);
        setLoading(true);

        // Get AI response
        const responseText = await sendChatMessage(messages, userMessage);

        setLoading(false);
        if (responseText) {
            setMessages([...newHistory, { role: 'model', text: responseText }]);
        }
    };

    const openForgeDiscord = () => {
        // Link to the specific discord
        Linking.openURL('https://discord.gg/getsuite');
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.modelBubble,
            ]}>
                {!isUser && (
                    <View style={styles.botIconConfig}>
                        <Ionicons name="sparkles" size={16} color={Colors.primary} />
                    </View>
                )}
                <Text style={[
                    styles.messageText,
                    isUser ? styles.userText : styles.modelText
                ]}>
                    {item.text}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>AI Consultant</Text>
                <TouchableOpacity onPress={openForgeDiscord} style={styles.discordBtn}>
                    <Ionicons name="logo-discord" size={16} color="#fff" />
                    <Text style={styles.discordBtnText}>Talk to Human</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={styles.messageList}
                style={styles.list}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.primary} size="small" />
                    <Text style={styles.loadingText}>Thinking...</Text>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                style={styles.inputContainer}
            >
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask about DeFi, staking, or wallets..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim() || loading}
                >
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    discordBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#5865F2', // Discord Brand Color
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.full,
        gap: Spacing.xs,
    },
    discordBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: Typography.fontSize.xs,
    },
    list: {
        flex: 1,
    },
    messageList: {
        padding: Spacing.md,
        gap: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 2,
    },
    modelBubble: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.surface,
        borderBottomLeftRadius: 2,
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    botIconConfig: {
        marginRight: 4,
        marginTop: 2,
    },
    messageText: {
        fontSize: Typography.fontSize.base,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    modelText: {
        color: Colors.textPrimary,
        flex: 1,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    loadingText: {
        color: Colors.textMuted,
        fontSize: Typography.fontSize.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        alignItems: 'flex-end',
        gap: Spacing.md,
    },
    input: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        color: Colors.textPrimary,
        fontSize: Typography.fontSize.base,
        maxHeight: 100,
        minHeight: 44,
    },
    sendBtn: {
        backgroundColor: Colors.primary,
        width: 44,
        height: 44,
        borderRadius: BorderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: Colors.border,
        opacity: 0.5,
    },
});
