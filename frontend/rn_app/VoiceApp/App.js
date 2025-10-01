import React, { useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { Audio } from "expo-av";

export default function App() {
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);

  // Start recording
  async function startRecording() {
    try {
      console.log("Requesting permissions..");
      await Audio.requestPermissionsAsync();

      console.log("Starting recording..");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  // Stop recording
  async function stopRecording() {
    console.log("Stopping recording..");
    setRecording(undefined);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    console.log("Recording stopped and stored at", uri);
    setRecordedUri(uri);
  }

  return (
    <View style={styles.container}>
      <Text style={{ marginBottom: 20, fontSize: 20 }}>🎙️ Voice Recorder</Text>
      <Button
        title={recording ? "Stop Recording" : "Start Recording"}
        onPress={recording ? stopRecording : startRecording}
      />

      {recordedUri && <Text style={{ marginTop: 20 }}>Saved at: {recordedUri}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
