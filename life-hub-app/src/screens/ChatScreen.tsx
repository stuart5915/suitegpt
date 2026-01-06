import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Text,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MessageBubble, ChatInput, TypingIndicator, SuggestionPills } from '../components';
import { Message } from '../types';
import { generateAIResponse } from '../lib/ai';
import { COLORS, SPACING } from '../constants';

const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `👋 Welcome to Life Hub!

I'm your personal AI assistant connected to all your apps. I can help you with:

• 🏋️ Workout & rehab insights (TrueForm, OpticRep)
• 🥗 Nutrition tracking (FoodVital)
• 🙏 Bible reflections (Cheshbon)
• 💭 Dream patterns (REMcast)
• 💰 Hot local deals (Deals)`,
    timestamp: new Date(),
};

export function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Show suggestions only when there's just the welcome message
    const showSuggestions = messages.length === 1;

    const handleSend = useCallback(async (text: string) => {
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        // Scroll to bottom
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            const response = await generateAIResponse(text, messages);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                suiteCost: 0, // Free for now
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    const handleSuggestionSelect = useCallback((suggestion: string) => {
        handleSend(suggestion);
    }, [handleSend]);

    const renderItem = useCallback(({ item }: { item: Message }) => (
        <MessageBubble message={item} />
    ), []);

    const keyExtractor = useCallback((item: Message) => item.id, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Life Hub</Text>
                <Text style={styles.headerSubtitle}>Your Personal AI Brain</Text>
            </View>

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                        <>
                            {isLoading && <TypingIndicator />}
                            <SuggestionPills
                                onSelect={handleSuggestionSelect}
                                visible={showSuggestions && !isLoading}
                            />
                        </>
                    }
                />

                <ChatInput onSend={handleSend} disabled={isLoading} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surface,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.cyan,
        marginTop: 2,
    },
    content: {
        flex: 1,
    },
    messageList: {
        flex: 1,
    },
    messageListContent: {
        paddingVertical: SPACING.md,
    },
});
