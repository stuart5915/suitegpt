import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import '../../services/camera/camera_service.dart';
import '../../services/camera/web_camera_service.dart';

/// Camera view widget with web browser permission handling.
/// 
/// Displays the live camera feed and handles DroidCam/webcam selection.
class CameraView extends StatefulWidget {
  /// Callback when camera is ready
  final VoidCallback? onCameraReady;
  
  /// Callback when camera error occurs
  final Function(String error)? onError;
  
  const CameraView({
    super.key,
    this.onCameraReady,
    this.onError,
  });

  @override
  State<CameraView> createState() => _CameraViewState();
}

class _CameraViewState extends State<CameraView> with WidgetsBindingObserver {
  late CameraService _cameraService;
  bool _isLoading = true;
  String? _errorMessage;
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _cameraService = WebCameraService();
    _initializeCamera();
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraService.dispose();
    super.dispose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Handle app lifecycle for camera management
    if (!_cameraService.isInitialized) return;
    
    if (state == AppLifecycleState.inactive) {
      _cameraService.stopPreview();
    } else if (state == AppLifecycleState.resumed) {
      _cameraService.startPreview();
    }
  }
  
  Future<void> _initializeCamera() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      await _cameraService.initialize();
      await _cameraService.startPreview();
      
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        widget.onCameraReady?.call();
      }
    } on CameraException catch (e) {
      _handleError('Camera error: ${e.description}');
    } catch (e) {
      _handleError('Failed to access camera: $e');
    }
  }
  
  /// Full retry - disposes old service and creates new one
  Future<void> _retryCamera() async {
    // Fully dispose existing camera service
    try {
      await _cameraService.dispose();
    } catch (e) {
      debugPrint('Dispose error (ignored): $e');
    }
    
    // Create fresh camera service
    _cameraService = WebCameraService();
    
    // Re-initialize
    await _initializeCamera();
  }
  
  void _handleError(String message) {
    if (mounted) {
      setState(() {
        _isLoading = false;
        _errorMessage = message;
      });
      widget.onError?.call(message);
    }
  }
  
  Future<void> _switchCamera() async {
    final cameras = _cameraService.cameras;
    if (cameras.length <= 1) return;
    
    final currentCamera = _cameraService.controller?.description;
    final currentIndex = cameras.indexOf(currentCamera!);
    final nextIndex = (currentIndex + 1) % cameras.length;
    
    try {
      await _cameraService.switchCamera(cameras[nextIndex]);
      setState(() {});
    } catch (e) {
      _handleError('Failed to switch camera: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return _buildLoadingState();
    }
    
    if (_errorMessage != null) {
      return _buildErrorState();
    }
    
    if (!_cameraService.isInitialized || _cameraService.controller == null) {
      return _buildErrorState();
    }
    
    return _buildCameraPreview();
  }
  
  Widget _buildLoadingState() {
    return Container(
      color: Colors.black,
      child: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Colors.cyan),
            SizedBox(height: 16),
            Text(
              'Requesting camera access...',
              style: TextStyle(color: Colors.white70),
            ),
            SizedBox(height: 8),
            Text(
              'Select "DroidCam" if prompted',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildErrorState() {
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.videocam_off, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              _errorMessage ?? 'Camera not available',
              style: const TextStyle(color: Colors.white70),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Make sure DroidCam is connected and no other app is using it',
              style: TextStyle(color: Colors.white38, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: _retryCamera,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: _showCameraList,
                  icon: const Icon(Icons.list),
                  label: const Text('List Cameras'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  Future<void> _showCameraList() async {
    // Try to get camera list without initializing
    List<CameraDescription> cameras = [];
    String? error;
    
    try {
      cameras = await availableCameras();
    } catch (e) {
      error = e.toString();
    }
    
    if (!mounted) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Available Cameras', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (error != null) 
              Text('Error: $error', style: const TextStyle(color: Colors.redAccent)),
            if (cameras.isEmpty && error == null)
              const Text('No cameras found. Check DroidCam connection.', 
                style: TextStyle(color: Colors.white70)),
            ...cameras.map((cam) => ListTile(
              leading: const Icon(Icons.videocam, color: Colors.cyan),
              title: Text(cam.name, style: const TextStyle(color: Colors.white)),
              subtitle: Text('${cam.lensDirection.name}', 
                style: const TextStyle(color: Colors.white54, fontSize: 12)),
              onTap: () {
                Navigator.pop(context);
                _selectCamera(cam);
              },
            )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
  
  Future<void> _selectCamera(CameraDescription camera) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      // Dispose existing
      await _cameraService.dispose();
      _cameraService = WebCameraService();
      
      // Initialize and switch to selected camera
      await _cameraService.initialize();
      await _cameraService.switchCamera(camera);
      await _cameraService.startPreview();
      
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        widget.onCameraReady?.call();
      }
    } catch (e) {
      _handleError('Failed to use camera: $e');
    }
  }
  
  Widget _buildCameraPreview() {
    final controller = _cameraService.controller!;
    
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera preview
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: CameraPreview(controller),
        ),
        
        // Camera switch button (if multiple cameras)
        if (_cameraService.cameras.length > 1)
          Positioned(
            top: 12,
            right: 12,
            child: IconButton(
              onPressed: _switchCamera,
              icon: const Icon(Icons.cameraswitch),
              style: IconButton.styleFrom(
                backgroundColor: Colors.black54,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        
        // Camera name indicator
        Positioned(
          bottom: 12,
          left: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.videocam, size: 16, color: Colors.greenAccent),
                const SizedBox(width: 6),
                Text(
                  controller.description.name,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
