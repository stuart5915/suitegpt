import 'dart:async';
import 'package:flutter/material.dart';
import '../widgets/camera_view.dart';
import '../widgets/pose_overlay.dart';
import '../widgets/consultation_chat.dart';
import '../../core/models/pose_landmark.dart';
import '../../services/pose_detection/web_pose_service.dart';

/// Main screen combining camera view, pose overlay, and consultation chat.
class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final _poseService = WebPoseService();
  Pose? _currentPose;
  bool _cameraReady = false;
  bool _poseDetectionActive = false;
  StreamSubscription<Pose?>? _poseSubscription;
  
  @override
  void initState() {
    super.initState();
    _initializePoseService();
  }
  
  @override
  void dispose() {
    _poseSubscription?.cancel();
    _poseService.dispose();
    super.dispose();
  }
  
  Future<void> _initializePoseService() async {
    try {
      await _poseService.initialize();
      _poseSubscription = _poseService.poseStream.listen((pose) {
        if (mounted) {
          setState(() {
            _currentPose = pose;
          });
        }
      });
    } catch (e) {
      debugPrint('Failed to initialize pose service: $e');
    }
  }
  
  void _onCameraReady() {
    setState(() {
      _cameraReady = true;
    });
    
    // Auto-start pose detection when camera is ready
    _startPoseDetection();
  }
  
  void _onCameraError(String error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error),
        backgroundColor: Colors.red,
      ),
    );
  }
  
  Future<void> _startPoseDetection() async {
    if (!_poseService.isReady) return;
    
    await _poseService.startDetection();
    setState(() {
      _poseDetectionActive = true;
    });
  }
  
  Future<void> _stopPoseDetection() async {
    await _poseService.stopDetection();
    setState(() {
      _poseDetectionActive = false;
      _currentPose = null;
    });
  }
  
  void _onConsultationMessage(String message) {
    debugPrint('User consultation: $message');
    // TODO: Send to LLM along with pose data
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('TrueForm AI'),
        leading: const Padding(
          padding: EdgeInsets.all(8.0),
          child: Icon(Icons.healing, color: Colors.cyan),
        ),
        actions: [
          // Pose detection toggle
          IconButton(
            onPressed: _poseDetectionActive 
                ? _stopPoseDetection 
                : _startPoseDetection,
            icon: Icon(
              _poseDetectionActive 
                  ? Icons.visibility 
                  : Icons.visibility_off,
            ),
            tooltip: _poseDetectionActive 
                ? 'Hide skeleton' 
                : 'Show skeleton',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          // Responsive layout: side-by-side on wide screens, stacked on narrow
          final isWide = constraints.maxWidth > 800;
          
          if (isWide) {
            return _buildWideLayout();
          } else {
            return _buildNarrowLayout();
          }
        },
      ),
    );
  }
  
  Widget _buildWideLayout() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          // Camera + overlay (main content)
          Expanded(
            flex: 3,
            child: _buildCameraSection(),
          ),
          const SizedBox(width: 16),
          
          // Consultation chat sidebar
          Expanded(
            flex: 2,
            child: ConsultationChat(
              onMessageSubmit: _onConsultationMessage,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildNarrowLayout() {
    return Column(
      children: [
        // Camera + overlay (top)
        Expanded(
          flex: 2,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: _buildCameraSection(),
          ),
        ),
        
        // Consultation chat (bottom)
        Expanded(
          flex: 3,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: ConsultationChat(
              onMessageSubmit: _onConsultationMessage,
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildCameraSection() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Camera feed
          CameraView(
            onCameraReady: _onCameraReady,
            onError: _onCameraError,
          ),
          
          // Pose overlay (rendered on top of camera)
          if (_poseDetectionActive && _currentPose != null)
            PoseOverlay(pose: _currentPose),
          
          // Status indicators
          Positioned(
            top: 12,
            left: 12,
            child: _buildStatusBadge(),
          ),
        ],
      ),
    );
  }
  
  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: _poseDetectionActive ? Colors.greenAccent : Colors.orange,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _poseDetectionActive ? 'Pose Detection Active' : 'Detection Paused',
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
