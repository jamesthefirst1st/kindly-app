import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function App() {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const startRecording = async () => {
        try {
            console.log('Requesting permissions..');
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission to access microphone is required!');
                return;
            }

            console.log('Starting recording..');
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecordingAndTranscribe = async () => {
        if (!recording) return;
        setIsRecording(false);

        try {
            console.log('Stopping recording...');
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            console.log('Recording stopped and file saved at', uri);

            // 🎧 Playback audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: uri || '' },
                { shouldPlay: true }
            );
            console.log('Playback started');

            await sendAudioToBackend(uri);
        } catch (error) {
            console.error('Failed to stop recording', error);
        }
    };

    const sendAudioToBackend = async (uri: string | null) => {
        if (!uri) return;
        setIsLoading(true);
        setTranscription('');

        try {
            const audioBase64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const response = await fetch('http://192.168.0.165:5000/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioData: audioBase64 }),
            });

            const data = await response.json();

            if (data.transcription) {
                setTranscription(data.transcription);
                console.log('✅ Transcription:', data.transcription);
            } else {
                console.log('🛑 Google STT returned no transcription');
                setTranscription('[No transcription received]');
            }
        } catch (error) {
            console.error('❌ Transcription failed:', error);
            setTranscription('Transcription failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎤 Speech to Text</Text>

            <Button
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
                onPress={isRecording ? stopRecordingAndTranscribe : startRecording}
                color={isRecording ? 'red' : 'green'}
            />

            {isLoading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

            <Text style={styles.resultLabel}>Transcription:</Text>
            <Text style={styles.transcription}>{transcription || '---'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        textAlign: 'center',
        marginBottom: 24,
    },
    resultLabel: {
        fontSize: 18,
        marginTop: 32,
        fontWeight: '600',
    },
    transcription: {
        fontSize: 16,
        marginTop: 8,
        color: '#333',
    },
});
