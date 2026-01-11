import { Loader2, Mic, Square } from 'lucide-react';

import { useRef, useState } from 'react';

import { PageLayout } from '../components/PageLayout';
import { trpc } from '../utils/trpc';

// Helper to convert Float32Array to 16-bit PCM
function floatTo16BitPCM(
  output: DataView,
  offset: number,
  input: Float32Array,
) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const VoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('en');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);

  const transcribeMutation = trpc.speech.transcribe.useMutation();

  const startRecording = async () => {
    try {
      setError('');
      setTranscription('');
      audioDataRef.current = [];
      isRecordingRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      audioContextRef.current = audioContext;

      // Load the worklet module
      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
      } catch (e) {
        console.error('Failed to load audio worklet:', e);
        throw new Error(
          'Failed to load audio worklet. Ensure audio-processor.js is in public/.',
        );
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      workletNode.port.onmessage = (event) => {
        if (!isRecordingRef.current) return;
        const inputData = event.data;
        // Clone the data by creating a new Float32Array from the transferred buffer
        audioDataRef.current.push(new Float32Array(inputData));
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone.');
      isRecordingRef.current = false;
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;

    // Tiny delay to ensure last chunk is processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cleanup
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
    }

    if (audioDataRef.current.length === 0) {
      setError('No audio recorded.');
      return;
    }

    // Process audio data
    const totalLength = audioDataRef.current.reduce(
      (acc, val) => acc + val.length,
      0,
    );

    if (totalLength === 0) {
      setError('No audio recorded (length 0).');
      return;
    }

    // Merge chunks
    const rawBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioDataRef.current) {
      rawBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Resample to 16kHz if needed
    let finalBuffer = rawBuffer;
    const currentSampleRate = audioContextRef.current?.sampleRate || 48000;
    const targetSampleRate = 16000;

    if (currentSampleRate !== targetSampleRate) {
      try {
        const offlineCtx = new OfflineAudioContext(
          1,
          (rawBuffer.length * targetSampleRate) / currentSampleRate,
          targetSampleRate,
        );
        const source = offlineCtx.createBufferSource();
        const audioBuffer = offlineCtx.createBuffer(
          1,
          rawBuffer.length,
          currentSampleRate,
        );
        audioBuffer.copyToChannel(rawBuffer, 0);
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();
        const renderedBuffer = await offlineCtx.startRendering();
        finalBuffer = renderedBuffer.getChannelData(0);
      } catch (err) {
        console.error('[VoiceInput] Resampling failed:', err);
        setError('Failed to process audio (resampling).');
        return;
      }
    }

    // Convert to PCM
    const buffer = new ArrayBuffer(finalBuffer.length * 2);
    const view = new DataView(buffer);
    floatTo16BitPCM(view, 0, finalBuffer);

    // Send to backend
    const base64Audio = arrayBufferToBase64(buffer);

    try {
      // We always send 16000 now
      const result = await transcribeMutation.mutateAsync({
        audioData: base64Audio,
        language: language,
        sampleRate: 16000,
      });
      setTranscription(result || 'No speech recognized.');
    } catch (err) {
      console.error('[VoiceInput] Transcription error:', err);
      setError('Failed to transcribe audio.');
    }
  };

  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center p-8 space-y-6">
        <h1 className="text-2xl font-bold mb-4">Voice Input Experiment</h1>
        <div className="p-6 bg-surface-container-high rounded-xl shadow-lg w-full max-w-md text-center">
          <p className="text-on-surface-variant mb-4">
            Click the microphone to start recording. Speak clearly.
          </p>

          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-full ${language === 'en' ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('de')}
              className={`px-4 py-2 rounded-full ${language === 'de' ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`}
            >
              German
            </button>
          </div>

          <div className="flex justify-center mb-6">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity"
                disabled={transcribeMutation.isLoading}
                aria-label="Start Recording"
              >
                <Mic size={32} />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-error text-on-error flex items-center justify-center hover:opacity-90 transition-opacity animate-pulse"
                aria-label="Stop Recording"
              >
                <Square size={32} />
              </button>
            )}
          </div>

          {transcribeMutation.isLoading && (
            <div className="flex items-center justify-center space-x-2 text-primary mb-4">
              <Loader2 className="animate-spin" />
              <span>Transcribing...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-lg mb-4">
              {error}
            </div>
          )}

          {transcription && (
            <div className="p-4 bg-secondary-container text-on-secondary-container rounded-lg text-left">
              <h3 className="text-sm font-bold mb-1 opacity-75">
                Transcription:
              </h3>
              <p className="text-lg">{transcription}</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default VoiceInput;
