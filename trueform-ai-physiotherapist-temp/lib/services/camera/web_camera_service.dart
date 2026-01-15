import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'camera_service.dart';

/// Web-specific camera service implementation.
/// 
/// Uses the `camera` package which handles WebRTC internally for web.
/// Works with DroidCam virtual webcam since it appears as a standard device.
class WebCameraService implements CameraService {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _isInitialized = false;
  
  @override
  bool get isInitialized => _isInitialized;
  
  @override
  CameraController? get controller => _controller;
  
  @override
  List<CameraDescription> get cameras => _cameras;
  
  @override
  Future<void> initialize() async {
    try {
      // Get available cameras (includes DroidCam if connected)
      _cameras = await availableCameras();
      
      if (_cameras.isEmpty) {
        throw CameraException('noCameras', 'No cameras available. Please connect a camera or start DroidCam.');
      }
      
      debugPrint('Found ${_cameras.length} camera(s):');
      for (var i = 0; i < _cameras.length; i++) {
        debugPrint('  [$i] ${_cameras[i].name} (${_cameras[i].lensDirection})');
      }
      
      // Default to first available camera
      await _initController(_cameras.first);
      
      _isInitialized = true;
    } catch (e) {
      debugPrint('Camera initialization error: $e');
      rethrow;
    }
  }
  
  Future<void> _initController(CameraDescription camera) async {
    // Dispose existing controller if any
    await _controller?.dispose();
    
    _controller = CameraController(
      camera,
      ResolutionPreset.low, // Lower resolution for virtual camera compatibility
      enableAudio: false, // No audio needed for pose detection
    );
    
    await _controller!.initialize();
  }
  
  @override
  Future<void> startPreview() async {
    // Preview starts automatically on web after initialization
    if (_controller == null || !_controller!.value.isInitialized) {
      throw StateError('Camera not initialized. Call initialize() first.');
    }
  }
  
  @override
  Future<void> stopPreview() async {
    // On web, we can pause by disposing - reinitialize to restart
    await _controller?.pausePreview();
  }
  
  @override
  Future<void> switchCamera(CameraDescription camera) async {
    if (!_cameras.contains(camera)) {
      throw ArgumentError('Camera not available: ${camera.name}');
    }
    
    await _initController(camera);
  }
  
  @override
  Future<void> dispose() async {
    await _controller?.dispose();
    _controller = null;
    _isInitialized = false;
  }
}
