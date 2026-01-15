import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;
import 'pose_service.dart';
import '../../core/models/pose_landmark.dart';

/// Web-specific pose detection service using MediaPipe via JavaScript interop.
/// 
/// This implementation uses MediaPipe's Pose solution through the JS libraries
/// loaded in index.html.
class WebPoseService implements PoseDetectionService {
  bool _isReady = false;
  final _poseController = StreamController<Pose?>.broadcast();
  Timer? _detectionTimer;
  
  @override
  bool get isReady => _isReady;
  
  @override
  Stream<Pose?> get poseStream => _poseController.stream;
  
  @override
  Future<void> initialize() async {
    debugPrint('WebPoseService: Initializing MediaPipe Pose...');
    
    try {
      // Call JS function to initialize MediaPipe
      await _initMediaPipe().toDart;
      _isReady = true;
      debugPrint('WebPoseService: Ready');
    } catch (e) {
      debugPrint('WebPoseService: Init error - $e');
      // Still mark as ready so the app works, just without pose detection
      _isReady = true;
    }
  }
  
  @override
  Future<void> startDetection() async {
    if (!_isReady) {
      throw StateError('Pose service not initialized. Call initialize() first.');
    }
    
    // Poll for pose results every 100ms
    _detectionTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      _processVideoFrame();
    });
    
    // Also start processing video frames
    _startVideoProcessing();
  }
  
  void _startVideoProcessing() {
    // Find the video element from the camera
    final videoElements = web.document.querySelectorAll('video');
    if (videoElements.length > 0) {
      final video = videoElements.item(0) as web.HTMLVideoElement?;
      if (video != null) {
        // Set up continuous processing
        Timer.periodic(const Duration(milliseconds: 50), (_) async {
          try {
            await _processFrame(video).toDart;
          } catch (e) {
            // Ignore errors during frame processing
          }
        });
      }
    }
  }
  
  void _processVideoFrame() {
    final landmarksJson = _getPoseLandmarks();
    if (landmarksJson != null) {
      try {
        final landmarks = _parseLandmarks(landmarksJson.toDart);
        if (landmarks.isNotEmpty) {
          final pose = Pose(
            landmarks: landmarks,
            timestamp: DateTime.now(),
          );
          _poseController.add(pose);
        }
      } catch (e) {
        debugPrint('Error parsing landmarks: $e');
      }
    }
  }
  
  List<PoseLandmark> _parseLandmarks(String jsonStr) {
    final List<dynamic> data = json.decode(jsonStr);
    final landmarks = <PoseLandmark>[];
    
    for (var i = 0; i < data.length; i++) {
      final point = data[i];
      landmarks.add(PoseLandmark(
        id: i,
        name: PoseLandmark.landmarkNames[i] ?? 'UNKNOWN',
        x: (point['x'] as num).toDouble(),
        y: (point['y'] as num).toDouble(),
        z: (point['z'] as num?)?.toDouble() ?? 0.0,
        visibility: (point['visibility'] as num?)?.toDouble() ?? 1.0,
      ));
    }
    
    return landmarks;
  }
  
  @override
  Future<void> stopDetection() async {
    _detectionTimer?.cancel();
    _detectionTimer = null;
  }
  
  @override
  Future<Pose?> detectPose(dynamic imageData) async {
    // Single frame detection not used in streaming mode
    return null;
  }
  
  @override
  Future<void> dispose() async {
    await stopDetection();
    await _poseController.close();
    _isReady = false;
  }
}

// JS interop bindings
@JS('initMediaPipePose')
external JSPromise _initMediaPipe();

@JS('processPoseFrame')
external JSPromise _processFrame(web.HTMLVideoElement video);

@JS('getPoseLandmarks')
external JSString? _getPoseLandmarks();
