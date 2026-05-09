import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        Speech.speak('Welcome to the Clothing Describer. Tap anywhere on the screen to scan your outfit.', {
          language: 'en-US',
          rate: 1.0,
        });
      } else {
        Speech.speak('Camera permission is required to use this app.', {
          language: 'en-US',
        });
      }
    })();
  }, []);

  const handleScan = async () => {
    if (isProcessing || !cameraRef.current) return;

    try {
      setIsProcessing(true);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Speech.speak('Scanning your outfit...', { language: 'en-US' });

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });

      const description = await analyzeImageWithGemini(photo.base64);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Speech.speak(description, { language: 'en-US' });

    } catch (error) {
      console.error(error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Speech.speak('Sorry, there was an error analyzing the image. Please try again.', { language: 'en-US' });
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeImageWithGemini = async (base64Image) => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('API Key is missing. Did you clear the Expo cache?');
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an expert fashion assistant helping a blind person. Analyze this clothing item in deep detail. 
                Please describe: 
                1. The specific garment type, fit, and visible fabric texture (e.g., knitted, denim, silk). 
                2. The exact color, plus any patterns, prints, stripes, or graphics. 
                3. The overall style, vibe, or occasion it is best suited for (e.g., casual summer, formal business). 
                4. Two specific clothing items or colors that would complete the outfit perfectly. 
                Speak directly to the user. Keep it warm, descriptive, and under 5 sentences so it is easy to listen to. Never say 'I see' or 'it appears'.`,
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {

          maxOutputTokens: 3000,
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error Details:', JSON.stringify(data, null, 2));
      throw new Error(`API failed: ${data.error?.message || 'Unknown error'}`);
    }

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected Gemini Response Format:', data);
      throw new Error('Unexpected API response format');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        ref={cameraRef}
      >
        <TouchableOpacity
          style={styles.fullScreenButton}
          onPress={handleScan}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Scan outfit"
          accessibilityHint="Double tap to take a photo and describe the clothing in front of you"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>Analyzing...</Text>
            </View>
          ) : (
            <View style={styles.overlayTextContainer}>
              <Text style={styles.tapText}>Tap anywhere to scan</Text>
            </View>
          )}
        </TouchableOpacity>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  fullScreenButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayTextContainer: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
  },
  tapText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  processingContainer: {
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 20,
    marginTop: 15,
    fontWeight: '600',
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});