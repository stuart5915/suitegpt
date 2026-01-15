import 'dart:math';
import 'models/pose_landmark.dart';

/// Core pose analysis logic - platform independent.
/// Contains all mathematical calculations for posture assessment.
class PoseAnalysis {
  /// Calculate angle between three landmarks (in degrees)
  /// 
  /// Example: Calculate elbow angle with shoulder, elbow, wrist
  static double calculateAngle(
    PoseLandmark point1, // e.g., shoulder
    PoseLandmark vertex, // e.g., elbow (the joint)
    PoseLandmark point2, // e.g., wrist
  ) {
    // Vector from vertex to point1
    final v1x = point1.x - vertex.x;
    final v1y = point1.y - vertex.y;
    
    // Vector from vertex to point2
    final v2x = point2.x - vertex.x;
    final v2y = point2.y - vertex.y;
    
    // Dot product
    final dot = v1x * v2x + v1y * v2y;
    
    // Magnitudes
    final mag1 = sqrt(v1x * v1x + v1y * v1y);
    final mag2 = sqrt(v2x * v2x + v2y * v2y);
    
    if (mag1 == 0 || mag2 == 0) return 0;
    
    // Clamp to avoid floating point errors in acos
    final cosAngle = (dot / (mag1 * mag2)).clamp(-1.0, 1.0);
    
    // Convert radians to degrees
    return acos(cosAngle) * 180 / pi;
  }
  
  /// Check if hips are level (useful for gait analysis)
  /// Returns the tilt angle in degrees (positive = right hip higher)
  static double calculateHipTilt(Pose pose) {
    final leftHip = pose.getLandmark(23); // LEFT_HIP
    final rightHip = pose.getLandmark(24); // RIGHT_HIP
    
    if (leftHip == null || rightHip == null) return 0;
    
    // Calculate angle from horizontal
    final dx = rightHip.x - leftHip.x;
    final dy = rightHip.y - leftHip.y;
    
    return atan2(dy, dx) * 180 / pi;
  }
  
  /// Calculate shoulder tilt (positive = right shoulder higher)
  static double calculateShoulderTilt(Pose pose) {
    final leftShoulder = pose.getLandmark(11); // LEFT_SHOULDER
    final rightShoulder = pose.getLandmark(12); // RIGHT_SHOULDER
    
    if (leftShoulder == null || rightShoulder == null) return 0;
    
    final dx = rightShoulder.x - leftShoulder.x;
    final dy = rightShoulder.y - leftShoulder.y;
    
    return atan2(dy, dx) * 180 / pi;
  }
  
  /// Calculate knee angle (useful for squat form analysis)
  static double calculateKneeAngle(Pose pose, {bool left = true}) {
    final hipId = left ? 23 : 24;
    final kneeId = left ? 25 : 26;
    final ankleId = left ? 27 : 28;
    
    final hip = pose.getLandmark(hipId);
    final knee = pose.getLandmark(kneeId);
    final ankle = pose.getLandmark(ankleId);
    
    if (hip == null || knee == null || ankle == null) return 180;
    
    return calculateAngle(hip, knee, ankle);
  }
  
  /// Analyze posture and return issues
  static List<PostureIssue> analyzePosture(Pose pose) {
    final issues = <PostureIssue>[];
    
    // Check hip tilt
    final hipTilt = calculateHipTilt(pose);
    if (hipTilt.abs() > 5) {
      issues.add(PostureIssue(
        type: PostureIssueType.hipDrop,
        severity: hipTilt.abs() > 10 ? IssueSeverity.high : IssueSeverity.medium,
        description: hipTilt > 0 
            ? 'Right hip is elevated by ${hipTilt.abs().toStringAsFixed(1)}°'
            : 'Left hip is elevated by ${hipTilt.abs().toStringAsFixed(1)}°',
        value: hipTilt,
      ));
    }
    
    // Check shoulder tilt
    final shoulderTilt = calculateShoulderTilt(pose);
    if (shoulderTilt.abs() > 5) {
      issues.add(PostureIssue(
        type: PostureIssueType.shoulderImbalance,
        severity: shoulderTilt.abs() > 10 ? IssueSeverity.high : IssueSeverity.medium,
        description: shoulderTilt > 0
            ? 'Right shoulder is elevated by ${shoulderTilt.abs().toStringAsFixed(1)}°'
            : 'Left shoulder is elevated by ${shoulderTilt.abs().toStringAsFixed(1)}°',
        value: shoulderTilt,
      ));
    }
    
    return issues;
  }
}

/// Types of posture issues that can be detected
enum PostureIssueType {
  hipDrop,
  shoulderImbalance,
  forwardHead,
  kneeCave,
  ankleCollapse,
  spinalCurvature,
}

/// Severity levels for posture issues
enum IssueSeverity { low, medium, high }

/// Represents a detected posture issue
class PostureIssue {
  final PostureIssueType type;
  final IssueSeverity severity;
  final String description;
  final double value;
  
  const PostureIssue({
    required this.type,
    required this.severity,
    required this.description,
    required this.value,
  });
}
