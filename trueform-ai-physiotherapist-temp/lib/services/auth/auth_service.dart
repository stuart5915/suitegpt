import 'package:firebase_auth/firebase_auth.dart';

/// Abstract authentication service interface.
/// 
/// Allows swapping Firebase for other auth providers without changing UI code.
abstract class AuthService {
  /// Current user (null if not signed in)
  User? get currentUser;
  
  /// Stream of auth state changes
  Stream<User?> get authStateChanges;
  
  /// Sign in with Google
  Future<User?> signInWithGoogle();
  
  /// Sign out
  Future<void> signOut();
}
