import 'package:camera/camera.dart';

/// Abstract camera service interface.
/// 
/// This abstraction allows swapping web/mobile implementations without
/// modifying the UI layer or AI logic.
abstract class CameraService {
  /// Whether the camera is currently initialized
  bool get isInitialized;
  
  /// The camera controller (for web, mobile implementations differ)
  CameraController? get controller;
  
  /// Available cameras on the device
  List<CameraDescription> get cameras;
  
  /// Initialize camera and request permissions
  Future<void> initialize();
  
  /// Start the camera preview
  Future<void> startPreview();
  
  /// Stop the camera preview
  Future<void> stopPreview();
  
  /// Switch to a different camera
  Future<void> switchCamera(CameraDescription camera);
  
  /// Dispose resources
  Future<void> dispose();
}
