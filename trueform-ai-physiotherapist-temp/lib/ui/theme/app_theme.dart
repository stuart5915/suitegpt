import 'package:flutter/material.dart';

/// App theme for AI Chiropractic Assistant
/// Modern, professional healthcare aesthetic
class AppTheme {
  // Primary brand colors
  static const primaryColor = Color(0xFF0D47A1); // Deep blue
  static const secondaryColor = Color(0xFF00BCD4); // Cyan accent
  static const accentColor = Color(0xFF4CAF50); // Health green
  
  // Semantic colors
  static const errorColor = Color(0xFFE53935);
  static const warningColor = Color(0xFFFF9800);
  static const successColor = Color(0xFF4CAF50);
  
  // Surface colors
  static const surfaceDark = Color(0xFF1A1A2E);
  static const surfaceLight = Color(0xFFF5F5F5);
  
  // Pose overlay colors
  static const skeletonColor = Color(0xFF00E676); // Bright green for visibility
  static const jointColor = Color(0xFF00BCD4);
  static const issueHighlightColor = Color(0xFFFF5722);
  
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceDark,
        error: errorColor,
      ),
      scaffoldBackgroundColor: surfaceDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceDark.withAlpha(200),
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white10,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
  
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceLight,
        error: errorColor,
      ),
      scaffoldBackgroundColor: surfaceLight,
    );
  }
}
