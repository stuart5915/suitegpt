import 'package:flutter/material.dart';
import '../../core/models/pose_landmark.dart';
import '../theme/app_theme.dart';

/// Skeletal overlay widget that draws a stick figure on detected poses.
/// 
/// Uses CustomPainter for efficient real-time rendering.
class PoseOverlay extends StatelessWidget {
  /// The detected pose to render
  final Pose? pose;
  
  /// Whether to show landmark labels
  final bool showLabels;
  
  /// Whether to highlight detected issues
  final bool highlightIssues;
  
  const PoseOverlay({
    super.key,
    this.pose,
    this.showLabels = false,
    this.highlightIssues = true,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _PoseOverlayPainter(
        pose: pose,
        showLabels: showLabels,
        highlightIssues: highlightIssues,
      ),
      child: Container(), // Transparent overlay
    );
  }
}

class _PoseOverlayPainter extends CustomPainter {
  final Pose? pose;
  final bool showLabels;
  final bool highlightIssues;
  
  // Skeleton connections (pairs of landmark IDs to connect with lines)
  static const List<List<int>> connections = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7], // Left eye to ear
    [0, 4], [4, 5], [5, 6], [6, 8], // Right eye to ear
    [9, 10], // Mouth
    
    // Torso
    [11, 12], // Shoulders
    [11, 23], // Left shoulder to hip
    [12, 24], // Right shoulder to hip
    [23, 24], // Hips
    
    // Left arm
    [11, 13], [13, 15], // Shoulder to elbow to wrist
    [15, 17], [15, 19], [15, 21], // Wrist to fingers
    
    // Right arm
    [12, 14], [14, 16], // Shoulder to elbow to wrist
    [16, 18], [16, 20], [16, 22], // Wrist to fingers
    
    // Left leg
    [23, 25], [25, 27], // Hip to knee to ankle
    [27, 29], [27, 31], // Ankle to heel/toe
    
    // Right leg
    [24, 26], [26, 28], // Hip to knee to ankle
    [28, 30], [28, 32], // Ankle to heel/toe
  ];
  
  _PoseOverlayPainter({
    this.pose,
    this.showLabels = false,
    this.highlightIssues = true,
  });
  
  @override
  void paint(Canvas canvas, Size size) {
    if (pose == null || !pose!.isValid) return;
    
    final skeletonPaint = Paint()
      ..color = AppTheme.skeletonColor
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    final jointPaint = Paint()
      ..color = AppTheme.jointColor
      ..style = PaintingStyle.fill;
    
    // Draw connections (bones)
    for (final connection in connections) {
      final start = pose!.getLandmark(connection[0]);
      final end = pose!.getLandmark(connection[1]);
      
      if (start == null || end == null) continue;
      if (start.visibility < 0.5 || end.visibility < 0.5) continue;
      
      final startPoint = Offset(start.x * size.width, start.y * size.height);
      final endPoint = Offset(end.x * size.width, end.y * size.height);
      
      canvas.drawLine(startPoint, endPoint, skeletonPaint);
    }
    
    // Draw joints (landmarks)
    for (final landmark in pose!.landmarks) {
      if (landmark.visibility < 0.5) continue;
      
      final position = Offset(
        landmark.x * size.width,
        landmark.y * size.height,
      );
      
      // Draw joint circle
      canvas.drawCircle(position, 6, jointPaint);
      
      // Draw inner highlight
      canvas.drawCircle(
        position,
        3,
        Paint()..color = Colors.white.withAlpha(180),
      );
      
      // Draw label if enabled
      if (showLabels && _isKeyLandmark(landmark.id)) {
        _drawLabel(canvas, position, landmark.name);
      }
    }
  }
  
  bool _isKeyLandmark(int id) {
    // Only show labels for major joints
    return [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].contains(id);
  }
  
  void _drawLabel(Canvas canvas, Offset position, String label) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: label.replaceAll('_', ' '),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          backgroundColor: Colors.black54,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, position + const Offset(8, -5));
  }
  
  @override
  bool shouldRepaint(_PoseOverlayPainter oldDelegate) {
    return pose != oldDelegate.pose;
  }
}
