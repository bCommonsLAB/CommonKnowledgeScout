declare module 'react-volume-meter' {
  import { ComponentType } from 'react';

  interface VolumeMeterProps {
    audioContext: AudioContext;
    src: MediaStreamAudioSourceNode;
    width?: number;
    height?: number;
    maxVolume?: number;
  }

  const VolumeMeter: ComponentType<VolumeMeterProps>;
  export default VolumeMeter;
} 