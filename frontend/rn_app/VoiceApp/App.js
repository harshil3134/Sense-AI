import React, { useState, useRef, createContext, useContext } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { API_URL } from './config';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Create a context for mode state
const ModeContext = createContext();

// Main App Component with Mode Provider
const App = () => {
  console.log('🚀 App initializing...');
  console.log('🌐 API URL:', API_URL);
  
  const [mode, setMode] = useState('normal');
  const [currentPage, setCurrentPage] = useState('home');

  const toggleMode = () => {
    setMode(mode === 'normal' ? 'blind' : 'normal');
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
    <View style={[styles.homeContainer, mode === 'blind' && styles.blindModeBg]}>
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
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null); // Store photo URI for recording
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

  // Removed auto-capture functionality - only capture when recording starts

  // Remove the old capturePhoto function since we don't need auto-capture anymore

  // Capture photo for recording (separate from auto-capture)
  const capturePhotoForRecording = async () => {
    console.log('📷 Capturing photo for recording...');
    
    if (!cameraRef.current) {
      console.log('⚠️ Camera ref is NULL - camera not ready');
      return null;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (!photo || !photo.uri) {
        console.error('❌ No photo URI returned');
        return null;
      }

      const timestamp = Date.now();
      const fileName = `recording_photo_${timestamp}.jpg`;
      const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: photo.uri,
        to: cacheUri,
      });

      console.log('✅ Photo captured for recording:', cacheUri);
      return cacheUri;

    } catch (error) {
      console.error('❌ ERROR capturing photo for recording:', error.message);
      return null;
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting recording...');
      
      // Make sure no recording is in progress
      if (recording) {
        console.log('Recording already exists, stopping it first...');
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
      // Capture photo when recording starts
      const photoUri = await capturePhotoForRecording();
      setCapturedPhotoUri(photoUri);
      
      if (!photoUri) {
        Alert.alert('Warning', 'Failed to capture photo, but recording will continue');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      console.log('✅ Recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to start audio recording: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('🛑 Stopping recording...');
      
      if (!recording) {
        console.log('⚠️ No recording to stop');
        Alert.alert('Error', 'No active recording found');
        return;
      }
      
      setIsRecording(false);
      
      const audioUri = recording.getURI();
      console.log('📍 Audio URI before stop:', audioUri);
      
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const fileName = `recording_${Date.now()}.m4a`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      
      console.log('💾 Moving audio from:', audioUri);
      console.log('💾 Moving audio to:', permanentUri);
      
      await FileSystem.moveAsync({
        from: audioUri,
        to: permanentUri,
      });
      
      console.log('📁 Audio saved:', permanentUri);
      console.log('📁 Photo URI:', capturedPhotoUri);
      
      // Clear recording state before sending to API
      const photoToSend = capturedPhotoUri;
      setRecording(null);
      setCapturedPhotoUri(null);
      
      // Send both image and audio to API
      await sendRecordingToAPI(photoToSend, permanentUri);
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to stop recording: ${error.message}`);
      // Clean up state even on error
      setRecording(null);
      setCapturedPhotoUri(null);
    }
  };

  const playResponseAudio = async (base64Audio) => {
    try {
      console.log('🔊 Playing response audio...');
      // Create a temporary file from base64 audio
      const audioFile = `${FileSystem.cacheDirectory}response_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(audioFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('📁 Temporary audio file created:', audioFile);

      // Play the audio
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: audioFile });
      await sound.playAsync();

      // Cleanup after playing
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await sound.unloadAsync();
          await FileSystem.deleteAsync(audioFile);
          console.log('🧹 Cleaned up temporary audio file');
        }
      });
    } catch (error) {
      console.error('❌ Failed to play response audio:', error);
      Alert.alert('Error', 'Failed to play audio response');
    }
  };

  const sendRecordingToAPI = async (photoUri, audioUri) => {
    try {
      console.log('📡 Sending recording to API...');
      console.log('   Photo URI:', photoUri);
      console.log('   Audio URI:', audioUri);
      console.log('   API URL:', API_URL);

      if (!photoUri) {
        Alert.alert('Error', 'No photo captured. Cannot send to API.');
        return;
      }

      if (!audioUri) {
        Alert.alert('Error', 'No audio recorded. Cannot send to API.');
        return;
      }

      // Verify files exist
      const photoInfo = await FileSystem.getInfoAsync(photoUri);
      const audioInfo = await FileSystem.getInfoAsync(audioUri);
      
      console.log('📸 Photo exists:', photoInfo.exists, 'Size:', photoInfo.size);
      console.log('🎙️ Audio exists:', audioInfo.exists, 'Size:', audioInfo.size);

      if (!photoInfo.exists || !audioInfo.exists) {
        Alert.alert('Error', 'Files not found on device');
        return;
      }

      // Create form data with proper file objects
      const formData = new FormData();
      
      // Add photo with proper mime type
      const photoBlob = {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      };
      formData.append('file', photoBlob);
      
      // Add audio with proper mime type
      const audioBlob = {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      };
      formData.append('audio', audioBlob);
      
      // Add other parameters as strings
      formData.append('user_id', 'user123');
      formData.append('chat_id', 'chat123');
      formData.append('mode', mode);
      formData.append('question', ''); // Empty question means use audio transcription

      console.log('📦 FormData prepared');
      console.log('📤 Sending request to:', `${API_URL}/vision`);

      // Send request with proper configuration
      const response = await fetch(`${API_URL}/vision`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type - let fetch handle it for FormData
        },
      });

      console.log('📥 Response received');
      console.log('   Status:', response.status);
      console.log('   Status Text:', response.statusText);

      // Read response text first for debugging
      const responseText = await response.text();
      console.log('   Response body:', responseText);

      if (!response.ok) {
        console.error('❌ API Error Response:', responseText);
        throw new Error(`HTTP error! status: ${response.status}\nResponse: ${responseText}`);
      }

      // Try to parse JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
      }

      console.log('✅ API Response:', JSON.stringify(result, null, 2));
      
      // Play audio response if available
      if (result.audio_base64) {
        await playResponseAudio(result.audio_base64);
      }

      Alert.alert(
        'Recording Processed',
        result.answer || 'Recording sent successfully!',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Failed to send recording to API:');
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
      
      // Show more user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection and API URL.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. The server took too long to respond.';
      }
      
      Alert.alert(
        'API Error',
        errorMessage,
        [{ text: 'OK' }]
      );
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
              Mode: {mode === 'normal' ? 'Normal' : 'Blind'}
            </Text>
          </View>

          {/* Photo Counter - now shows captures from recordings */}
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>🎙️ {photoCount} recordings</Text>
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