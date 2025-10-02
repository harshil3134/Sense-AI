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
  const cameraRef = useRef(null);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  React.useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
    })();
  }, []);

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