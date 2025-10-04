import React, { useState, useRef, createContext, useContext, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { API_URL } from './config';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';



const { width, height } = Dimensions.get('window');

// Create a context for mode state
const ModeContext = createContext();

// Animated Sine Wave Component
const AnimatedWaves = ({ isProcessing = false }) => {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // total cycle of 4 seconds left -> right
    const totalDuration = 4000;
    const stagger = 800; // 800ms between wave starts

    const createWaveAnimation = (animValue, delay) => {
      const seq = Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animValue, {
          toValue: 1,
          duration: totalDuration,
          useNativeDriver: true,
        }),
        // reset instantly so each loop restarts from left
        Animated.timing(animValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]);
      const loop = Animated.loop(seq);
      loop.start();
      return loop;
    };

    const l1 = createWaveAnimation(wave1, 0);
    const l2 = createWaveAnimation(wave2, stagger);
    const l3 = createWaveAnimation(wave3, stagger * 2);

    return () => {
      try {
        l1.stop();
      } catch (e) {}
      try {
        l2.stop();
      } catch (e) {}
      try {
        l3.stop();
      } catch (e) {}
      // also stop animated values
      wave1.stopAnimation && wave1.stopAnimation();
      wave2.stopAnimation && wave2.stopAnimation();
      wave3.stopAnimation && wave3.stopAnimation();
    };
  }, [isProcessing]);

  return (
    <View style={styles.wavesContainer}>
      {/* Base gradient layers */}
      <LinearGradient
        colors={['#2D1B4E', '#1F1635', '#0F0A1E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.baseGradient}
      />
      <LinearGradient
        colors={['rgba(88, 60, 147, 0.5)', 'rgba(75, 40, 120, 0.5)', 'rgba(50, 30, 90, 0.5)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.baseGradient}
      />
      <LinearGradient
        colors={['rgba(68, 52, 131, 0.4)', 'rgba(55, 40, 102, 0.4)', 'rgba(40, 25, 78, 0.4)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.baseGradient}
      />
      
      {/* Animated wave overlays */}
      <Animated.View 
        style={[
          styles.waveLayer,
          {
            transform: [{
              translateX: wave1.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -width * 0.5],
              })
            }]
          }
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(138, 107, 207, 0.3)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.waveGradient}
        />
      </Animated.View>

      <Animated.View 
        style={[
          styles.waveLayer,
          {
            transform: [{
              translateX: wave2.interpolate({
                inputRange: [0, 1],
                outputRange: [width * 0.3, -width * 0.7],
              })
            }]
          }
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(108, 80, 180, 0.35)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.waveGradient}
        />
      </Animated.View>

      <Animated.View 
        style={[
          styles.waveLayer,
          {
            transform: [{
              translateX: wave3.interpolate({
                inputRange: [0, 1],
                outputRange: [width * 0.5, -width],
              })
            }]
          }
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(88, 60, 147, 0.3)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.waveGradient}
        />
      </Animated.View>
    </View>
  );
};

// Processing Line Component
const ProcessingLine = () => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={styles.processingLineContainer}>
      <Animated.View 
        style={[
          styles.processingLine,
          {
            transform: [{ translateX }]
          }
        ]}
      />
    </View>
  );
};


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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const textShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 30],
  });

  return (
    <View style={styles.homeContainer}>
      <AnimatedWaves />
      
      {/* Mode Indicator */}
      <View style={styles.homeHeader}>
        <BlurView intensity={80} tint="dark" style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            Mode: {mode === 'normal' ? 'Normal' : 'Blind'}
          </Text>
        </BlurView>
      </View>

      
      {/* Center Content */}
      <View style={styles.centerContent}>
        <Animated.Text 
          style={[
            styles.senseTitle,
            {
              textShadowRadius: textShadowRadius,
            }
          ]}
        >
          Sense AI
        </Animated.Text>
        
        {/* Start Chat Button */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={onNavigate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={mode === 'normal' ? ['#8B5CF6', '#6366F1'] : ['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startChatGradient}
            >
              <Text style={styles.startChatText}>Start Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Mode Toggle Button - Fixed Position */}
      <View style={styles.homeFooter}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleMode}
          activeOpacity={0.7}
        >
          <BlurView intensity={60} tint="dark" style={styles.toggleButtonBlur}>
            <Text style={styles.toggleButtonText}>
              {mode === 'normal' ? '👁️' : '🌙'}
            </Text>
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Camera Page Component
const CameraPage = ({ onNavigate }) => {
  const { mode, toggleMode } = useContext(ModeContext);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState(null);
  const [audioPermission, setAudioPermission] = useState(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const cameraRef = useRef(null);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
      
      if (recording) {
        console.log('Recording already exists, stopping it first...');
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
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
      setIsProcessing(true);
      
      const audioUri = recording.getURI();
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const fileName = `recording_${Date.now()}.m4a`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({
        from: audioUri,
        to: permanentUri,
      });
      
      console.log('📁 Audio saved:', permanentUri);
      
      const photoToSend = capturedPhotoUri;
      setRecording(null);
      setCapturedPhotoUri(null);
      
      await sendRecordingToAPI(photoToSend, permanentUri);
      
      setIsProcessing(false);
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      Alert.alert('Error', `Failed to stop recording: ${error.message}`);
      setRecording(null);
      setCapturedPhotoUri(null);
      setIsProcessing(false);
    }
  };

  const playResponseAudio = async (base64Audio) => {
    try {
      console.log('🔊 Playing response audio...');
      const audioFile = `${FileSystem.cacheDirectory}response_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(audioFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: audioFile });
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await sound.unloadAsync();
          await FileSystem.deleteAsync(audioFile);
          console.log('🧹 Cleaned up temporary audio file');
        }
      });
    } catch (error) {
      console.error('❌ Failed to play response audio:', error);
    }
  };

  const sendRecordingToAPI = async (photoUri, audioUri) => {
    try {
      console.log('📡 Sending recording to API...');

      if (!photoUri || !audioUri) {
        Alert.alert('Error', 'Missing photo or audio file');
        return;
      }

      const photoInfo = await FileSystem.getInfoAsync(photoUri);
      const audioInfo = await FileSystem.getInfoAsync(audioUri);
      
      console.log('📸 Photo exists:', photoInfo.exists);
      console.log('🎙️ Audio exists:', audioInfo.exists);

      if (!photoInfo.exists || !audioInfo.exists) {
        Alert.alert('Error', 'Files not found on device');
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });
      formData.append('user_id', 'user123');
      formData.append('chat_id', 'chat123');
      formData.append('mode', mode);
      formData.append('question', '');

      const response = await fetch(`${API_URL}/vision`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('📥 Response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = JSON.parse(responseText);
      console.log('✅ API Response:', result);
      
      if (result.audio_base64) {
        await playResponseAudio(result.audio_base64);
      }

      Alert.alert(
        'Recording Processed',
        result.answer || 'Recording sent successfully!',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ API Error:', error.message);
      Alert.alert('API Error', error.message, [{ text: 'OK' }]);
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
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef}>
          <TouchableOpacity style={styles.backButton} onPress={onNavigate}>
            <BlurView intensity={80} tint="dark" style={styles.backButtonBlur}>
              <Text style={styles.backButtonText}>← Back</Text>
            </BlurView>
          </TouchableOpacity>

          <BlurView intensity={80} tint="dark" style={styles.modeIndicatorCamera}>
            <Text style={styles.modeText}>
              Mode: {mode === 'normal' ? 'Normal' : 'Blind'}
            </Text>
          </BlurView>

          <BlurView intensity={80} tint="dark" style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>🎙️ {photoCount}</Text>
          </BlurView>
        </CameraView>
      </View>

      {/* Processing Line Indicator */}
      {isProcessing && <ProcessingLine />}

      <View style={styles.controlPanel}>
        <View style={styles.waveBackground}>
          <AnimatedWaves isProcessing={isProcessing} />
        </View>
        <BlurView 
          intensity={isProcessing ? 0 : 80} 
          tint="dark" 
          style={styles.controlBlur}
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <View style={[
                styles.recordButtonInner,
                isRecording && styles.recordButtonInnerActive
              ]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButtonCamera}
              onPress={toggleMode}
              activeOpacity={0.7}
            >
              <BlurView intensity={60} tint="dark" style={styles.toggleButtonCameraBlur}>
                <Text style={styles.toggleButtonText}>
                  {mode === 'normal' ? '👁️' : '🌙'}
                </Text>
              </BlurView>
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}

          {isProcessing && (
            <View style={styles.processingIndicator}>
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  homeHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 1,
  },
  senseTitle: {
    fontSize: 70,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
    letterSpacing: 0,
    fontFamily: 'Palatino',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  wavesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    overflow: 'hidden',
  },
  baseGradient: {
    position: 'absolute',
    width: width,
    height: height,
    opacity: 1,
  },
  waveLayer: {
    position: 'absolute',
    width: width * 2,
    height: height,
    left: 0,
    top: 0,
    opacity: 1,
  },
  waveGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  waveBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  startChatButton: {
    width: 240,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  startChatGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startChatText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  homeFooter: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    zIndex: 10,
  },
  toggleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  toggleButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 3,
  },
  camera: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    borderRadius: 20,
    overflow: 'hidden',
  },
  photoCounter: {
    position: 'absolute',
    top: 110,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photoCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  processingLineContainer: {
    position: 'absolute',
    top: height * 0.75,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    zIndex: 10,
    overflow: 'hidden',
  },
  processingLine: {
    width: 100,
    height: 4,
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  controlPanel: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  controlBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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
  toggleButtonCamera: {
    position: 'absolute',
    right: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  toggleButtonCameraBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  processingIndicator: {
    marginTop: 16,
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  permButton: {
    marginTop: 20,
    backgroundColor: '#ff4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;