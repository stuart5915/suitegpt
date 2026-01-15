import 'dart:async';
import 'package:flutter/material.dart';
import '../widgets/camera_view.dart';
import '../widgets/pose_overlay.dart';
import '../../core/models/pose_landmark.dart';
import '../../services/pose_detection/web_pose_service.dart';
import '../theme/app_theme.dart';

/// Scan modes for the session
enum ScanMode { none, exploring, targeted }

/// Main Scan screen with camera-first UX.
/// 
/// Flow: Camera + skeleton shows immediately → Mode selection overlay →
/// Interactive session → Log session
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _poseService = WebPoseService();
  Pose? _currentPose;
  bool _cameraReady = false;
  bool _poseDetectionActive = false;
  StreamSubscription<Pose?>? _poseSubscription;
  
  // Session state
  ScanMode _mode = ScanMode.none;
  bool _sessionActive = false;
  String? _targetArea;
  int _painScore = 5;
  final _notesController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _initializePoseService();
  }
  
  @override
  void dispose() {
    _poseSubscription?.cancel();
    _poseService.dispose();
    _notesController.dispose();
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
      // Auto-start pose detection
      await _poseService.startDetection();
      setState(() {
        _poseDetectionActive = true;
      });
    } catch (e) {
      debugPrint('Failed to initialize pose service: $e');
    }
  }
  
  void _onCameraReady() {
    setState(() {
      _cameraReady = true;
    });
  }
  
  void _onCameraError(String error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error), backgroundColor: Colors.red),
    );
  }
  
  void _selectMode(ScanMode mode, [String? target]) {
    setState(() {
      _mode = mode;
      _targetArea = target;
      _sessionActive = true;
    });
  }
  
  void _endSession() {
    setState(() {
      _sessionActive = false;
    });
    _showLogSessionSheet();
  }
  
  void _showLogSessionSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildLogSessionSheet(),
    );
  }
  
  void _resetSession() {
    setState(() {
      _mode = ScanMode.none;
      _sessionActive = false;
      _targetArea = null;
      _painScore = 5;
      _notesController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Full-screen camera (always visible)
          _buildCameraLayer(),
          
          // Only show overlays when camera is working
          if (_cameraReady) ...[
            // Pose overlay
            if (_poseDetectionActive && _currentPose != null)
              PoseOverlay(pose: _currentPose),
            
            // Mode selection overlay (shows when no mode selected)
            if (_mode == ScanMode.none)
              _buildModeSelectionOverlay(),
            
            // Session UI (shows during active session)
            if (_sessionActive)
              _buildSessionUI(),
            
            // Top status bar
            _buildTopBar(),
          ],
        ],
      ),
    );
  }
  
  Widget _buildCameraLayer() {
    return CameraView(
      onCameraReady: _onCameraReady,
      onError: _onCameraError,
    );
  }
  
  Widget _buildTopBar() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 8,
          left: 16,
          right: 16,
          bottom: 8,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.black54, Colors.transparent],
          ),
        ),
        child: Row(
          children: [
            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black45,
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
                    _sessionActive 
                        ? (_mode == ScanMode.exploring ? 'Free Scan' : 'Targeted Scan')
                        : 'Ready',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Spacer(),
            // End session button (when active)
            if (_sessionActive)
              TextButton.icon(
                onPressed: _endSession,
                icon: const Icon(Icons.stop_circle, color: Colors.redAccent),
                label: const Text('End', style: TextStyle(color: Colors.redAccent)),
                style: TextButton.styleFrom(
                  backgroundColor: Colors.black45,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
              ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildModeSelectionOverlay() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black87],
          stops: const [0.3, 1.0],
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Text(
                    'What would you like to do?',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // Option 1: Free exploration
                  _buildModeCard(
                    icon: Icons.explore,
                    title: 'Just Exploring',
                    subtitle: 'Free movement analysis',
                    color: AppTheme.secondaryColor,
                    onTap: () => _selectMode(ScanMode.exploring),
                  ),
                  const SizedBox(height: 12),
                  
                  // Option 2: I have pain
                  _buildModeCard(
                    icon: Icons.healing,
                    title: 'I Have Pain',
                    subtitle: 'Targeted assessment',
                    color: AppTheme.accentColor,
                    onTap: () => _showPainAreaDialog(),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildModeCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white.withAlpha(15),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withAlpha(40),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withAlpha(150),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios, color: Colors.white38, size: 20),
            ],
          ),
        ),
      ),
    );
  }
  
  void _showPainAreaDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Where does it hurt?', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildPainAreaOption('Shoulder', Icons.accessibility_new),
            _buildPainAreaOption('Back', Icons.airline_seat_flat),
            _buildPainAreaOption('Hip', Icons.directions_walk),
            _buildPainAreaOption('Knee', Icons.directions_run),
            _buildPainAreaOption('Other', Icons.more_horiz),
          ],
        ),
      ),
    );
  }
  
  Widget _buildPainAreaOption(String area, IconData icon) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.secondaryColor),
      title: Text(area, style: const TextStyle(color: Colors.white)),
      onTap: () {
        Navigator.pop(context);
        _selectMode(ScanMode.targeted, area);
      },
    );
  }
  
  Widget _buildSessionUI() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).padding.bottom + 16,
          left: 16,
          right: 16,
          top: 16,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.transparent, Colors.black87],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // AI prompt/guidance
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.psychology, color: AppTheme.secondaryColor),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _mode == ScanMode.exploring
                          ? 'Move freely. I\'m analyzing your posture...'
                          : 'Targeting ${_targetArea ?? "area"}. Show me movements that trigger pain.',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            
            // Pain button (for targeted mode)
            if (_mode == ScanMode.targeted)
              ElevatedButton.icon(
                onPressed: () {
                  // TODO: Log pain moment with current pose
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Pain moment recorded'),
                      duration: Duration(seconds: 1),
                    ),
                  );
                },
                icon: const Icon(Icons.warning_amber),
                label: const Text('Tap When It Hurts'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                ),
              ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildLogSessionSheet() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.greenAccent, size: 32),
              const SizedBox(width: 12),
              const Text(
                'Session Complete!',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 24),
          
          // AI Insights placeholder
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('📊 What AI Detected:', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 8),
                Text('• Posture analysis complete', style: TextStyle(color: Colors.white.withAlpha(200))),
                Text('• Movement patterns recorded', style: TextStyle(color: Colors.white.withAlpha(200))),
              ],
            ),
          ),
          const SizedBox(height: 20),
          
          // Pain score
          Text("How's your pain today? (1-10)", style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 8),
          Row(
            children: [
              Text('$_painScore', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(width: 16),
              Expanded(
                child: Slider(
                  value: _painScore.toDouble(),
                  min: 1,
                  max: 10,
                  divisions: 9,
                  activeColor: AppTheme.secondaryColor,
                  onChanged: (v) => setState(() => _painScore = v.round()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Notes
          TextField(
            controller: _notesController,
            decoration: const InputDecoration(
              hintText: 'Notes (optional)',
              hintStyle: TextStyle(color: Colors.white38),
            ),
            style: const TextStyle(color: Colors.white),
            maxLines: 2,
          ),
          const SizedBox(height: 24),
          
          // Save button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                // TODO: Save to Firestore
                Navigator.pop(context);
                _resetSession();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Session saved!')),
                );
              },
              icon: const Icon(Icons.save),
              label: const Text('Save Session'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
