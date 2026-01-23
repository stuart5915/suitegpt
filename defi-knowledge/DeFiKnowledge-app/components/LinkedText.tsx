// LinkedText Component
// Parses text and makes [[term]] references tappable with accent color styling

import React, { useMemo } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { Colors, Typography } from '@/constants/Colors';
import { useTerminologyStore } from '@/context/TerminologyContext';
import { findTerm } from '@/lib/terminology';

interface LinkedTextProps {
    children: string;
    style?: TextStyle;
}

interface TextPart {
    type: 'text' | 'link';
    content: string;
    termName?: string;
}

export function LinkedText({ children, style }: LinkedTextProps) {
    const openTerm = useTerminologyStore((state) => state.openTerm);

    // Parse text to find [[term]] patterns
    const parts = useMemo<TextPart[]>(() => {
        const regex = /\[\[([^\]]+)\]\]/g;
        const result: TextPart[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(children)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                result.push({
                    type: 'text',
                    content: children.slice(lastIndex, match.index),
                });
            }

            // Add the linked term
            const termName = match[1];
            const termExists = findTerm(termName) !== undefined;

            result.push({
                type: termExists ? 'link' : 'text',
                content: termName,
                termName: termExists ? termName : undefined,
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < children.length) {
            result.push({
                type: 'text',
                content: children.slice(lastIndex),
            });
        }

        return result;
    }, [children]);

    return (
        <Text style={[styles.text, style]}>
            {parts.map((part, index) => {
                if (part.type === 'link' && part.termName) {
                    return (
                        <Text
                            key={index}
                            style={styles.link}
                            onPress={() => openTerm(part.termName!)}
                        >
                            {part.content}
                        </Text>
                    );
                }
                return <Text key={index}>{part.content}</Text>;
            })}
        </Text>
    );
}

const styles = StyleSheet.create({
    text: {
        fontSize: Typography.fontSize.base,
        lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
        color: Colors.textPrimary,
    },
    link: {
        color: Colors.primary,
        fontWeight: '500',
    },
});
