import '../../core/models/pose_landmark.dart';

/// Abstract pose detection service interface.
/// 
/// This abstraction allows swapping MediaPipe (web) with ML Kit (mobile)
/// without modifying the core logic or UI.
abstract class PoseDetectionService {
  /// Whether the detector is initialized and ready
  bool get isReady;
  
  /// Stream of detected poses
  Stream<Pose?> get poseStream;
  
  /// Initialize the pose detector
  Future<void> initialize();
  
  /// Start pose detection on camera frames
  Future<void> startDetection();
  
  /// Stop pose detection
  Future<void> stopDetection();
  
  /// Process a single frame (for testing)
  Future<Pose?> detectPose(dynamic imageData);
  
  /// Dispose resources
  Future<void> dispose();
}
