import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for TrueForm AI Physiotherapist.
/// 
/// Generated from Firebase console settings.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError('macOS not configured');
      case TargetPlatform.windows:
        throw UnsupportedError('Windows not configured');
      case TargetPlatform.linux:
        throw UnsupportedError('Linux not configured');
      default:
        throw UnsupportedError('Unknown platform');
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCNhjmOOygtaK6eQ5pTmQjTy7rERt__gPg',
    appId: '1:90086422666:web:f5c5bf2f9b86f0447bd573',
    messagingSenderId: '90086422666',
    projectId: 'trueform-ai-physiotherapist',
    authDomain: 'trueform-ai-physiotherapist.firebaseapp.com',
    storageBucket: 'trueform-ai-physiotherapist.firebasestorage.app',
    measurementId: 'G-EKEDHHPVVX',
  );

  // TODO: Add Android config when building for Android
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'YOUR-ANDROID-API-KEY',
    appId: 'YOUR-ANDROID-APP-ID',
    messagingSenderId: '90086422666',
    projectId: 'trueform-ai-physiotherapist',
    storageBucket: 'trueform-ai-physiotherapist.firebasestorage.app',
  );

  // TODO: Add iOS config when building for iOS  
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'YOUR-IOS-API-KEY',
    appId: 'YOUR-IOS-APP-ID',
    messagingSenderId: '90086422666',
    projectId: 'trueform-ai-physiotherapist',
    storageBucket: 'trueform-ai-physiotherapist.firebasestorage.app',
    iosBundleId: 'com.trueform.trueformAi',
  );
}
