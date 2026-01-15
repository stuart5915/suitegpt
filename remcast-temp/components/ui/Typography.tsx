import { Text, StyleSheet, TextStyle, StyleProp, TextProps } from 'react-native';
import { Colors, FontSizes, FontFamilies } from '../../constants/theme';

interface TypographyProps extends TextProps {
    children: React.ReactNode;
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'scripture';
    color?: string;
    style?: StyleProp<TextStyle>;
}

export function Typography({ children, variant = 'body', color, style, ...props }: TypographyProps) {
    return <Text style={[styles[variant], color && { color }, style]} {...props}>{children}</Text>;
}

const styles = StyleSheet.create({
    h1: {
        fontFamily: FontFamilies.serifBold,
        fontSize: FontSizes['4xl'],
        color: Colors.charcoal,
        lineHeight: FontSizes['4xl'] * 1.2,
    },
    h2: {
        fontFamily: FontFamilies.serifBold,
        fontSize: FontSizes['3xl'],
        color: Colors.charcoal,
        lineHeight: FontSizes['3xl'] * 1.2,
    },
    h3: {
        fontFamily: FontFamilies.serif,
        fontSize: FontSizes['2xl'],
        color: Colors.charcoal,
        lineHeight: FontSizes['2xl'] * 1.3,
    },
    body: {
        fontFamily: FontFamilies.sans,
        fontSize: FontSizes.base,
        color: Colors.charcoal,
        lineHeight: FontSizes.base * 1.5,
    },
    caption: {
        fontFamily: FontFamilies.sans,
        fontSize: FontSizes.sm,
        color: Colors.mediumGray,
        lineHeight: FontSizes.sm * 1.4,
    },
    scripture: {
        fontFamily: FontFamilies.serifItalic,
        fontSize: FontSizes.lg,
        color: Colors.softBlack,
        lineHeight: FontSizes.lg * 1.6,
    },
});
