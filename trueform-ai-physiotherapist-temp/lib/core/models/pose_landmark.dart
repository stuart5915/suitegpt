/// Pose landmark data model representing a single body point from pose detection.
/// 
/// This model is platform-agnostic and used by both web (MediaPipe) and mobile
/// (ML Kit) pose detection implementations.
class PoseLandmark {
  /// Unique identifier for the landmark (0-32 for MediaPipe, matching body parts)
  final int id;
  
  /// Landmark name (e.g., 'LEFT_SHOULDER', 'RIGHT_HIP')
  final String name;
  
  /// X coordinate (normalized 0.0-1.0, relative to image width)
  final double x;
  
  /// Y coordinate (normalized 0.0-1.0, relative to image height)
  final double y;
  
  /// Z coordinate (depth, normalized relative to hip center)
  final double z;
  
  /// Visibility confidence (0.0-1.0, higher = more visible)
  final double visibility;
  
  const PoseLandmark({
    required this.id,
    required this.name,
    required this.x,
    required this.y,
    this.z = 0.0,
    this.visibility = 1.0,
  });
  
  /// Create from MediaPipe/ML Kit JSON result
  factory PoseLandmark.fromJson(Map<String, dynamic> json, int index) {
    return PoseLandmark(
      id: index,
      name: landmarkNames[index] ?? 'UNKNOWN',
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
      z: (json['z'] as num?)?.toDouble() ?? 0.0,
      visibility: (json['visibility'] as num?)?.toDouble() ?? 1.0,
    );
  }
  
  /// MediaPipe pose landmark names (33 points)
  static const Map<int, String> landmarkNames = {
    0: 'NOSE',
    1: 'LEFT_EYE_INNER',
    2: 'LEFT_EYE',
    3: 'LEFT_EYE_OUTER',
    4: 'RIGHT_EYE_INNER',
    5: 'RIGHT_EYE',
    6: 'RIGHT_EYE_OUTER',
    7: 'LEFT_EAR',
    8: 'RIGHT_EAR',
    9: 'MOUTH_LEFT',
    10: 'MOUTH_RIGHT',
    11: 'LEFT_SHOULDER',
    12: 'RIGHT_SHOULDER',
    13: 'LEFT_ELBOW',
    14: 'RIGHT_ELBOW',
    15: 'LEFT_WRIST',
    16: 'RIGHT_WRIST',
    17: 'LEFT_PINKY',
    18: 'RIGHT_PINKY',
    19: 'LEFT_INDEX',
    20: 'RIGHT_INDEX',
    21: 'LEFT_THUMB',
    22: 'RIGHT_THUMB',
    23: 'LEFT_HIP',
    24: 'RIGHT_HIP',
    25: 'LEFT_KNEE',
    26: 'RIGHT_KNEE',
    27: 'LEFT_ANKLE',
    28: 'RIGHT_ANKLE',
    29: 'LEFT_HEEL',
    30: 'RIGHT_HEEL',
    31: 'LEFT_FOOT_INDEX',
    32: 'RIGHT_FOOT_INDEX',
  };
}

/// Collection of pose landmarks representing a full body pose
class Pose {
  final List<PoseLandmark> landmarks;
  final DateTime timestamp;
  
  const Pose({
    required this.landmarks,
    required this.timestamp,
  });
  
  /// Get landmark by ID
  PoseLandmark? getLandmark(int id) {
    if (id < 0 || id >= landmarks.length) return null;
    return landmarks[id];
  }
  
  /// Get landmark by name
  PoseLandmark? getLandmarkByName(String name) {
    try {
      return landmarks.firstWhere((l) => l.name == name);
    } catch (_) {
      return null;
    }
  }
  
  /// Check if pose has minimum required landmarks for analysis
  bool get isValid => landmarks.length >= 17; // At least upper body
}
