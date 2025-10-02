import React, { useState, useRef, createContext, useContext } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Create a context for mode state
const ModeContext = createContext();

// Main App Component with Mode Provider
const App = () => {
  const [mode, setMode] = useState('default');
  const [currentPage, setCurrentPage] = useState('home');

  const toggleMode = () => {
    setMode(mode === 'default' ? 'alternate' : 'default');
  };

  return (
    <ModeContext.Provider value={{ mode, toggleMode }}>
      {currentPage === 'home' ? (
        <HomePage onNavigate={() => setCurrentPage('camera')} />
      ) : (
        <CameraPage onNavigate={() => setCurrentPage('home')} />
      )}
    </ModeContext.Provider>
  );
};

// Home Page Component
const HomePage = ({ onNavigate }) => {
  const { mode, toggleMode } = useContext(ModeContext);

  return (
    <View style={[styles.homeContainer, mode === 'alternate' && styles.alternateBg]}>
      {/* Mode Indicator */}
      <View style={styles.homeHeader}>
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            Mode: {mode === 'default' ? 'Default' : 'Alternate'}
          </Text>
        </View>
      </View>

      {/* Center Content */}
      <View style={styles.centerContent}>
        <Text style={styles.title}>Camera Audio Recorder</Text>
        <Text style={styles.subtitle}>
          Record audio with live camera preview
        </Text>
        
        {/* Open Camera Button */}
        <TouchableOpacity
          style={[styles.openButton, mode === 'alternate' && styles.openButtonAlternate]}
          onPress={onNavigate}
        >
          <Text style={styles.openButtonText}>📷</Text>
          <Text style={styles.openButtonLabel}>Open Camera</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Toggle Button */}
      <View style={styles.homeFooter}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleMode}
        >
          <Text style={styles.toggleButtonText}>
            {mode === 'default' ? '⚡' : '🌙'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Camera Page Component
const CameraPage = ({ onNavigate }) => {
  const { mode, toggleMode } = useContext(ModeContext);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [audioPermission, setAudioPermission] = useState(null);
  const [photoCount, setPhotoCount] = useState(0);
  const cameraRef = useRef(null);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Request permissions
  React.useEffect(() => {
    (async () => {
      console.log('🔐 Requesting permissions...');
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
      console.log('✅ Permissions granted - Camera:', cameraPermission?.granted, 'Audio:', status === 'granted');
    })();
  }, []);

  // Auto-capture photos every 4 seconds
  React.useEffect(() => {
    console.log('🎬 Camera page mounted');
    console.log('🔍 Checking permissions - Camera:', cameraPermission?.granted, 'Audio:', audioPermission);
    
    let captureInterval = null;
    
    const startCapturing = async () => {
      console.log('📸 Starting auto-capture (every 4 seconds)...');
      
      // Wait for camera to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🎥 Camera should be ready, starting captures...');
      
      // Capture first photo
      await capturePhoto();
      
      // Then capture every 4 seconds
      captureInterval = setInterval(async () => {
        await capturePhoto();
      }, 4000);
    };

    if (cameraPermission?.granted && audioPermission) {
      console.log('✅ All permissions granted, starting capture loop');
      startCapturing();
    } else {
      console.log('⚠️ Waiting for permissions...');
    }

    return () => {
      if (captureInterval) {
        clearInterval(captureInterval);
        console.log('🛑 Stopped auto-capture');
      }
    };
  }, [cameraPermission?.granted, audioPermission]);

  const capturePhoto = async () => {
    console.log('📷 capturePhoto function called');
    
    if (!cameraRef.current) {
      console.log('⚠️ Camera ref is NULL - camera not ready');
      return;
    }

    console.log('✅ Camera ref exists, attempting to take picture...');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      console.log('📸 Photo object received:', photo ? 'YES' : 'NO');

      if (!photo || !photo.uri) {
        console.error('❌ No photo URI returned');
        return;
      }

      console.log('📍 Photo URI:', photo.uri);

      // Generate filename with timestamp
      const timestamp = Date.now();
      const fileName = `photo_${timestamp}.jpg`;
      const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;

      console.log('💾 Copying to cache:', cacheUri);

      // Copy photo to cache directory
      await FileSystem.copyAsync({
        from: photo.uri,
        to: cacheUri,
      });

      const newCount = photoCount + 1;
      setPhotoCount(newCount);

      // Log to console
      console.log('✅ Photo captured successfully!');
      console.log(`   📁 File: ${fileName}`);
      console.log(`   📍 Cache Path: ${cacheUri}`);
      console.log(`   📊 Total photos: ${newCount}`);
      console.log('========================================');

    } catch (error) {
      console.error('❌ ERROR in capturePhoto:');
      console.error('   Message:', error.message);
      console.error('   Full error:', JSON.stringify(error, null, 2));
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start audio recording');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      
      const fileName = `recording_${Date.now()}.m4a`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({
        from: uri,
        to: permanentUri,
      });
      
      setRecording(null);
      
      Alert.alert(
        'Recording Saved',
        `Audio saved to: ${permanentUri}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  if (!cameraPermission || audioPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !audioPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera and microphone permissions are required
        </Text>
        <TouchableOpacity 
          style={styles.permButton}
          onPress={async () => {
            await requestCameraPermission();
            const { status } = await Audio.requestPermissionsAsync();
            setAudioPermission(status === 'granted');
          }}
        >
          <Text style={styles.permButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View - Upper 3/4 */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onNavigate}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Mode Indicator */}
          <View style={styles.modeIndicatorCamera}>
            <Text style={styles.modeText}>
              Mode: {mode === 'default' ? 'Default' : 'Alternate'}
            </Text>
          </View>

          {/* Photo Counter */}
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>📸 {photoCount}</Text>
          </View>
        </CameraView>
      </View>

      {/* Bottom Control Panel - Lower 1/4 */}
      <View style={styles.controlPanel}>
        <View style={styles.buttonContainer}>
          {/* Audio Recording Button */}
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <View style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonInnerActive
            ]} />
          </TouchableOpacity>

          {/* Mode Toggle Button */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
          >
            <Text style={styles.toggleButtonText}>
              {mode === 'default' ? '⚡' : '🌙'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recording Status */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Home Page Styles
  homeContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  alternateBg: {
    backgroundColor: '#1a1a2e',
  },
  homeHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 60,
  },
  openButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  openButtonAlternate: {
    backgroundColor: '#6c5ce7',
    shadowColor: '#6c5ce7',
  },
  openButtonText: {
    fontSize: 48,
    marginBottom: 8,
  },
  openButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeFooter: {
    paddingBottom: 40,
    alignItems: 'flex-end',
    paddingHorizontal: 30,
  },
  
  // Camera Page Styles
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 3,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modeIndicatorCamera: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoCounter: {
    position: 'absolute',
    top: 110,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  modeIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  controlPanel: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ff4444',
  },
  recordButtonActive: {
    backgroundColor: '#ff4444',
  },
  recordButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff4444',
  },
  recordButtonInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  toggleButton: {
    position: 'absolute',
    right: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  toggleButtonText: {
    fontSize: 24,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permButton: {
    marginTop: 20,
    backgroundColor: '#ff4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;