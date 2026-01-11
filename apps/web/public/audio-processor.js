class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    if (outputs || parameters) {
      // console.log('AudioProcessor: outputs or parameters');
    }

    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      // Send the data to the main thread
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
