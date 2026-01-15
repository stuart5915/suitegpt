import React, { useState, useRef, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { chatWithInsights, NutritionContext } from '../services/gemini';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
}

interface InsightsModalProps {
    visible: boolean;
    onClose: () => void;
    context: NutritionContext;
}

const QUICK_PROMPTS = [
    "How's my week going?",
    "What should I eat next?",
    "Am I missing any nutrients?",
    "Give me a meal idea",
];

export default function InsightsModal({ visible, onClose, context }: InsightsModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // Reset messages when modal opens
    useEffect(() => {
        if (visible) {
            setMessages([
                {
                    id: 'welcome',
                    text: "Hi! I'm your nutrition assistant. Ask me anything about your meals, nutrition gaps, or get personalized advice! 🥗",
                    isUser: false,
                },
            ]);
        }
    }, [visible]);

    const handleSend = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: text.trim(),
            isUser: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await chatWithInsights(text.trim(), context);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response,
                isUser: false,
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I couldn't process that. Please try again!",
                isUser: false,
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickPrompt = (prompt: string) => {
        handleSend(prompt);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerIcon}>✨</Text>
                        <Text style={styles.headerTitle}>Insights</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageBubble,
                                message.isUser ? styles.userBubble : styles.aiBubble,
                            ]}
                        >
                            <Text style={[
                                styles.messageText,
                                message.isUser ? styles.userText : styles.aiText,
                            ]}>
                                {message.text}
                            </Text>
                        </View>
                    ))}

                    {isLoading && (
                        <View style={[styles.messageBubble, styles.aiBubble]}>
                            <ActivityIndicator size="small" color="#4ADE80" />
                        </View>
                    )}
                </ScrollView>

                {/* Quick Prompts */}
                {messages.length <= 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.quickPromptsContainer}
                        contentContainerStyle={styles.quickPromptsContent}
                    >
                        {QUICK_PROMPTS.map((prompt, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.quickPromptButton}
                                onPress={() => handleQuickPrompt(prompt)}
                            >
                                <Text style={styles.quickPromptText}>{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Input Area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ask about your nutrition..."
                            placeholderTextColor="#666"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                            onSubmitEditing={() => handleSend(inputText)}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                            onPress={() => handleSend(inputText)}
                            disabled={!inputText.trim() || isLoading}
                        >
                            <Ionicons
                                name="send"
                                size={20}
                                color={inputText.trim() ? '#fff' : '#666'}
                            />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A1A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIcon: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 18,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#4ADE80',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: '#000',
    },
    aiText: {
        color: '#fff',
    },
    quickPromptsContainer: {
        maxHeight: 50,
        marginBottom: 8,
    },
    quickPromptsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    quickPromptButton: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
        marginRight: 8,
    },
    quickPromptText: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        gap: 12,
    },
    textInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4ADE80',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});
