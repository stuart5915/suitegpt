import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import 'auth_service.dart';

/// Firebase implementation of AuthService with Google Sign-In.
class FirebaseAuthService implements AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );
  
  @override
  User? get currentUser => _auth.currentUser;
  
  @override
  Stream<User?> get authStateChanges => _auth.authStateChanges();
  
  @override
  Future<User?> signInWithGoogle() async {
    try {
      if (kIsWeb) {
        // Web: Use popup sign-in
        final GoogleAuthProvider googleProvider = GoogleAuthProvider();
        googleProvider.addScope('email');
        googleProvider.addScope('profile');
        
        final UserCredential userCredential = 
            await _auth.signInWithPopup(googleProvider);
        
        debugPrint('Signed in: ${userCredential.user?.displayName}');
        return userCredential.user;
      } else {
        // Mobile: Use native Google Sign-In
        final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
        
        if (googleUser == null) {
          debugPrint('Google sign-in cancelled');
          return null;
        }
        
        final GoogleSignInAuthentication googleAuth = 
            await googleUser.authentication;
        
        final OAuthCredential credential = GoogleAuthProvider.credential(
          accessToken: googleAuth.accessToken,
          idToken: googleAuth.idToken,
        );
        
        final UserCredential userCredential = 
            await _auth.signInWithCredential(credential);
        
        debugPrint('Signed in: ${userCredential.user?.displayName}');
        return userCredential.user;
      }
    } catch (e) {
      debugPrint('Google sign-in error: $e');
      rethrow;
    }
  }
  
  @override
  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
    debugPrint('Signed out');
  }
}
